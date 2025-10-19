// Phase 25: Circuit Breaker System
// Providers (model, Redis, DB) wrapped with open/half-open states

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Circuit breaker schemas
const CircuitBreakerConfigSchema = z.object({
  service_name: z.string(),
  failure_threshold: z.number().min(1),
  success_threshold: z.number().min(1),
  timeout_seconds: z.number().min(1),
  half_open_timeout_seconds: z.number().min(1),
});

const CircuitBreakerStateSchema = z.object({
  service_name: z.string(),
  state: z.enum(['closed', 'open', 'half_open']),
  failure_count: z.number(),
  success_count: z.number(),
  last_failure: z.string().optional(),
  last_success: z.string().optional(),
  next_attempt: z.string().optional(),
});

export class CircuitBreaker {
  private static instances: Map<string, CircuitBreaker> = new Map();
  private serviceName: string;
  private config: z.infer<typeof CircuitBreakerConfigSchema>;
  private state: 'closed' | 'open' | 'half_open' = 'closed';
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailure?: Date;
  private lastSuccess?: Date;
  private nextAttempt?: Date;

  constructor(serviceName: string, config: Partial<z.infer<typeof CircuitBreakerConfigSchema>> = {}) {
    this.serviceName = serviceName;
    this.config = {
      service_name: serviceName,
      failure_threshold: config.failure_threshold || parseInt(process.env.OPS_CIRCUIT_FAILURE_THRESHOLD || '5'),
      success_threshold: config.success_threshold || 3,
      timeout_seconds: config.timeout_seconds || 60,
      half_open_timeout_seconds: config.half_open_timeout_seconds || 30,
    };
    
    this.loadState();
  }

  static getInstance(serviceName: string, config?: Partial<z.infer<typeof CircuitBreakerConfigSchema>>): CircuitBreaker {
    if (!CircuitBreaker.instances.has(serviceName)) {
      CircuitBreaker.instances.set(serviceName, new CircuitBreaker(serviceName, config));
    }
    return CircuitBreaker.instances.get(serviceName)!;
  }

