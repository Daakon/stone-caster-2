/**
 * SLO Monitoring and Alerting for AWF Pipeline
 * Phase 7: Production Rollout - Service Level Objectives
 */

export interface SLODefinition {
  name: string;
  description: string;
  metric: string;
  threshold: number;
  window: number; // minutes
  severity: 'warning' | 'critical';
}

export interface SLOAlert {
  slo: string;
  severity: 'warning' | 'critical';
  currentValue: number;
  threshold: number;
  window: number;
  timestamp: string;
  suggestedActions: string[];
}

export interface SLOMetrics {
  turnLatencyP95: number;
  invalidRetryRate: number;
  fallbackRate: number;
  totalTurns: number;
  retryTurns: number;
  fallbackTurns: number;
}

class AWFSLOMonitor {
  private slos: SLODefinition[];
  private metrics: SLOMetrics;
  private alertCallbacks: ((alert: SLOAlert) => void)[];

  constructor() {
    this.slos = this.initializeSLODefinitions();
    this.metrics = {
      turnLatencyP95: 0,
      invalidRetryRate: 0,
      fallbackRate: 0,
      totalTurns: 0,
      retryTurns: 0,
      fallbackTurns: 0
    };
    this.alertCallbacks = [];
  }

  private initializeSLODefinitions(): SLODefinition[] {
    return [
      {
        name: 'turn_latency_p95',
        description: '95th percentile turn latency',
        metric: 'awf.turn.latency_ms',
        threshold: parseInt(process.env.SLO_TURN_P95_MS || '8000', 10),
        window: 5,
        severity: 'warning'
      },
      {
        name: 'invalid_retry_rate',
        description: 'Percentage of turns requiring validator retry',
        metric: 'awf.validator.retries',
        threshold: parseFloat(process.env.SLO_INVALID_RETRY_RATE || '5.0'),
        window: 10,
        severity: 'warning'
      },
      {
        name: 'fallback_rate',
        description: 'Percentage of turns falling back to legacy',
        metric: 'awf.fallbacks.count',
        threshold: parseFloat(process.env.SLO_FALLBACK_RATE || '1.0'),
        window: 15,
        severity: 'critical'
      }
    ];
  }

  /**
   * Update metrics from AWF operations
   */
  updateMetrics(metrics: Partial<SLOMetrics>): void {
    this.metrics = { ...this.metrics, ...metrics };
    this.checkSLOs();
  }

  /**
   * Record a turn completion
   */
  recordTurn(latency: number, retried: boolean, fallback: boolean): void {
    this.metrics.totalTurns++;
    if (retried) this.metrics.retryTurns++;
    if (fallback) this.metrics.fallbackTurns++;
    
    // Update latency P95 (simplified calculation)
    this.metrics.turnLatencyP95 = Math.max(this.metrics.turnLatencyP95, latency);
    
    // Update rates
    this.metrics.invalidRetryRate = (this.metrics.retryTurns / this.metrics.totalTurns) * 100;
    this.metrics.fallbackRate = (this.metrics.fallbackTurns / this.metrics.totalTurns) * 100;
    
    this.checkSLOs();
  }

  /**
   * Check all SLOs and trigger alerts if needed
   */
  private checkSLOs(): void {
    for (const slo of this.slos) {
      const alert = this.checkSLO(slo);
      if (alert) {
        this.triggerAlert(alert);
      }
    }
  }

  /**
   * Check a specific SLO
   */
  private checkSLO(slo: SLODefinition): SLOAlert | null {
    let currentValue: number;
    let threshold: number;

    switch (slo.name) {
      case 'turn_latency_p95':
        currentValue = this.metrics.turnLatencyP95;
        threshold = slo.threshold;
        break;
      case 'invalid_retry_rate':
        currentValue = this.metrics.invalidRetryRate;
        threshold = slo.threshold;
        break;
      case 'fallback_rate':
        currentValue = this.metrics.fallbackRate;
        threshold = slo.threshold;
        break;
      default:
        return null;
    }

    if (currentValue > threshold) {
      return {
        slo: slo.name,
        severity: slo.severity,
        currentValue,
        threshold,
        window: slo.window,
        timestamp: new Date().toISOString(),
        suggestedActions: this.getSuggestedActions(slo.name, currentValue, threshold)
      };
    }

    return null;
  }

  /**
   * Get suggested actions for SLO violations
   */
  private getSuggestedActions(sloName: string, currentValue: number, threshold: number): string[] {
    const actions: string[] = [];

    switch (sloName) {
      case 'turn_latency_p95':
        actions.push('Investigate model provider latency');
        actions.push('Check bundle size and token counts');
        actions.push('Consider reducing AWF_PERCENT_ROLLOUT');
        break;
      case 'invalid_retry_rate':
        actions.push('Review validator rules and thresholds');
        actions.push('Check model output quality');
        actions.push('Consider adjusting AWF_MODEL_TEMPERATURE');
        break;
      case 'fallback_rate':
        actions.push('Investigate consecutive validation failures');
        actions.push('Check model provider health');
        actions.push('Consider reducing AWF_PERCENT_ROLLOUT to 0');
        break;
    }

    return actions;
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(alert: SLOAlert): void {
    console.warn(`[SLO Alert] ${alert.severity.toUpperCase()}: ${alert.slo}`, {
      currentValue: alert.currentValue,
      threshold: alert.threshold,
      suggestedActions: alert.suggestedActions
    });

    // Call registered alert callbacks
    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (error) {
        console.error('[SLO Alert] Error in alert callback:', error);
      }
    }
  }

  /**
   * Register an alert callback
   */
  onAlert(callback: (alert: SLOAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Get current SLO status
   */
  getStatus(): {
    slos: Array<{
      name: string;
      currentValue: number;
      threshold: number;
      status: 'healthy' | 'warning' | 'critical';
    }>;
    metrics: SLOMetrics;
  } {
    const sloStatus = this.slos.map(slo => {
      let currentValue: number;
      switch (slo.name) {
        case 'turn_latency_p95':
          currentValue = this.metrics.turnLatencyP95;
          break;
        case 'invalid_retry_rate':
          currentValue = this.metrics.invalidRetryRate;
          break;
        case 'fallback_rate':
          currentValue = this.metrics.fallbackRate;
          break;
        default:
          currentValue = 0;
      }

      const status: 'healthy' | 'warning' | 'critical' = currentValue > slo.threshold 
        ? (slo.severity === 'critical' ? 'critical' : 'warning')
        : 'healthy';

      return {
        name: slo.name,
        currentValue,
        threshold: slo.threshold,
        status
      };
    });

    return {
      slos: sloStatus,
      metrics: this.metrics
    };
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      turnLatencyP95: 0,
      invalidRetryRate: 0,
      fallbackRate: 0,
      totalTurns: 0,
      retryTurns: 0,
      fallbackTurns: 0
    };
  }
}

// Global instance
let globalSLOMonitor: AWFSLOMonitor | null = null;

export function getSLOMonitor(): AWFSLOMonitor {
  if (!globalSLOMonitor) {
    globalSLOMonitor = new AWFSLOMonitor();
  }
  return globalSLOMonitor;
}

export function initializeSLOMonitor(): AWFSLOMonitor {
  globalSLOMonitor = new AWFSLOMonitor();
  return globalSLOMonitor;
}
