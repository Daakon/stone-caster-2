/**
 * AWF Metrics System
 * Phase 6: Performance & Cost Controls - Observability and monitoring
 */

export interface MetricLabels {
  sessionId?: string;
  turnId?: number;
  environment?: string;
  model?: string;
  [key: string]: string | number | undefined;
}

export interface MetricValue {
  value: number;
  labels?: MetricLabels;
  timestamp?: number;
}

export interface P95Metric {
  name: string;
  p95: number;
  count: number;
  window: number; // window size in turns
}

export interface AWFMetrics {
  // Bundle metrics
  bundleBytes: number;
  bundleTokensEst: number;
  
  // Model metrics
  modelLatencyMs: number;
  modelOutputTokensEst: number;
  
  // Turn metrics
  turnLatencyMs: number;
  
  // Validator metrics
  validatorRetries: number;
  
  // Fallback metrics
  fallbacksCount: number;
  
  // Tool call metrics
  toolCalls: {
    count: number;
    denied: number;
    tokensReturned: number;
    cacheHits: number;
  };
  
  // Act summary counts
  actSummary: {
    relChanges: number;
    objectives: number;
    flags: number;
    resources: number;
    memoryAdded: number;
    memoryPinned: number;
    memoryTrimmed: number;
  };
}

export interface StructuredLogEntry {
  sessionId: string;
  turnId: number;
  bundleTokens: number;
  outputTokens: number;
  retries: number;
  reductions: string[];
  actSummary: {
    relChanges: number;
    objectives: number;
    flags: number;
    resources: number;
    memoryAdded: number;
    memoryPinned: number;
    memoryTrimmed: number;
  };
  timestamp: string;
  environment: string;
}

/**
 * Metrics collector for AWF operations
 */
export class AWFMetricsCollector {
  private counters = new Map<string, number>();
  private timers = new Map<string, number[]>();
  private gauges = new Map<string, number>();
  private p95Windows = new Map<string, number[]>();
  private maxWindowSize = 100; // Keep last 100 measurements for p95

  /**
   * Record a counter metric
   */
  recordCounter(name: string, value: number, labels?: MetricLabels): void {
    const key = this.buildKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
    
    console.log(`[Metrics] Counter ${name}: +${value} (total: ${current + value})`, labels);
  }

  /**
   * Record a timer metric
   */
  recordTimer(name: string, ms: number, labels?: MetricLabels): void {
    const key = this.buildKey(name, labels);
    const times = this.timers.get(key) || [];
    times.push(ms);
    
    // Keep only recent measurements
    if (times.length > this.maxWindowSize) {
      times.shift();
    }
    this.timers.set(key, times);
    
    console.log(`[Metrics] Timer ${name}: ${ms}ms`, labels);
  }

  /**
   * Record a gauge metric
   */
  recordGauge(name: string, value: number, labels?: MetricLabels): void {
    const key = this.buildKey(name, labels);
    this.gauges.set(key, value);
    
    console.log(`[Metrics] Gauge ${name}: ${value}`, labels);
  }

  /**
   * Record AWF turn metrics
   */
  recordAWFTurn(metrics: AWFMetrics, labels?: MetricLabels): void {
    // Bundle metrics
    this.recordGauge('awf.bundle.bytes', metrics.bundleBytes, labels);
    this.recordGauge('awf.bundle.tokens_est', metrics.bundleTokensEst, labels);
    
    // Model metrics
    this.recordTimer('awf.model.latency_ms', metrics.modelLatencyMs, labels);
    this.recordGauge('awf.model.output_tokens_est', metrics.modelOutputTokensEst, labels);
    
    // Turn metrics
    this.recordTimer('awf.turn.latency_ms', metrics.turnLatencyMs, labels);
    
    // Validator metrics
    this.recordCounter('awf.validator.retries', metrics.validatorRetries, labels);
    
    // Fallback metrics
    this.recordCounter('awf.fallbacks.count', metrics.fallbacksCount, labels);
    
    // Act summary metrics
    this.recordCounter('awf.acts.rel_changes', metrics.actSummary.relChanges, labels);
    this.recordCounter('awf.acts.objectives', metrics.actSummary.objectives, labels);
    this.recordCounter('awf.acts.flags', metrics.actSummary.flags, labels);
    this.recordCounter('awf.acts.resources', metrics.actSummary.resources, labels);
    this.recordCounter('awf.acts.memory_added', metrics.actSummary.memoryAdded, labels);
    this.recordCounter('awf.acts.memory_pinned', metrics.actSummary.memoryPinned, labels);
    this.recordCounter('awf.acts.memory_trimmed', metrics.actSummary.memoryTrimmed, labels);
  }

  /**
   * Record structured log entry
   */
  recordStructuredLog(entry: StructuredLogEntry): void {
    console.log('[AWF Turn]', JSON.stringify(entry));
  }

  /**
   * Get p95 value for a metric
   */
  getP95(metricName: string, labels?: MetricLabels): number | null {
    const key = this.buildKey(metricName, labels);
    const values = this.timers.get(key);
    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[index];
  }

