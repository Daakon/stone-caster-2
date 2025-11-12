// Phase 25: Idempotency & Retry System
// Per-turn idempotency keys with WAL alignment and unified retry helper

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RedisClientLike = {
  get?: (key: string) => Promise<string | null>;
  set?: (key: string, value: string) => Promise<unknown>;
  expire?: (key: string, ttl: number) => Promise<unknown>;
};

type SupabaseClientLike = {
  from: (table: string) => any;
};

// Idempotency schemas
const IdempotencyKeySchema = z.object({
  key: z.string(),
  operation: z.string(),
  result: z.any(),
  created_at: z.string(),
  expires_at: z.string(),
});

const RetryConfigSchema = z.object({
  max_attempts: z.number().min(1),
  base_delay_ms: z.number().min(1),
  max_delay_ms: z.number().min(1),
  jitter: z.boolean().default(true),
  backoff_multiplier: z.number().min(1).default(2),
});

const RetryResultSchema = z.object({
  success: z.boolean(),
  attempts: z.number(),
  total_delay_ms: z.number(),
  error: z.string().optional(),
  result: z.any().optional(),
});

export class IdempotencyManager {
  private static instance: IdempotencyManager;
  private cache: Map<string, any> = new Map();

  constructor() {
    this.cleanupExpiredKeys();
  }

  static getInstance(): IdempotencyManager {
    if (!IdempotencyManager.instance) {
      IdempotencyManager.instance = new IdempotencyManager();
    }
    return IdempotencyManager.instance;
  }

  /**
   * Generate idempotency key for turn operation
   */
  generateKey(sessionId: string, turnId: number, operation: string): string {
    const timestamp = Date.now();
    const hash = this.hashString(`${sessionId}-${turnId}-${operation}-${timestamp}`);
    return `turn-${hash}`;
  }

  /**
   * Check if operation is idempotent and return cached result if available
   */
  async checkIdempotency(key: string): Promise<{
    is_idempotent: boolean;
    result?: any;
    cached: boolean;
  }> {
    try {
      // Check cache first
      if (this.cache.has(key)) {
        const cached = this.cache.get(key);
        if (new Date(cached.expires_at) > new Date()) {
          return {
            is_idempotent: true,
            result: cached.result,
            cached: true,
          };
        } else {
          this.cache.delete(key);
        }
      }

      // Check database
      const { data, error } = await supabase
        .from('awf_idempotency_keys')
        .select('*')
        .eq('key', key)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        if (new Date(data.expires_at) > new Date()) {
          // Cache the result
          this.cache.set(key, data);
          return {
            is_idempotent: true,
            result: data.result,
            cached: true,
          };
        } else {
          // Expired, clean up
          await this.cleanupKey(key);
        }
      }

      return {
        is_idempotent: false,
        cached: false,
      };
    } catch (error) {
      console.error('Failed to check idempotency:', error);
      return {
        is_idempotent: false,
        cached: false,
      };
    }
  }

  /**
   * Store idempotent result
   */
  async storeResult(
    key: string,
    operation: string,
    result: any,
    ttlSeconds: number = 3600
  ): Promise<boolean> {
    try {
      const expiresAt = new Date(Date.now() + (ttlSeconds * 1000));
      
      const idempotencyData = {
        key,
        operation,
        result,
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      };

      // Store in cache
      this.cache.set(key, idempotencyData);

      // Store in database
      await supabase
        .from('awf_idempotency_keys')
        .upsert(idempotencyData);

      return true;
    } catch (error) {
      console.error('Failed to store idempotent result:', error);
      return false;
    }
  }

  /**
   * Clean up expired key
   */
  private async cleanupKey(key: string): Promise<void> {
    try {
      await supabase
        .from('awf_idempotency_keys')
        .delete()
        .eq('key', key);
      
      this.cache.delete(key);
    } catch (error) {
      console.error('Failed to cleanup key:', error);
    }
  }

  /**
   * Clean up all expired keys
   */
  private async cleanupExpiredKeys(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('awf_idempotency_keys')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('key');

      if (error) throw error;

      // Remove from cache
      for (const key of data || []) {
        this.cache.delete(key.key);
      }
    } catch (error) {
      console.error('Failed to cleanup expired keys:', error);
    }
  }

  /**
   * Hash string for key generation
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get idempotency statistics
   */
  async getStats(): Promise<{
    total_keys: number;
    cache_size: number;
    expired_keys: number;
    by_operation: Record<string, number>;
  }> {
    try {
      const { data, error } = await supabase
        .from('awf_idempotency_keys')
        .select('operation, expires_at');

      if (error) throw error;

      const by_operation: Record<string, number> = {};
      let expired_keys = 0;

      for (const key of data || []) {
        by_operation[key.operation] = (by_operation[key.operation] || 0) + 1;
        
        if (new Date(key.expires_at) <= new Date()) {
          expired_keys++;
        }
      }

      return {
        total_keys: data?.length || 0,
        cache_size: this.cache.size,
        expired_keys,
        by_operation,
      };
    } catch (error) {
      console.error('Failed to get idempotency stats:', error);
      return {
        total_keys: 0,
        cache_size: 0,
        expired_keys: 0,
        by_operation: {},
      };
    }
  }
}

