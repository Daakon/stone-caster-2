import type { MetricsSnapshot } from '@shared';

export interface RequestMetrics {
  route: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  errorCode?: string;
}

export interface ErrorMetrics {
  route: string;
  method: string;
  errorCode: string;
  errorMessage: string;
}

interface RouteStats {
  count: number;
  totalLatency: number;
  errorCount: number;
}

interface ErrorStats {
  count: number;
}

export class MetricsService {
  private static startTime: number = Date.now();
  private static requestCounts: Record<string, number> = {};
  private static routeStats: Record<string, RouteStats> = {};
  private static errorCounts: Record<string, number> = {};
  private static errorStats: Record<string, ErrorStats> = {};

  /**
   * Record a request metric
   */
  static recordRequest(metrics: RequestMetrics): void {
    const routeKey = `${metrics.method} ${metrics.route}`;
    
    // Update request counts
    this.requestCounts[routeKey] = (this.requestCounts[routeKey] || 0) + 1;
    
    // Update route stats
    if (!this.routeStats[routeKey]) {
      this.routeStats[routeKey] = {
        count: 0,
        totalLatency: 0,
        errorCount: 0,
      };
    }
    
    this.routeStats[routeKey].count++;
    this.routeStats[routeKey].totalLatency += metrics.latencyMs;
    
    // Track errors
    if (metrics.statusCode >= 400) {
      this.routeStats[routeKey].errorCount++;
      
      if (metrics.errorCode) {
        this.errorCounts[metrics.errorCode] = (this.errorCounts[metrics.errorCode] || 0) + 1;
      }
    }
  }

  /**
   * Record an error metric
   */
  static recordError(metrics: ErrorMetrics): void {
    // Update error counts
    this.errorCounts[metrics.errorCode] = (this.errorCounts[metrics.errorCode] || 0) + 1;
    
    // Update error stats
    if (!this.errorStats[metrics.errorCode]) {
      this.errorStats[metrics.errorCode] = {
        count: 0,
      };
    }
    
    this.errorStats[metrics.errorCode].count++;
  }

  /**
   * Increment a counter metric with optional labels
   * Phase 4.2: Simple metrics counter for legacy/V2 prompt usage tracking
   */
  static increment(name: string, labels?: Record<string, string | number>): void {
    const labelKey = labels ? JSON.stringify(labels) : '';
    const fullKey = labelKey ? `${name}{${labelKey}}` : name;
    
    // Store counter in errorCounts (reusing existing structure for simplicity)
    // In a production system, you'd use a proper metrics library (Prometheus, StatsD, etc.)
    this.errorCounts[fullKey] = (this.errorCounts[fullKey] || 0) + 1;
    
    // Log structured metric for observability
    console.log(JSON.stringify({
      event: 'metric.counter',
      name,
      labels: labels || {},
      value: this.errorCounts[fullKey],
    }));
  }

  /**
   * Phase 7: Record a histogram metric (no-op, console export compatible with Prometheus)
   * Histograms track value distributions (latency, size, etc.)
   */
  static observe(name: string, value: number, labels?: Record<string, string | number>): void {
    // In production, this would bucket the value into histogram buckets
    // For now, we log the value and can calculate percentiles from logs
    console.log(JSON.stringify({
      event: 'metric.histogram',
      name,
      labels: labels || {},
      value,
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * Get current metrics snapshot
   */
  static getSnapshot(): MetricsSnapshot {
    const now = Date.now();
    const uptime = now - this.startTime;
    
    // Calculate average latencies
    const averageLatencies: Record<string, number> = {};
    Object.keys(this.routeStats).forEach(routeKey => {
      const stats = this.routeStats[routeKey];
      averageLatencies[routeKey] = stats.count > 0 ? stats.totalLatency / stats.count : 0;
    });
    
    // Calculate totals
    const totalRequests = Object.values(this.requestCounts).reduce((sum, count) => sum + count, 0);
    const totalErrors = Object.values(this.errorCounts).reduce((sum, count) => sum + count, 0);
    
    return {
      requestCounts: { ...this.requestCounts },
      averageLatencies,
      errorCounts: { ...this.errorCounts },
      totalRequests,
      totalErrors,
      uptime,
    };
  }

  /**
   * Get metrics for a specific route
   */
  static getRouteMetrics(route: string, method: string): {
    count: number;
    averageLatency: number;
    errorCount: number;
  } {
    const routeKey = `${method} ${route}`;
    const stats = this.routeStats[routeKey];
    
    if (!stats) {
      return {
        count: 0,
        averageLatency: 0,
        errorCount: 0,
      };
    }
    
    return {
      count: stats.count,
      averageLatency: stats.count > 0 ? stats.totalLatency / stats.count : 0,
      errorCount: stats.errorCount,
    };
  }

  /**
   * Get error metrics for a specific error code
   */
  static getErrorMetrics(errorCode: string): {
    count: number;
  } {
    const stats = this.errorStats[errorCode];
    
    if (!stats) {
      return {
        count: 0,
      };
    }
    
    return {
      count: stats.count,
    };
  }

  /**
   * Get top routes by request count
   */
  static getTopRoutes(limit: number = 10): Array<{
    route: string;
    count: number;
    averageLatency: number;
    errorCount: number;
  }> {
    return Object.keys(this.routeStats)
      .map(routeKey => {
        const stats = this.routeStats[routeKey];
        return {
          route: routeKey,
          count: stats.count,
          averageLatency: stats.count > 0 ? stats.totalLatency / stats.count : 0,
          errorCount: stats.errorCount,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get top errors by count
   */
  static getTopErrors(limit: number = 10): Array<{
    errorCode: string;
    count: number;
  }> {
    return Object.keys(this.errorCounts)
      .map(errorCode => ({
        errorCode,
        count: this.errorCounts[errorCode],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Reset all metrics (useful for testing)
   */
  static reset(): void {
    this.startTime = Date.now();
    this.requestCounts = {};
    this.routeStats = {};
    this.errorCounts = {};
    this.errorStats = {};
  }

  /**
   * Get uptime in milliseconds
   */
  static getUptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get uptime in human-readable format
   */
  static getUptimeString(): string {
    const uptime = this.getUptime();
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}