  /**
   * Get all p95 metrics
   */
  getAllP95(): P95Metric[] {
    const p95Metrics: P95Metric[] = [];
    
    for (const [key, values] of this.timers.entries()) {
      if (values.length > 0) {
        const sorted = [...values].sort((a, b) => a - b);
        const p95Index = Math.ceil(sorted.length * 0.95) - 1;
        const p95 = sorted[p95Index];
        
        p95Metrics.push({
          name: key,
          p95,
          count: values.length,
          window: values.length
        });
      }
    }
    
    return p95Metrics;
  }

  /**
   * Get current counter values
   */
  getCounters(): Map<string, number> {
    return new Map(this.counters);
  }

  /**
   * Get current gauge values
   */
  getGauges(): Map<string, number> {
    return new Map(this.gauges);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.counters.clear();
    this.timers.clear();
    this.gauges.clear();
    this.p95Windows.clear();
  }

  /**
   * Get metrics summary
   */
  getSummary(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    p95Metrics: P95Metric[];
  } {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      p95Metrics: this.getAllP95()
    };
  }

  private buildKey(name: string, labels?: MetricLabels): string {
    if (!labels) {
      return name;
    }
    
    const labelParts = Object.entries(labels)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${value}`)
      .sort();
    
    return labelParts.length > 0 ? `${name}{${labelParts.join(',')}}` : name;
  }
}

/**
 * Global metrics collector instance
 */
export const awfMetrics = new AWFMetricsCollector();

/**
 * Utility functions for common metrics
 */
export class AWFMetricsUtils {
  /**
   * Record bundle assembly metrics
   */
  static recordBundleAssembly(
    sessionId: string,
    bundleBytes: number,
    bundleTokens: number,
    assemblyTimeMs: number
  ): void {
    awfMetrics.recordGauge('awf.bundle.bytes', bundleBytes, { sessionId });
    awfMetrics.recordGauge('awf.bundle.tokens_est', bundleTokens, { sessionId });
    awfMetrics.recordTimer('awf.bundle.assembly_ms', assemblyTimeMs, { sessionId });
  }

  /**
   * Record model inference metrics
   */
  static recordModelInference(
    sessionId: string,
    model: string,
    latencyMs: number,
    outputTokens: number
  ): void {
    awfMetrics.recordTimer('awf.model.latency_ms', latencyMs, { sessionId, model });
    awfMetrics.recordGauge('awf.model.output_tokens_est', outputTokens, { sessionId, model });
  }

  /**
   * Record validation metrics
   */
  static recordValidation(
    sessionId: string,
    retries: number,
    validationTimeMs: number
  ): void {
    awfMetrics.recordCounter('awf.validator.retries', retries, { sessionId });
    awfMetrics.recordTimer('awf.validator.latency_ms', validationTimeMs, { sessionId });
  }

  /**
   * Record act application metrics
   */
  static recordActApplication(
    sessionId: string,
    actSummary: AWFMetrics['actSummary'],
    applicationTimeMs: number
  ): void {
    awfMetrics.recordCounter('awf.acts.rel_changes', actSummary.relChanges, { sessionId });
    awfMetrics.recordCounter('awf.acts.objectives', actSummary.objectives, { sessionId });
    awfMetrics.recordCounter('awf.acts.flags', actSummary.flags, { sessionId });
    awfMetrics.recordCounter('awf.acts.resources', actSummary.resources, { sessionId });
    awfMetrics.recordCounter('awf.acts.memory_added', actSummary.memoryAdded, { sessionId });
    awfMetrics.recordCounter('awf.acts.memory_pinned', actSummary.memoryPinned, { sessionId });
    awfMetrics.recordCounter('awf.acts.memory_trimmed', actSummary.memoryTrimmed, { sessionId });
    awfMetrics.recordTimer('awf.acts.application_ms', applicationTimeMs, { sessionId });
  }

  /**
   * Record tool call metrics
   */
  static recordToolCalls(
    sessionId: string,
    count: number,
    denied: number,
    tokensReturned: number,
    cacheHits: number
  ): void {
    awfMetrics.recordCounter('awf.tools.calls.count', count, { sessionId });
    awfMetrics.recordCounter('awf.tools.denied.count', denied, { sessionId });
    awfMetrics.recordCounter('awf.tools.tokens_returned', tokensReturned, { sessionId });
    awfMetrics.recordCounter('awf.tools.cache.hit_ratio', cacheHits, { sessionId });
  }

  /**
   * Record fallback metrics
   */
  static recordFallback(sessionId: string, reason: string): void {
    awfMetrics.recordCounter('awf.fallbacks.count', 1, { sessionId, reason });
  }

  /**
   * Record complete turn metrics
   */
  static recordTurnComplete(
    sessionId: string,
    turnId: number,
    totalLatencyMs: number,
    metrics: AWFMetrics
  ): void {
    awfMetrics.recordTimer('awf.turn.latency_ms', totalLatencyMs, { sessionId, turnId });
    awfMetrics.recordAWFTurn(metrics, { sessionId, turnId });
  }
}
