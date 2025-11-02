/**
 * Simple metrics collector for v3 performance tracking
 * Supports histograms, counters, and gauges
 * Can be extended with Prometheus exporter later
 */

interface HistogramData {
  values: number[];
  sum: number;
  count: number;
  min: number;
  max: number;
}

interface CounterData {
  count: number;
}

interface GaugeData {
  value: number;
}

class MetricsCollector {
  private histograms: Map<string, HistogramData> = new Map();
  private counters: Map<string, CounterData> = new Map();
  private gauges: Map<string, GaugeData> = new Map();
  private readonly maxHistogramSize = 1000; // Keep last 1000 measurements per histogram

  /**
   * Record a histogram measurement (latency, duration, etc.)
   */
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    const existing = this.histograms.get(key) || {
      values: [],
      sum: 0,
      count: 0,
      min: Infinity,
      max: -Infinity,
    };

    existing.values.push(value);
    existing.sum += value;
    existing.count++;
    existing.min = Math.min(existing.min, value);
    existing.max = Math.max(existing.max, value);

    // Keep only recent values
    if (existing.values.length > this.maxHistogramSize) {
      const removed = existing.values.shift();
      if (removed !== undefined) {
        existing.sum -= removed;
      }
    }

    this.histograms.set(key, existing);
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    const existing = this.counters.get(key) || { count: 0 };
    existing.count++;
    this.counters.set(key, existing);
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    this.gauges.set(key, { value });
  }

  /**
   * Get histogram percentiles (p50, p95, p99)
   */
  getHistogramPercentiles(name: string, labels?: Record<string, string>): {
    p50: number;
    p95: number;
    p99: number;
    count: number;
    min: number;
    max: number;
    sum: number;
  } | null {
    const key = this.buildKey(name, labels);
    const data = this.histograms.get(key);
    if (!data || data.values.length === 0) {
      return null;
    }

    const sorted = [...data.values].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

    return {
      p50,
      p95,
      p99,
      count: data.count,
      min: data.min === Infinity ? 0 : data.min,
      max: data.max === -Infinity ? 0 : data.max,
      sum: data.sum,
    };
  }

  /**
   * Get counter value
   */
  getCounter(name: string, labels?: Record<string, string>): number {
    const key = this.buildKey(name, labels);
    return this.counters.get(key)?.count || 0;
  }

  /**
   * Get gauge value
   */
  getGauge(name: string, labels?: Record<string, string>): number | null {
    const key = this.buildKey(name, labels);
    return this.gauges.get(key)?.value ?? null;
  }

  /**
   * Build cache key from name and labels
   */
  private buildKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  /**
   * Get all metrics (for export/debugging)
   */
  getAllMetrics(): {
    histograms: Record<string, HistogramData>;
    counters: Record<string, CounterData>;
    gauges: Record<string, GaugeData>;
  } {
    return {
      histograms: Object.fromEntries(this.histograms),
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
    };
  }

  /**
   * Clear all metrics
   */
  reset(): void {
    this.histograms.clear();
    this.counters.clear();
    this.gauges.clear();
  }
}

export const metricsCollector = new MetricsCollector();

/**
 * Check SLO violations and emit logs
 */
export function checkSLOViolations(
  metricName: string,
  p95: number,
  threshold: number
): void {
  if (p95 > threshold) {
    console.warn(`[SLO_VIOLATION] ${metricName} p95=${p95.toFixed(2)}ms exceeds threshold=${threshold}ms`, {
      metric: metricName,
      p95,
      threshold,
      violation: true,
    });
  }
}

