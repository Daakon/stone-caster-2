#!/usr/bin/env tsx
/**
 * AWF Weekly Report Generator
 * Phase 8: Legacy Decommission - Weekly rollup report for AWF metrics
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getSLOMonitor } from '../src/slos/awf-slos.js';
import { getAuditLogger } from '../src/audit/audit-logger.js';
import { getAwfModeManager } from '../src/config/awf-mode.js';

interface WeeklyReport {
  week: string;
  awfMode: string;
  emergencyLegacy: boolean;
  metrics: {
    totalTurns: number;
    averageLatency: number;
    p95Latency: number;
    retryRate: number;
    fallbackRate: number;
    errorRate: number;
  };
  sloStatus: {
    healthy: number;
    warning: number;
    critical: number;
  };
  trends: {
    latencyTrend: 'improving' | 'stable' | 'degrading';
    retryTrend: 'improving' | 'stable' | 'degrading';
    fallbackTrend: 'improving' | 'stable' | 'degrading';
  };
  recommendations: string[];
  timestamp: string;
}

class WeeklyReportGenerator {
  private auditDir: string;
  private sloMonitor: ReturnType<typeof getSLOMonitor>;
  private auditLogger: ReturnType<typeof getAuditLogger>;
  private awfModeManager: ReturnType<typeof getAwfModeManager>;

  constructor() {
    this.auditDir = join(process.cwd(), 'logs', 'awf-audit');
    this.sloMonitor = getSLOMonitor();
    this.auditLogger = getAuditLogger();
    this.awfModeManager = getAwfModeManager();
  }

  /**
   * Generate weekly report
   */
  async generateReport(): Promise<WeeklyReport> {
    console.log('[Weekly Report] Generating AWF weekly report...');
    
    const week = this.getCurrentWeek();
    const auditData = this.loadAuditData(7); // Last 7 days
    
    const report: WeeklyReport = {
      week,
      awfMode: this.awfModeManager.getStatus().mode,
      emergencyLegacy: this.awfModeManager.getStatus().emergencyLegacy,
      metrics: this.calculateMetrics(auditData),
      sloStatus: this.calculateSLOStatus(auditData),
      trends: this.calculateTrends(auditData),
      recommendations: this.generateRecommendations(auditData),
      timestamp: new Date().toISOString()
    };
    
    this.printReport(report);
    this.saveReport(report);
    
    return report;
  }

  /**
   * Get current week identifier
   */
  private getCurrentWeek(): string {
    const now = new Date();
    const year = now.getFullYear();
    const week = this.getWeekNumber(now);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }

  /**
   * Get week number for a date
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  /**
   * Load audit data for the specified number of days
   */
  private loadAuditData(days: number): any[] {
    const data: any[] = [];
    const now = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const filepath = join(this.auditDir, `${dateStr}.json`);
      
      if (existsSync(filepath)) {
        try {
          const dayData = JSON.parse(readFileSync(filepath, 'utf-8'));
          data.push(dayData);
        } catch (error) {
          console.warn(`[Weekly Report] Failed to load audit data for ${dateStr}:`, error);
        }
      }
    }
    
    return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /**
   * Calculate metrics from audit data
   */
  private calculateMetrics(auditData: any[]): WeeklyReport['metrics'] {
    if (auditData.length === 0) {
      return {
        totalTurns: 0,
        averageLatency: 0,
        p95Latency: 0,
        retryRate: 0,
        fallbackRate: 0,
        errorRate: 0
      };
    }
    
    const totalTurns = auditData.reduce((sum, data) => sum + data.metrics.totalTurns, 0);
    const averageLatency = auditData.reduce((sum, data) => sum + data.metrics.turnLatencyP95, 0) / auditData.length;
    const p95Latency = Math.max(...auditData.map(data => data.metrics.turnLatencyP95));
    const retryRate = auditData.reduce((sum, data) => sum + data.metrics.invalidRetryRate, 0) / auditData.length;
    const fallbackRate = auditData.reduce((sum, data) => sum + data.metrics.fallbackRate, 0) / auditData.length;
    const errorRate = auditData.reduce((sum, data) => sum + (data.metrics.fallbackTurns || 0), 0) / totalTurns * 100;
    
    return {
      totalTurns,
      averageLatency: Math.round(averageLatency),
      p95Latency: Math.round(p95Latency),
      retryRate: Math.round(retryRate * 100) / 100,
      fallbackRate: Math.round(fallbackRate * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100
    };
  }

  /**
   * Calculate SLO status from audit data
   */
  private calculateSLOStatus(auditData: any[]): WeeklyReport['sloStatus'] {
    let healthy = 0;
    let warning = 0;
    let critical = 0;
    
    for (const data of auditData) {
      if (data.sloStatus.turnLatencyHealthy && data.sloStatus.retryRateHealthy && data.sloStatus.fallbackRateHealthy) {
        healthy++;
      } else if (data.sloStatus.fallbackRateHealthy) {
        warning++;
      } else {
        critical++;
      }
    }
    
    return { healthy, warning, critical };
  }

  /**
   * Calculate trends from audit data
   */
  private calculateTrends(auditData: any[]): WeeklyReport['trends'] {
    if (auditData.length < 2) {
      return {
        latencyTrend: 'stable',
        retryTrend: 'stable',
        fallbackTrend: 'stable'
      };
    }
    
    const firstHalf = auditData.slice(0, Math.floor(auditData.length / 2));
    const secondHalf = auditData.slice(Math.floor(auditData.length / 2));
    
    const firstLatency = firstHalf.reduce((sum, data) => sum + data.metrics.turnLatencyP95, 0) / firstHalf.length;
    const secondLatency = secondHalf.reduce((sum, data) => sum + data.metrics.turnLatencyP95, 0) / secondHalf.length;
    
    const firstRetry = firstHalf.reduce((sum, data) => sum + data.metrics.invalidRetryRate, 0) / firstHalf.length;
    const secondRetry = secondHalf.reduce((sum, data) => sum + data.metrics.invalidRetryRate, 0) / secondHalf.length;
    
    const firstFallback = firstHalf.reduce((sum, data) => sum + data.metrics.fallbackRate, 0) / firstHalf.length;
    const secondFallback = secondHalf.reduce((sum, data) => sum + data.metrics.fallbackRate, 0) / secondHalf.length;
    
    return {
      latencyTrend: this.getTrend(secondLatency, firstLatency),
      retryTrend: this.getTrend(secondRetry, firstRetry),
      fallbackTrend: this.getTrend(secondFallback, firstFallback)
    };
  }

  /**
   * Get trend direction
   */
  private getTrend(current: number, previous: number): 'improving' | 'stable' | 'degrading' {
    const change = ((current - previous) / previous) * 100;
    
    if (Math.abs(change) < 5) return 'stable';
    return change > 0 ? 'degrading' : 'improving';
  }

  /**
   * Generate recommendations based on metrics
   */
  private generateRecommendations(auditData: any[]): string[] {
    const recommendations: string[] = [];
    const metrics = this.calculateMetrics(auditData);
    const sloStatus = this.calculateSLOStatus(auditData);
    
    if (metrics.p95Latency > 8000) {
      recommendations.push('P95 latency above 8s. Consider performance optimization.');
    }
    
    if (metrics.retryRate > 5) {
      recommendations.push('Retry rate above 5%. Review validator rules and model quality.');
    }
    
    if (metrics.fallbackRate > 0) {
      recommendations.push('Fallbacks detected. Investigate AWF system stability.');
    }
    
    if (sloStatus.critical > 0) {
      recommendations.push('Critical SLO violations detected. Immediate attention required.');
    }
    
    if (metrics.totalTurns < 1000) {
      recommendations.push('Low turn volume. Consider extending monitoring period.');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('All metrics within acceptable ranges. AWF system performing well.');
    }
    
    return recommendations;
  }

  /**
   * Print report to console
   */
  private printReport(report: WeeklyReport): void {
    console.log('\n=== AWF Weekly Report ===');
    console.log(`Week: ${report.week}`);
    console.log(`AWF Mode: ${report.awfMode}`);
    console.log(`Emergency Legacy: ${report.emergencyLegacy ? 'ACTIVE' : 'Inactive'}`);
    console.log('\n--- Metrics ---');
    console.log(`Total Turns: ${report.metrics.totalTurns.toLocaleString()}`);
    console.log(`Average Latency: ${report.metrics.averageLatency}ms`);
    console.log(`P95 Latency: ${report.metrics.p95Latency}ms`);
    console.log(`Retry Rate: ${report.metrics.retryRate}%`);
    console.log(`Fallback Rate: ${report.metrics.fallbackRate}%`);
    console.log(`Error Rate: ${report.metrics.errorRate}%`);
    console.log('\n--- SLO Status ---');
    console.log(`Healthy Days: ${report.sloStatus.healthy}`);
    console.log(`Warning Days: ${report.sloStatus.warning}`);
    console.log(`Critical Days: ${report.sloStatus.critical}`);
    console.log('\n--- Trends ---');
    console.log(`Latency Trend: ${report.trends.latencyTrend}`);
    console.log(`Retry Trend: ${report.trends.retryTrend}`);
    console.log(`Fallback Trend: ${report.trends.fallbackTrend}`);
    console.log('\n--- Recommendations ---');
    report.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
    console.log('\n========================\n');
  }

  /**
   * Save report to file
   */
  private saveReport(report: WeeklyReport): void {
    const filename = `weekly-report-${report.week}.json`;
    const filepath = join(this.auditDir, filename);
    
    require('fs').writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(`[Weekly Report] Report saved to: ${filepath}`);
  }
}

// Main execution
async function main() {
  const generator = new WeeklyReportGenerator();
  await generator.generateReport();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}


