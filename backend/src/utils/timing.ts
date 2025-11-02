/**
 * High-resolution timing utilities for performance measurement
 * Provides nanosecond-precision timers for latency tracking
 */

export interface TimingSpan {
  name: string;
  startMs: number;
  endMs?: number;
  durationMs?: number;
}

export class PerformanceTimer {
  private spans: Map<string, number> = new Map();
  private results: Map<string, number> = new Map();

  /**
   * Start a timing span
   */
  start(name: string): void {
    this.spans.set(name, performance.now());
  }

  /**
   * End a timing span and record duration
   */
  end(name: string): number {
    const start = this.spans.get(name);
    if (!start) {
      console.warn(`[TIMING] Span "${name}" was not started`);
      return 0;
    }
    const duration = performance.now() - start;
    this.results.set(name, duration);
    this.spans.delete(name);
    return duration;
  }

  /**
   * Get duration for a span (must be ended first)
   */
  getDuration(name: string): number | undefined {
    return this.results.get(name);
  }

  /**
   * Get all recorded timings
   */
  getAllTimings(): Record<string, number> {
    const result: Record<string, number> = {};
    this.results.forEach((duration, name) => {
      result[name] = duration;
    });
    return result;
  }

  /**
   * Reset all timings
   */
  reset(): void {
    this.spans.clear();
    this.results.clear();
  }
}

/**
 * Simple timer for single measurements
 */
export function measureTime<T>(name: string, fn: () => T): T {
  const start = performance.now();
  try {
    return fn();
  } finally {
    const duration = performance.now() - start;
    console.debug(`[TIMING] ${name}: ${duration.toFixed(2)}ms`);
  }
}

/**
 * Async timer for async operations
 */
export async function measureTimeAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const duration = performance.now() - start;
    console.debug(`[TIMING] ${name}: ${duration.toFixed(2)}ms`);
  }
}

