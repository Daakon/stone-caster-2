/**
 * AWF Mode Configuration
 * Phase 8: Legacy Decommission - Unified mode control
 */

export type AwfMode = "legacy" | "awf" | "mixed";

export interface AwfModeConfig {
  mode: AwfMode;
  emergencyLegacy: boolean;
  sessionOverrides: Map<string, boolean>;
  userOverrides: Map<string, boolean>;
}

class AwfModeManager {
  private config: AwfModeConfig;
  private auditLogger: (action: string, details: any) => void;

  constructor(auditLogger?: (action: string, details: any) => void) {
    this.config = {
      mode: this.loadModeFromEnv(),
      emergencyLegacy: process.env.AWF_EMERGENCY_LEGACY === 'true',
      sessionOverrides: new Map(),
      userOverrides: new Map()
    };
    this.auditLogger = auditLogger || (() => {});
  }

  private loadModeFromEnv(): AwfMode {
    const mode = process.env.AWF_MODE || 'awf';
    if (mode === 'legacy' || mode === 'awf' || mode === 'mixed') {
      return mode;
    }
    console.warn(`[AWF Mode] Invalid AWF_MODE "${mode}", defaulting to "awf"`);
    return 'awf';
  }

  /**
   * Check if AWF is enabled for a given context
   */
  isAwfEnabled(context: { sessionId?: string; userId?: string }): boolean {
    const { sessionId, userId } = context;

    // Emergency legacy override (highest priority)
    if (this.config.emergencyLegacy) {
      this.auditLogger('emergency_legacy_triggered', {
        sessionId,
        userId,
        reason: 'AWF_EMERGENCY_LEGACY=true'
      });
      console.error('[AWF Mode] CRITICAL: Emergency legacy mode activated!');
      return false;
    }

    // Check session override
    if (sessionId && this.config.sessionOverrides.has(sessionId)) {
      const override = this.config.sessionOverrides.get(sessionId)!;
      this.auditLogger('session_override', {
        sessionId,
        userId,
        enabled: override,
        reason: 'session_override'
      });
      return override;
    }

    // Check user override
    if (userId && this.config.userOverrides.has(userId)) {
      const override = this.config.userOverrides.get(userId)!;
      this.auditLogger('user_override', {
        sessionId,
        userId,
        enabled: override,
        reason: 'user_override'
      });
      return override;
    }

    // Mode-based decision
    switch (this.config.mode) {
      case 'legacy':
        this.auditLogger('mode_decision', {
          sessionId,
          userId,
          enabled: false,
          reason: 'mode_legacy'
        });
        return false;
      
      case 'awf':
        this.auditLogger('mode_decision', {
          sessionId,
          userId,
          enabled: true,
          reason: 'mode_awf'
        });
        return true;
      
      case 'mixed':
        // In mixed mode, use canary rollout logic
        return this.getCanaryDecision(context);
      
      default:
        console.warn(`[AWF Mode] Unknown mode "${this.config.mode}", defaulting to AWF`);
        return true;
    }
  }

  private getCanaryDecision(context: { sessionId?: string; userId?: string }): boolean {
    // Simplified canary logic for mixed mode
    const { sessionId, userId } = context;
    const identifier = userId || sessionId || 'anonymous';
    
    // Simple hash-based bucketing (50% for mixed mode)
    const hash = this.simpleHash(identifier);
    const bucket = hash % 100;
    const enabled = bucket < 50; // 50% rollout in mixed mode
    
    this.auditLogger('canary_decision', {
      sessionId,
      userId,
      enabled,
      bucket,
      reason: 'mixed_mode_canary'
    });
    
    return enabled;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Set AWF mode
   */
  setMode(mode: AwfMode, actor: string): void {
    const previous = this.config.mode;
    this.config.mode = mode;
    
    this.auditLogger('mode_change', {
      actor,
      previous,
      current: mode,
      timestamp: new Date().toISOString()
    });
    
    console.log(`[AWF Mode] Mode changed from "${previous}" to "${mode}" by ${actor}`);
  }

  /**
   * Set emergency legacy flag
   */
  setEmergencyLegacy(enabled: boolean, actor: string): void {
    const previous = this.config.emergencyLegacy;
    this.config.emergencyLegacy = enabled;
    
    this.auditLogger('emergency_legacy_change', {
      actor,
      previous,
      current: enabled,
      timestamp: new Date().toISOString()
    });
    
    if (enabled) {
      console.error(`[AWF Mode] CRITICAL: Emergency legacy mode activated by ${actor}`);
    } else {
      console.log(`[AWF Mode] Emergency legacy mode deactivated by ${actor}`);
    }
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
   * Get current configuration
   */
  getConfig(): AwfModeConfig {
    return { ...this.config };
  }

  /**
   * Get status summary
   */
  getStatus(): {
    mode: AwfMode;
    emergencyLegacy: boolean;
    sessionOverrideCount: number;
    userOverrideCount: number;
    isAwfDefault: boolean;
  } {
    return {
      mode: this.config.mode,
      emergencyLegacy: this.config.emergencyLegacy,
      sessionOverrideCount: this.config.sessionOverrides.size,
      userOverrideCount: this.config.userOverrides.size,
      isAwfDefault: this.config.mode === 'awf' && !this.config.emergencyLegacy
    };
  }
}

// Global instance
let globalAwfModeManager: AwfModeManager | null = null;

export function getAwfModeManager(): AwfModeManager {
  if (!globalAwfModeManager) {
    globalAwfModeManager = new AwfModeManager();
  }
  return globalAwfModeManager;
}

export function initializeAwfModeManager(auditLogger?: (action: string, details: any) => void): AwfModeManager {
  globalAwfModeManager = new AwfModeManager(auditLogger);
  return globalAwfModeManager;
}

// Convenience function for backward compatibility
export function isAwfEnabled(context: { sessionId?: string; userId?: string }): boolean {
  const manager = getAwfModeManager();
  return manager.isAwfEnabled(context);
}


