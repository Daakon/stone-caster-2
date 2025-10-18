/**
 * Canary Rollout Controls for AWF Pipeline
 * Phase 7: Production Rollout - Percentage-based enablement with overrides
 */

import { createHash } from 'crypto';

export interface RolloutConfig {
  globalEnabled: boolean;
  percentRollout: number; // 0-100
  userOverrides: Map<string, boolean>;
  sessionOverrides: Map<string, boolean>;
}

export interface RolloutDecision {
  enabled: boolean;
  reason: 'global_disabled' | 'percent_bucket' | 'user_override' | 'session_override' | 'global_enabled';
  bucket?: number;
  override?: boolean;
}

class CanaryRolloutManager {
  private config: RolloutConfig;
  private auditLogger: (action: string, details: any) => void;

  constructor(auditLogger?: (action: string, details: any) => void) {
    this.config = {
      globalEnabled: false,
      percentRollout: 0,
      userOverrides: new Map(),
      sessionOverrides: new Map()
    };
    this.auditLogger = auditLogger || (() => {});
  }

  /**
   * Check if AWF is enabled for a given context
   */
  isEnabled(context: { sessionId?: string; userId?: string }): RolloutDecision {
    const { sessionId, userId } = context;

    // Check session override first (highest priority)
    if (sessionId && this.config.sessionOverrides.has(sessionId)) {
      const override = this.config.sessionOverrides.get(sessionId)!;
      this.auditLogger('rollout_check', {
        sessionId,
        userId,
        decision: 'session_override',
        enabled: override
      });
      return {
        enabled: override,
        reason: 'session_override',
        override
      };
    }

    // Check user override
    if (userId && this.config.userOverrides.has(userId)) {
      const override = this.config.userOverrides.get(userId)!;
      this.auditLogger('rollout_check', {
        sessionId,
        userId,
        decision: 'user_override',
        enabled: override
      });
      return {
        enabled: override,
        reason: 'user_override',
        override
      };
    }

    // Check global enabled
    if (!this.config.globalEnabled) {
      this.auditLogger('rollout_check', {
        sessionId,
        userId,
        decision: 'global_disabled',
        enabled: false
      });
      return {
        enabled: false,
        reason: 'global_disabled'
      };
    }

    // Check percentage rollout
    if (this.config.percentRollout > 0) {
      const bucket = this.getBucketForContext(context);
      const enabled = bucket < this.config.percentRollout;
      
      this.auditLogger('rollout_check', {
        sessionId,
        userId,
        decision: 'percent_bucket',
        enabled,
        bucket,
        percentRollout: this.config.percentRollout
      });
      
      return {
        enabled,
        reason: 'percent_bucket',
        bucket
      };
    }

    // If percent rollout is 0, return false
    if (this.config.percentRollout === 0) {
      this.auditLogger('rollout_check', {
        sessionId,
        userId,
        decision: 'percent_bucket',
        enabled: false,
        bucket: 0,
        percentRollout: 0
      });
      
      return {
        enabled: false,
        reason: 'percent_bucket',
        bucket: 0
      };
    }

    // If percent rollout is not set (undefined or -1), use global enabled
    if (this.config.percentRollout === undefined || this.config.percentRollout === -1) {
      this.auditLogger('rollout_check', {
        sessionId,
        userId,
        decision: 'global_enabled',
        enabled: true
      });
      
      return {
        enabled: true,
        reason: 'global_enabled'
      };
    }

    // Global enabled (fallback for when percent rollout is not set)
    this.auditLogger('rollout_check', {
      sessionId,
      userId,
      decision: 'global_enabled',
      enabled: true
    });
    
    return {
      enabled: true,
      reason: 'global_enabled'
    };
  }

  /**
   * Get consistent bucket number for a context (0-99)
   */
  private getBucketForContext(context: { sessionId?: string; userId?: string }): number {
    const { sessionId, userId } = context;
    
    // Prefer userId for consistent bucketing across sessions
    const identifier = userId || sessionId || 'anonymous';
    
    // Create consistent hash
    const hash = createHash('md5').update(identifier).digest('hex');
    const hashInt = parseInt(hash.substring(0, 8), 16);
    
    // Return bucket 0-99
    return hashInt % 100;
  }