  /**
   * Load circuit breaker state from database
   */
  private async loadState(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('awf_circuit_breakers')
        .select('*')
        .eq('service_name', this.serviceName)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        this.state = data.state as 'closed' | 'open' | 'half_open';
        this.failureCount = data.failure_count;
        this.successCount = data.success_count;
        this.lastFailure = data.last_failure ? new Date(data.last_failure) : undefined;
        this.lastSuccess = data.last_success ? new Date(data.last_success) : undefined;
        this.nextAttempt = data.next_attempt ? new Date(data.next_attempt) : undefined;
      }
    } catch (error) {
      console.error(`Failed to load circuit breaker state for ${this.serviceName}:`, error);
    }
  }

  /**
   * Save circuit breaker state to database
   */
  private async saveState(): Promise<void> {
    try {
      await supabase
        .from('awf_circuit_breakers')
        .upsert({
          service_name: this.serviceName,
          state: this.state,
          failure_count: this.failureCount,
          success_count: this.successCount,
          last_failure: this.lastFailure?.toISOString(),
          last_success: this.lastSuccess?.toISOString(),
          next_attempt: this.nextAttempt?.toISOString(),
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error(`Failed to save circuit breaker state for ${this.serviceName}:`, error);
    }
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.nextAttempt && new Date() < this.nextAttempt) {
        throw new Error(`Circuit breaker is open for ${this.serviceName}. Next attempt at ${this.nextAttempt.toISOString()}`);
      }
      // Transition to half-open
      this.state = 'half_open';
      this.successCount = 0;
      await this.saveState();
    }

    try {
      const result = await operation();
      await this.recordSuccess();
      return result;
    } catch (error) {
      await this.recordFailure();
      throw error;
    }
  }

  /**
   * Record successful operation
   */
  private async recordSuccess(): Promise<void> {
    this.lastSuccess = new Date();
    this.successCount++;

    if (this.state === 'half_open') {
      if (this.successCount >= this.config.success_threshold) {
        // Transition to closed
        this.state = 'closed';
        this.failureCount = 0;
        this.successCount = 0;
        this.nextAttempt = undefined;
      }
    }

    await this.saveState();
  }

  /**
   * Record failed operation
   */
  private async recordFailure(): Promise<void> {
    this.lastFailure = new Date();
    this.failureCount++;

    if (this.state === 'half_open' || this.state === 'closed') {
      if (this.failureCount >= this.config.failure_threshold) {
        // Transition to open
        this.state = 'open';
        this.nextAttempt = new Date(Date.now() + (this.config.timeout_seconds * 1000));
        this.successCount = 0;
      }
    }

    await this.saveState();
  }

  /**
   * Get current state
   */
  getState(): z.infer<typeof CircuitBreakerStateSchema> {
    return {
      service_name: this.serviceName,
      state: this.state,
      failure_count: this.failureCount,
      success_count: this.successCount,
      last_failure: this.lastFailure?.toISOString(),
      last_success: this.lastSuccess?.toISOString(),
      next_attempt: this.nextAttempt?.toISOString(),
    };
  }

  /**
   * Manually open circuit breaker
   */
  async open(): Promise<void> {
    this.state = 'open';
    this.nextAttempt = new Date(Date.now() + (this.config.timeout_seconds * 1000));
    await this.saveState();
  }

  /**
   * Manually close circuit breaker
   */
  async close(): Promise<void> {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = undefined;
    await this.saveState();
  }

  /**
   * Reset circuit breaker
   */
  async reset(): Promise<void> {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailure = undefined;
    this.lastSuccess = undefined;
    this.nextAttempt = undefined;
    await this.saveState();
  }

  /**
   * Check if circuit breaker is available
   */
  isAvailable(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'half_open') return true;
    if (this.state === 'open') {
      return this.nextAttempt ? new Date() >= this.nextAttempt : false;
    }
    return false;
  }

  /**
   * Get circuit breaker statistics
   */
  async getStats(): Promise<{
    total_circuits: number;
    by_state: Record<string, number>;
    top_failures: Array<{
      service_name: string;
      failure_count: number;
      last_failure: string;
    }>;
  }> {
    try {
      const { data, error } = await supabase
        .from('awf_circuit_breakers')
        .select('*');

      if (error) throw error;

      const by_state: Record<string, number> = {};
      const top_failures: Array<{
        service_name: string;
        failure_count: number;
        last_failure: string;
      }> = [];

      for (const circuit of data || []) {
        by_state[circuit.state] = (by_state[circuit.state] || 0) + 1;
        
        if (circuit.failure_count > 0) {
          top_failures.push({
            service_name: circuit.service_name,
            failure_count: circuit.failure_count,
            last_failure: circuit.last_failure || '',
          });
        }
      }

      return {
        total_circuits: data?.length || 0,
        by_state,
        top_failures: top_failures
          .sort((a, b) => b.failure_count - a.failure_count)
          .slice(0, 10),
      };
    } catch (error) {
      console.error('Failed to get circuit breaker stats:', error);
      return {
        total_circuits: 0,
        by_state: {},
        top_failures: [],
      };
    }
  }

  /**
   * Get configuration
   */
  getConfig(): z.infer<typeof CircuitBreakerConfigSchema> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<z.infer<typeof CircuitBreakerConfigSchema>>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Pre-configured circuit breakers for common services
export const modelProviderCircuit = CircuitBreaker.getInstance('model_provider', {
  failure_threshold: 3,
  success_threshold: 2,
  timeout_seconds: 30,
  half_open_timeout_seconds: 15,
});

export const redisCircuit = CircuitBreaker.getInstance('redis', {
  failure_threshold: 5,
  success_threshold: 3,
  timeout_seconds: 60,
  half_open_timeout_seconds: 30,
});

export const databaseCircuit = CircuitBreaker.getInstance('database', {
  failure_threshold: 5,
  success_threshold: 3,
  timeout_seconds: 120,
  half_open_timeout_seconds: 60,
});

export const supabaseCircuit = CircuitBreaker.getInstance('supabase', {
  failure_threshold: 5,
  success_threshold: 3,
  timeout_seconds: 90,
  half_open_timeout_seconds: 45,
});

// Utility function to wrap any async operation with circuit breaker
export async function withCircuitBreaker<T>(
  serviceName: string,
  operation: () => Promise<T>,
  config?: Partial<z.infer<typeof CircuitBreakerConfigSchema>>
): Promise<T> {
  const circuit = CircuitBreaker.getInstance(serviceName, config);
  return circuit.execute(operation);
}
