/**
 * Audit Logging for AWF Pipeline
 * Phase 7: Production Rollout - Admin Action Tracking
 */

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  entity: string;
  details: Record<string, any>;
  createdAt: string;
}

export interface AuditLogFilter {
  actor?: string;
  action?: string;
  entity?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

class AuditLogger {
  private logs: AuditLogEntry[] = [];
  private maxLogs: number = 10000; // Keep last 10k entries

  /**
   * Log an audit event
   */
  log(actor: string, action: string, entity: string, details: Record<string, any> = {}): void {
    const entry: AuditLogEntry = {
      id: this.generateId(),
      actor,
      action,
      entity,
      details,
      createdAt: new Date().toISOString()
    };

    this.logs.push(entry);

    // Trim logs if over limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Log to console for immediate visibility
    console.log(`[Audit] ${actor} ${action} ${entity}`, details);
  }

  /**
   * Get audit logs with optional filtering
   */
  getLogs(filter: AuditLogFilter = {}): AuditLogEntry[] {
    let filtered = [...this.logs];

    if (filter.actor) {
      filtered = filtered.filter(log => log.actor === filter.actor);
    }

    if (filter.action) {
      filtered = filtered.filter(log => log.action === filter.action);
    }

    if (filter.entity) {
      filtered = filtered.filter(log => log.entity === filter.entity);
    }

    if (filter.startDate) {
      filtered = filtered.filter(log => log.createdAt >= filter.startDate!);
    }

    if (filter.endDate) {
      filtered = filtered.filter(log => log.createdAt <= filter.endDate!);
    }

    if (filter.limit) {
      filtered = filtered.slice(-filter.limit);
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Get recent audit logs (last 100 entries)
   */
  getRecentLogs(): AuditLogEntry[] {
    return this.getLogs({ limit: 100 });
  }

  /**
   * Get audit logs for a specific actor
   */
  getLogsByActor(actor: string, limit: number = 50): AuditLogEntry[] {
    return this.getLogs({ actor, limit });
  }

  /**
   * Get audit logs for a specific action
   */
  getLogsByAction(action: string, limit: number = 50): AuditLogEntry[] {
    return this.getLogs({ action, limit });
  }

  /**
   * Get audit logs for flag changes
   */
  getFlagChangeLogs(limit: number = 50): AuditLogEntry[] {
    return this.getLogs({ 
      action: 'flag_change',
      limit 
    });
  }

  /**
   * Get audit logs for rollout changes
   */
  getRolloutChangeLogs(limit: number = 50): AuditLogEntry[] {
    return this.getLogs({ 
      action: 'rollout_change',
      limit 
    });
  }

  /**
   * Get audit logs for override changes
   */
  getOverrideChangeLogs(limit: number = 50): AuditLogEntry[] {
    return this.getLogs({ 
      action: 'override_change',
      limit 
    });
  }

  /**
   * Clear all audit logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Get audit statistics
   */
  getStats(): {
    totalLogs: number;
    logsByAction: Record<string, number>;
    logsByActor: Record<string, number>;
    recentActivity: number; // logs in last hour
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const logsByAction: Record<string, number> = {};
    const logsByActor: Record<string, number> = {};
    let recentActivity = 0;

    for (const log of this.logs) {
      // Count by action
      logsByAction[log.action] = (logsByAction[log.action] || 0) + 1;
      
      // Count by actor
      logsByActor[log.actor] = (logsByActor[log.actor] || 0) + 1;
      
      // Count recent activity
      if (new Date(log.createdAt) > oneHourAgo) {
        recentActivity++;
      }
    }

    return {
      totalLogs: this.logs.length,
      logsByAction,
      logsByActor,
      recentActivity
    };
  }

  /**
   * Generate unique ID for audit log entry
   */
  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global instance
let globalAuditLogger: AuditLogger | null = null;

export function getAuditLogger(): AuditLogger {
  if (!globalAuditLogger) {
    globalAuditLogger = new AuditLogger();
  }
  return globalAuditLogger;
}

export function initializeAuditLogger(): AuditLogger {
  globalAuditLogger = new AuditLogger();
  return globalAuditLogger;
}

// Convenience functions for common audit events
export function auditFlagChange(actor: string, flag: string, previous: any, current: any): void {
  const logger = getAuditLogger();
  logger.log(actor, 'flag_change', flag, {
    previous,
    current,
    changeType: 'flag_update'
  });
}

export function auditRolloutChange(actor: string, percent: number, previous: number): void {
  const logger = getAuditLogger();
  logger.log(actor, 'rollout_change', 'awf_rollout', {
    previous,
    current: percent,
    changeType: 'percent_rollout'
  });
}

export function auditOverrideChange(actor: string, type: 'user' | 'session', id: string, enabled: boolean, previous?: boolean): void {
  const logger = getAuditLogger();
  logger.log(actor, 'override_change', `${type}_override`, {
    id,
    previous,
    current: enabled,
    changeType: `${type}_override`
  });
}

export function auditSLOAlert(actor: string, slo: string, severity: string, details: any): void {
  const logger = getAuditLogger();
  logger.log(actor, 'slo_alert', slo, {
    severity,
    details,
    changeType: 'slo_violation'
  });
}


