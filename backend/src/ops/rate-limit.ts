// Phase 25: Rate Limiting System
// Sliding window counters with per-scope keys (user/session/device/IP)

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Rate limit configuration schemas
const RateLimitConfigSchema = z.object({
  scope: z.enum(['user', 'session', 'device', 'ip', 'global']),
  key: z.string(),
  window_seconds: z.number().min(1),
  max_requests: z.number().min(1),
  burst_limit: z.number().min(0).optional(),
});

const RateLimitResultSchema = z.object({
  allowed: z.boolean(),
  remaining: z.number(),
  reset_time: z.number(),
  retry_after: z.number().optional(),
});

export class RateLimiter {
  private static instance: RateLimiter;
  private config: Map<string, any> = new Map();

  constructor() {
    this.loadConfig();
  }

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  private loadConfig(): void {
    // Load rate limit configuration from environment
    this.config.set('global', {
      window_seconds: parseInt(process.env.OPS_GLOBAL_TURN_RPS || '60'),
      max_requests: parseInt(process.env.OPS_GLOBAL_TURN_RPS || '200'),
      burst_limit: 50,
    });

    this.config.set('user', {
      window_seconds: 60,
      max_requests: parseInt(process.env.OPS_PER_USER_TPM || '120'),
      burst_limit: 20,
    });

    this.config.set('session', {
      window_seconds: 60,
      max_requests: parseInt(process.env.OPS_PER_SESSION_TPM || '60'),
      burst_limit: 10,
    });

    this.config.set('device', {
      window_seconds: 60,
      max_requests: 30,
      burst_limit: 5,
    });

    this.config.set('ip', {
      window_seconds: 60,
      max_requests: 100,
      burst_limit: 20,
    });
  }

  /**
   * Check if request is allowed for the given scope and key
   */
  async checkRateLimit(
    scope: 'user' | 'session' | 'device' | 'ip' | 'global',
    key: string,
    customConfig?: Partial<z.infer<typeof RateLimitConfigSchema>>
  ): Promise<z.infer<typeof RateLimitResultSchema>> {
    try {
      const config = { ...this.config.get(scope), ...customConfig };
      
      if (!config) {
        throw new Error(`No configuration found for scope: ${scope}`);
      }

      // Use database function for rate limiting
      const { data, error } = await supabase.rpc('check_rate_limit', {
        p_scope: scope,
        p_key: key,
        p_window_seconds: config.window_seconds,
        p_max_requests: config.max_requests,
      });

      if (error) throw error;

      const allowed = data as boolean;
      const remaining = allowed ? config.max_requests - 1 : 0;
      const reset_time = Date.now() + (config.window_seconds * 1000);
      const retry_after = allowed ? undefined : config.window_seconds;

      return {
        allowed,
        remaining,
        reset_time,
        retry_after,
      };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // Fail open - allow request if rate limiting fails
      return {
        allowed: true,
        remaining: 999,
        reset_time: Date.now() + 60000,
      };
    }
  }

  /**
   * Check multiple rate limits simultaneously
   */
  async checkMultipleRateLimits(
    checks: Array<{
      scope: 'user' | 'session' | 'device' | 'ip' | 'global';
      key: string;
      customConfig?: Partial<z.infer<typeof RateLimitConfigSchema>>;
    }>
  ): Promise<Array<z.infer<typeof RateLimitResultSchema>>> {
    const promises = checks.map(check => 
      this.checkRateLimit(check.scope, check.key, check.customConfig)
    );
    
    return Promise.all(promises);
  }

  /**
   * Get current rate limit status for a key
   */
  async getRateLimitStatus(
    scope: 'user' | 'session' | 'device' | 'ip' | 'global',
    key: string
  ): Promise<{
    current_count: number;
    max_requests: number;
    window_start: string;
    remaining: number;
    reset_in_seconds: number;
  } | null> {
    try {
      const { data, error } = await supabase
        .from('awf_rate_limits')
        .select('*')
        .eq('scope', scope)
        .eq('key', key)
        .single();

      if (error) throw error;
      if (!data) return null;

      const config = this.config.get(scope);
      const window_start = new Date(data.window_start);
      const now = new Date();
      const window_end = new Date(window_start.getTime() + (config.window_seconds * 1000));
      
      const reset_in_seconds = Math.max(0, Math.ceil((window_end.getTime() - now.getTime()) / 1000));
      const remaining = Math.max(0, config.max_requests - data.current_count);

      return {
        current_count: data.current_count,
        max_requests: config.max_requests,
        window_start: data.window_start,
        remaining,
        reset_in_seconds,
      };
    } catch (error) {
      console.error('Failed to get rate limit status:', error);
      return null;
    }
  }

  /**
   * Reset rate limit for a specific key
   */
  async resetRateLimit(
    scope: 'user' | 'session' | 'device' | 'ip' | 'global',
    key: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('awf_rate_limits')
        .update({
          current_count: 0,
          window_start: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('scope', scope)
        .eq('key', key);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to reset rate limit:', error);
      return false;
    }
  }

  /**
   * Get rate limit statistics
   */
  async getRateLimitStats(): Promise<{
    total_limits: number;
    by_scope: Record<string, number>;
    top_limited: Array<{
      scope: string;
      key: string;
      current_count: number;
      max_requests: number;
    }>;
  }> {
    try {
      const { data: allLimits, error } = await supabase
        .from('awf_rate_limits')
        .select('*');

      if (error) throw error;

      const by_scope: Record<string, number> = {};
      const top_limited: Array<{
        scope: string;
        key: string;
        current_count: number;
        max_requests: number;
      }> = [];

      for (const limit of allLimits || []) {
        by_scope[limit.scope] = (by_scope[limit.scope] || 0) + 1;
        
        if (limit.current_count >= limit.max_requests * 0.8) {
          top_limited.push({
            scope: limit.scope,
            key: limit.key,
            current_count: limit.current_count,
            max_requests: limit.max_requests,
          });
        }
      }

      return {
        total_limits: allLimits?.length || 0,
        by_scope,
        top_limited: top_limited.sort((a, b) => b.current_count - a.current_count).slice(0, 10),
      };
    } catch (error) {
      console.error('Failed to get rate limit stats:', error);
      return {
        total_limits: 0,
        by_scope: {},
        top_limited: [],
      };
    }
  }

  /**
   * Update rate limit configuration
   */
  async updateRateLimitConfig(
    scope: 'user' | 'session' | 'device' | 'ip' | 'global',
    config: {
      window_seconds?: number;
      max_requests?: number;
      burst_limit?: number;
    }
  ): Promise<boolean> {
    try {
      this.config.set(scope, { ...this.config.get(scope), ...config });
      return true;
    } catch (error) {
      console.error('Failed to update rate limit config:', error);
      return false;
    }
  }

  /**
   * Clean up expired rate limit records
   */
  async cleanupExpiredRecords(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('awf_rate_limits')
        .delete()
        .lt('window_start', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .select('id');

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      console.error('Failed to cleanup expired records:', error);
      return 0;
    }
  }

  /**
   * Get rate limit configuration
   */
  getConfig(): Record<string, any> {
    return Object.fromEntries(this.config);
  }
}

export const rateLimiter = RateLimiter.getInstance();