  /**
   * Set global AWF enablement
   */
  setGlobalEnabled(enabled: boolean, actor: string): void {
    const previous = this.config.globalEnabled;
    this.config.globalEnabled = enabled;
    
    this.auditLogger('global_flag_change', {
      actor,
      previous,
      current: enabled,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Set percentage rollout (0-100)
   */
  setPercentRollout(percent: number, actor: string): void {
    if (percent < 0 || percent > 100) {
      throw new Error('Percent rollout must be between 0 and 100');
    }
    
    const previous = this.config.percentRollout;
    this.config.percentRollout = percent;
    
    this.auditLogger('percent_rollout_change', {
      actor,
      previous,
      current: percent,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Set user override
   */
  setUserOverride(userId: string, enabled: boolean, actor: string): void {
    const previous = this.config.userOverrides.get(userId);
    this.config.userOverrides.set(userId, enabled);
    
    this.auditLogger('user_override_change', {
      actor,
      userId,
      previous,
      current: enabled,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Set session override
   */
  setSessionOverride(sessionId: string, enabled: boolean, actor: string): void {
    const previous = this.config.sessionOverrides.get(sessionId);
    this.config.sessionOverrides.set(sessionId, enabled);
    
    this.auditLogger('session_override_change', {
      actor,
      sessionId,
      previous,
      current: enabled,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Clear user override
   */
  clearUserOverride(userId: string, actor: string): void {
    const previous = this.config.userOverrides.get(userId);
    this.config.userOverrides.delete(userId);
    
    this.auditLogger('user_override_clear', {
      actor,
      userId,
      previous,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Clear session override
   */
  clearSessionOverride(sessionId: string, actor: string): void {
    const previous = this.config.sessionOverrides.get(sessionId);
    this.config.sessionOverrides.delete(sessionId);
    
    this.auditLogger('session_override_clear', {
      actor,
      sessionId,
      previous,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get current rollout status
   */
  getStatus(): {
    globalEnabled: boolean;
    percentRollout: number;
    userOverrideCount: number;
    sessionOverrideCount: number;
  } {
    return {
      globalEnabled: this.config.globalEnabled,
      percentRollout: this.config.percentRollout,
      userOverrideCount: this.config.userOverrides.size,
      sessionOverrideCount: this.config.sessionOverrides.size
    };
  }

  /**
   * Get rollout statistics
   */
  getStats(): {
    totalUsers: number;
    enabledUsers: number;
    disabledUsers: number;
    bucketDistribution: Record<string, number>;
  } {
    // This would typically query a database for real statistics
    // For now, return mock data
    return {
      totalUsers: 1000,
      enabledUsers: Math.floor(1000 * this.config.percentRollout / 100),
      disabledUsers: 1000 - Math.floor(1000 * this.config.percentRollout / 100),
      bucketDistribution: this.getBucketDistribution()
    };
  }

  private getBucketDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    // Simulate bucket distribution
    for (let i = 0; i < 10; i++) {
      distribution[`${i * 10}-${(i + 1) * 10 - 1}`] = 10;
    }
    
    return distribution;
  }
}

// Global instance
let globalRolloutManager: CanaryRolloutManager | null = null;

export function getRolloutManager(): CanaryRolloutManager {
  if (!globalRolloutManager) {
    globalRolloutManager = new CanaryRolloutManager();
  }
  return globalRolloutManager;
}

export function initializeRolloutManager(auditLogger?: (action: string, details: any) => void): CanaryRolloutManager {
  globalRolloutManager = new CanaryRolloutManager(auditLogger);
  return globalRolloutManager;
}

// Environment-based configuration
export function loadRolloutConfig(): RolloutConfig {
  return {
    globalEnabled: process.env.AWF_BUNDLE_ON === 'true',
    percentRollout: parseInt(process.env.AWF_PERCENT_ROLLOUT || '0', 10),
    userOverrides: new Map(),
    sessionOverrides: new Map()
  };
}
