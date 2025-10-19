#!/usr/bin/env tsx
/**
 * AWF Migration Audit Job
 * Phase 8: Legacy Decommission - Daily audit for 14 days post-enablement
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getSLOMonitor } from '../src/slos/awf-slos.js';
import { getAuditLogger } from '../src/audit/audit-logger.js';
import { getAwfModeManager } from '../src/config/awf-mode.js';

interface MigrationAuditData {
  date: string;
  awfMode: string;
  emergencyLegacy: boolean;
  metrics: {
    turnLatencyP95: number;
    invalidRetryRate: number;
    fallbackRate: number;
    totalTurns: number;
    retryTurns: number;
    fallbackTurns: number;
  };
  sloStatus: {
    turnLatencyHealthy: boolean;
    retryRateHealthy: boolean;
    fallbackRateHealthy: boolean;
  };
  deviations: {
    latencyDeviation: number;
    retryDeviation: number;
    fallbackDeviation: number;
  };
  recommendations: string[];
  timestamp: string;
}

class MigrationAuditJob {
  private auditDir: string;
  private sloMonitor: ReturnType<typeof getSLOMonitor>;
  private auditLogger: ReturnType<typeof getAuditLogger>;
  private awfModeManager: ReturnType<typeof getAwfModeManager>;

  constructor() {
    this.auditDir = join(process.cwd(), 'logs', 'awf-audit');
    this.sloMonitor = getSLOMonitor();
    this.auditLogger = getAuditLogger();
    this.awfModeManager = getAwfModeManager();
    
    // Ensure audit directory exists
    if (!existsSync(this.auditDir)) {
      mkdirSync(this.auditDir, { recursive: true });
    }
  }

  /**
   * Run the daily migration audit
   */
  async runAudit(): Promise<void> {
    console.log('[Migration Audit] Starting daily AWF migration audit...');
    
    const auditData = await this.collectAuditData();
    const auditFile = this.saveAuditData(auditData);
    
    // Check for deviations and send alerts if needed
    await this.checkDeviations(auditData);
    
    console.log(`[Migration Audit] Audit completed. Data saved to: ${auditFile}`);
  }

  /**
   * Collect audit data from various sources
   */
  private async collectAuditData(): Promise<MigrationAuditData> {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    
    // Get AWF mode status
    const awfStatus = this.awfModeManager.getStatus();
    
    // Get SLO metrics
    const sloStatus = this.sloMonitor.getStatus();
    
    // Calculate deviations from baseline
    const deviations = this.calculateDeviations(sloStatus.metrics);
    
    // Check SLO health
    const sloHealth = this.checkSLOHealth(sloStatus);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(sloStatus, deviations);
    
    return {
      date,
      awfMode: awfStatus.mode,
      emergencyLegacy: awfStatus.emergencyLegacy,
      metrics: {
        turnLatencyP95: sloStatus.metrics.turnLatencyP95,
        invalidRetryRate: sloStatus.metrics.invalidRetryRate,
        fallbackRate: sloStatus.metrics.fallbackRate,
        totalTurns: sloStatus.metrics.totalTurns,
        retryTurns: sloStatus.metrics.retryTurns,
        fallbackTurns: sloStatus.metrics.fallbackTurns
      },
      sloStatus: sloHealth,
      deviations,
      recommendations,
      timestamp: now.toISOString()
    };
  }

  /**
   * Calculate deviations from baseline metrics
   */
  private calculateDeviations(metrics: any): {
    latencyDeviation: number;
    retryDeviation: number;
    fallbackDeviation: number;
  } {
    // Baseline metrics (from pre-migration)
    const baseline = {
      latencyP95: 5000, // 5 seconds baseline
      retryRate: 2.0,    // 2% baseline
      fallbackRate: 0.0  // 0% baseline (no fallbacks)
    };
    
    return {
      latencyDeviation: ((metrics.turnLatencyP95 - baseline.latencyP95) / baseline.latencyP95) * 100,
      retryDeviation: metrics.invalidRetryRate - baseline.retryRate,
      fallbackDeviation: metrics.fallbackRate - baseline.fallbackRate
    };
  }

  /**
   * Check SLO health status
   */
  private checkSLOHealth(sloStatus: any): {
    turnLatencyHealthy: boolean;
    retryRateHealthy: boolean;
    fallbackRateHealthy: boolean;
  } {
    return {
      turnLatencyHealthy: sloStatus.slos.find((s: any) => s.name === 'turn_latency_p95')?.status === 'healthy',
      retryRateHealthy: sloStatus.slos.find((s: any) => s.name === 'invalid_retry_rate')?.status === 'healthy',
      fallbackRateHealthy: sloStatus.slos.find((s: any) => s.name === 'fallback_rate')?.status === 'healthy'
    };
  }

  /**
   * Generate recommendations based on metrics
   */
  private generateRecommendations(sloStatus: any, deviations: any): string[] {
    const recommendations: string[] = [];
    
    if (deviations.latencyDeviation > 20) {
      recommendations.push('High latency deviation detected. Consider investigating model provider performance.');
    }
    
    if (deviations.retryDeviation > 3) {
      recommendations.push('High retry rate deviation. Review validator rules and model output quality.');
    }
    
    if (deviations.fallbackDeviation > 0) {
      recommendations.push('Fallback rate above baseline. Investigate AWF system stability.');
    }
    
    if (sloStatus.metrics.totalTurns < 100) {
      recommendations.push('Low turn volume detected. Consider extending audit period.');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('All metrics within acceptable ranges. Migration appears stable.');
    }
    
    return recommendations;
  }

  /**
   * Save audit data to file
   */
  private saveAuditData(auditData: MigrationAuditData): string {
    const filename = `${auditData.date}.json`;
    const filepath = join(this.auditDir, filename);
    
    writeFileSync(filepath, JSON.stringify(auditData, null, 2));
    
    return filepath;
  }

  /**
   * Check for significant deviations and send alerts
   */
  private async checkDeviations(auditData: MigrationAuditData): Promise<void> {
    const threshold = 10; // 10% deviation threshold
    
    if (Math.abs(auditData.deviations.latencyDeviation) > threshold) {
      console.warn(`[Migration Audit] WARNING: High latency deviation: ${auditData.deviations.latencyDeviation.toFixed(1)}%`);
      this.auditLogger.log('system', 'migration_audit_alert', 'latency_deviation', {
        deviation: auditData.deviations.latencyDeviation,
        threshold,
        date: auditData.date
      });
    }
    
    if (Math.abs(auditData.deviations.retryDeviation) > threshold) {
      console.warn(`[Migration Audit] WARNING: High retry rate deviation: ${auditData.deviations.retryDeviation.toFixed(1)}%`);
      this.auditLogger.log('system', 'migration_audit_alert', 'retry_deviation', {
        deviation: auditData.deviations.retryDeviation,
        threshold,
        date: auditData.date
      });
    }
    
    if (auditData.deviations.fallbackDeviation > 0) {
      console.error(`[Migration Audit] CRITICAL: Fallback rate above baseline: ${auditData.deviations.fallbackDeviation.toFixed(1)}%`);
      this.auditLogger.log('system', 'migration_audit_alert', 'fallback_deviation', {
        deviation: auditData.deviations.fallbackDeviation,
        threshold: 0,
        date: auditData.date
      });
    }
  }

  /**
   * Get audit summary for the last N days
   */
  getAuditSummary(days: number = 7): {
    totalDays: number;
    healthyDays: number;
    averageLatency: number;
    averageRetryRate: number;
    totalFallbacks: number;
    recommendations: string[];
  } {
    const files = this.getAuditFiles(days);
    const auditData = files.map(file => JSON.parse(readFileSync(file, 'utf-8')));
    
    const healthyDays = auditData.filter(data => 
      data.sloStatus.turnLatencyHealthy && 
      data.sloStatus.retryRateHealthy && 
      data.sloStatus.fallbackRateHealthy
    ).length;
    
    const averageLatency = auditData.reduce((sum, data) => sum + data.metrics.turnLatencyP95, 0) / auditData.length;
    const averageRetryRate = auditData.reduce((sum, data) => sum + data.metrics.invalidRetryRate, 0) / auditData.length;
    const totalFallbacks = auditData.reduce((sum, data) => sum + data.metrics.fallbackTurns, 0);
    
    const recommendations: string[] = [];
    if (healthyDays < days * 0.8) {
      recommendations.push('Migration stability below 80%. Consider extending audit period.');
    }
    if (totalFallbacks > 0) {
      recommendations.push('Fallbacks detected during audit period. Investigate root cause.');
    }
    if (averageLatency > 8000) {
      recommendations.push('Average latency above 8s. Consider performance optimization.');
    }
    
    return {
      totalDays: files.length,
      healthyDays,
      averageLatency,
      averageRetryRate,
      totalFallbacks,
      recommendations
    };
  }

  /**
   * Get audit files for the last N days
   */
  private getAuditFiles(days: number): string[] {
    const files: string[] = [];
    const now = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const filepath = join(this.auditDir, `${dateStr}.json`);
      
      if (existsSync(filepath)) {
        files.push(filepath);
      }
    }
    
    return files;
  }
}

// Main execution
async function main() {
  const job = new MigrationAuditJob();
  
  if (process.argv.includes('--summary')) {
    const days = parseInt(process.argv[process.argv.indexOf('--summary') + 1]) || 7;
    const summary = job.getAuditSummary(days);
    
    console.log(`[Migration Audit] Summary for last ${days} days:`);
    console.log(`  Total days: ${summary.totalDays}`);
    console.log(`  Healthy days: ${summary.healthyDays}`);
    console.log(`  Average latency: ${summary.averageLatency.toFixed(0)}ms`);
    console.log(`  Average retry rate: ${summary.averageRetryRate.toFixed(1)}%`);
    console.log(`  Total fallbacks: ${summary.totalFallbacks}`);
    console.log(`  Recommendations: ${summary.recommendations.join(', ')}`);
  } else {
    await job.runAudit();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