export class RetryManager {
  private static instance: RetryManager;
  private defaultConfig: z.infer<typeof RetryConfigSchema>;

  constructor() {
    this.defaultConfig = {
      max_attempts: parseInt(process.env.OPS_RETRY_MAX_ATTEMPTS || '3'),
      base_delay_ms: parseInt(process.env.OPS_RETRY_BASE_MS || '250'),
      max_delay_ms: 10000,
      jitter: true,
      backoff_multiplier: 2,
    };
  }

  static getInstance(): RetryManager {
    if (!RetryManager.instance) {
      RetryManager.instance = new RetryManager();
    }
    return RetryManager.instance;
  }

  /**
   * Execute operation with retry logic
   */
  async execute<T>(
    operation: () => Promise<T>,
    config?: Partial<z.infer<typeof RetryConfigSchema>>
  ): Promise<z.infer<typeof RetryResultSchema>> {
    const retryConfig = { ...this.defaultConfig, ...config };
    let lastError: Error | null = null;
    let totalDelay = 0;

    for (let attempt = 1; attempt <= retryConfig.max_attempts; attempt++) {
      try {
        const result = await operation();
        return {
          success: true,
          attempts: attempt,
          total_delay_ms: totalDelay,
          result,
        };
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === retryConfig.max_attempts) {
          break;
        }

        const delay = this.calculateDelay(attempt, retryConfig);
        totalDelay += delay;
        
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      attempts: retryConfig.max_attempts,
      total_delay_ms: totalDelay,
      error: lastError?.message || 'Unknown error',
    };
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(
    attempt: number,
    config: z.infer<typeof RetryConfigSchema>
  ): number {
    const exponentialDelay = config.base_delay_ms * Math.pow(config.backoff_multiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, config.max_delay_ms);
    
    if (config.jitter) {
      // Add decorrelated jitter (±25% random variation)
      const jitter = (Math.random() - 0.5) * 0.5 * cappedDelay;
      return Math.max(0, cappedDelay + jitter);
    }
    
    return cappedDelay;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute operation with circuit breaker and retry
   */
  async executeWithCircuitBreaker<T>(
    serviceName: string,
    operation: () => Promise<T>,
    retryConfig?: Partial<z.infer<typeof RetryConfigSchema>>,
    circuitConfig?: any
  ): Promise<z.infer<typeof RetryResultSchema>> {
    const { CircuitBreaker } = await import('./circuit');
    const circuit = CircuitBreaker.getInstance(serviceName, circuitConfig);
    
    return this.execute(async () => {
      return circuit.execute(operation);
    }, retryConfig);
  }

  /**
   * Get retry statistics
   */
  async getStats(): Promise<{
    total_retries: number;
    successful_retries: number;
    failed_retries: number;
    avg_attempts: number;
    avg_delay_ms: number;
  }> {
    // This would typically come from a metrics store
    // For now, return mock data
    return {
      total_retries: 0,
      successful_retries: 0,
      failed_retries: 0,
      avg_attempts: 0,
      avg_delay_ms: 0,
    };
  }

  /**
   * Get default configuration
   */
  getDefaultConfig(): z.infer<typeof RetryConfigSchema> {
    return { ...this.defaultConfig };
  }

  /**
   * Update default configuration
   */
  updateDefaultConfig(newConfig: Partial<z.infer<typeof RetryConfigSchema>>): void {
    this.defaultConfig = { ...this.defaultConfig, ...newConfig };
  }
}

// Export instances
export const idempotencyManager = IdempotencyManager.getInstance();
export const retryManager = RetryManager.getInstance();

// Utility function for turn idempotency
export async function withTurnIdempotency<T>(
  sessionId: string,
  turnId: number,
  operation: string,
  fn: () => Promise<T>,
  ttlSeconds: number = 3600
): Promise<T> {
  const key = idempotencyManager.generateKey(sessionId, turnId, operation);
  
  const idempotencyCheck = await idempotencyManager.checkIdempotency(key);
  if (idempotencyCheck.is_idempotent && idempotencyCheck.cached) {
    return idempotencyCheck.result;
  }

  const result = await fn();
  await idempotencyManager.storeResult(key, operation, result, ttlSeconds);
  
  return result;
}

// Utility function for retry with circuit breaker
export async function withRetryAndCircuitBreaker<T>(
  serviceName: string,
  operation: () => Promise<T>,
  retryConfig?: Partial<z.infer<typeof RetryConfigSchema>>,
  circuitConfig?: any
): Promise<T> {
  const result = await retryManager.executeWithCircuitBreaker(
    serviceName,
    operation,
    retryConfig,
    circuitConfig
  );
  
  if (!result.success) {
    throw new Error(result.error || 'Operation failed after retries');
  }
  
  return result.result;
}

type FallbackEntry = { value: string; expiresAt: number };

/**
 * Lightweight idempotency helper used by Ops Phase 25 tests.
 * Relies on Redis when available and falls back to in-memory storage.
 */
export class IdempotencyService {
  private fallbackStore = new Map<string, FallbackEntry>();

  constructor(
    private readonly supabaseClient: SupabaseClientLike = supabase,
    private readonly redisClient: RedisClientLike | null = null
  ) {}

  private redisKey(key: string) {
    return `idempotency:${key}`;
  }

  private async getValue(key: string): Promise<string | null> {
    if (this.redisClient?.get) {
      return this.redisClient.get(key);
    }

    const entry = this.fallbackStore.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.value;
    }

    if (entry) {
      this.fallbackStore.delete(key);
    }

    return null;
  }

  private async storeValue(key: string, value: string, ttlSeconds: number) {
    if (this.redisClient?.set) {
      await this.redisClient.set(key, value);
      if (this.redisClient?.expire) {
        await this.redisClient.expire(key, ttlSeconds);
      }
      return;
    }

    this.fallbackStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  generateKey(userId: string, requestId: string): string {
    return `${userId}:${requestId}:${Date.now()}`;
  }

  async checkIdempotency(
    key: string,
    ttlSeconds: number = 300,
    payload?: unknown
  ): Promise<{ success: boolean; data?: { is_duplicate: boolean; cached_result: string | null }; error?: string }> {
    try {
      const redisKey = this.redisKey(key);
      const existing = await this.getValue(redisKey);

      if (existing) {
        return { success: true, data: { is_duplicate: true, cached_result: existing } };
      }

      const value = payload ? JSON.stringify(payload) : new Date().toISOString();
      await this.storeValue(redisKey, value, ttlSeconds);

      return { success: true, data: { is_duplicate: false, cached_result: null } };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async executeWithRetry<T>(
    key: string,
    operation: () => Promise<T>,
    options?: { max_attempts?: number; base_delay_ms?: number }
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    const maxAttempts = options?.max_attempts ?? 3;
    const baseDelay = options?.base_delay_ms ?? 100;

    let attempts = 0;
    let totalDelay = 0;
    let lastError: Error | null = null;

    while (attempts < maxAttempts) {
      attempts += 1;
      try {
        const result = await operation();
        await this.supabaseClient
          .from('awf_idempotency_keys')
          .insert({
            key,
            operation: 'retry',
            result,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          });

        return { success: true, data: result };
      } catch (error) {
        lastError = error as Error;

        if (attempts >= maxAttempts) {
          break;
        }

        const delay = baseDelay * attempts;
        totalDelay += delay;
        await new Promise(resolve => setTimeout(resolve, Math.min(delay, 10)));
      }
    }

    return {
      success: false,
      error: `Max retry attempts exceeded: ${lastError?.message || 'Unknown error'}`,
    };
  }
}
