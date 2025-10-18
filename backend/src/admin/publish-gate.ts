import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface PublishCheck {
  docId: string;
  docType: 'core' | 'world' | 'adventure' | 'start';
  version: string;
  readyForPublish: boolean;
  lastLintReport?: string;
  lastPlaytestReport?: string;
  checks: {
    lintPassed: boolean;
    playtestPassed: boolean;
    lastChecked: string;
  };
}

export interface PublishGateConfig {
  requireLintPass: boolean;
  requirePlaytestPass: boolean;
  allowWarnings: boolean;
  maxLatency: number;
  maxTokenUsage: number;
}

export class PublishGate {
  private config: PublishGateConfig;
  private checks: Map<string, PublishCheck> = new Map();

  constructor(config: PublishGateConfig = {
    requireLintPass: true,
    requirePlaytestPass: true,
    allowWarnings: true,
    maxLatency: 8000,
    maxTokenUsage: 6000
  }) {
    this.config = config;
  }

  /**
   * Check if a document is ready for publish
   */
  async checkPublishReadiness(
    docId: string,
    docType: 'core' | 'world' | 'adventure' | 'start',
    version: string,
    lintReportPath?: string,
    playtestReportPath?: string
  ): Promise<PublishCheck> {
    const check: PublishCheck = {
      docId,
      docType,
      version,
      readyForPublish: false,
      lastLintReport: lintReportPath,
      lastPlaytestReport: playtestReportPath,
      checks: {
        lintPassed: false,
        playtestPassed: false,
        lastChecked: new Date().toISOString()
      }
    };

    // Check lint results
    if (this.config.requireLintPass && lintReportPath) {
      check.checks.lintPassed = await this.checkLintResults(lintReportPath);
    } else if (!this.config.requireLintPass) {
      check.checks.lintPassed = true;
    }

    // Check playtest results
    if (this.config.requirePlaytestPass && playtestReportPath) {
      check.checks.playtestPassed = await this.checkPlaytestResults(playtestReportPath);
    } else if (!this.config.requirePlaytestPass) {
      check.checks.playtestPassed = true;
    }

    // Determine if ready for publish
    check.readyForPublish = check.checks.lintPassed && check.checks.playtestPassed;

    // Store the check
    this.checks.set(`${docType}.${docId}`, check);

    return check;
  }

  /**
   * Set ready_for_publish flag (admin only)
   */
  async setPublishReady(
    docId: string,
    docType: 'core' | 'world' | 'adventure' | 'start',
    ready: boolean,
    actor: string
  ): Promise<{ success: boolean; message: string; check?: PublishCheck }> {
    const checkKey = `${docType}.${docId}`;
    const check = this.checks.get(checkKey);

    if (!check) {
      return {
        success: false,
        message: `No publish check found for ${docType}.${docId}. Run checkPublishReadiness first.`
      };
    }

    if (ready && !check.readyForPublish) {
      return {
        success: false,
        message: `Document ${docType}.${docId} is not ready for publish. Lint: ${check.checks.lintPassed}, Playtest: ${check.checks.playtestPassed}`
      };
    }

    // Update the check
    check.readyForPublish = ready;
    this.checks.set(checkKey, check);

    // Log the action
    this.logPublishAction(docId, docType, ready, actor);

    return {
      success: true,
      message: `Document ${docType}.${docId} ${ready ? 'marked as ready' : 'marked as not ready'} for publish`,
      check
    };
  }

  /**
   * Get publish status for a document
   */
  getPublishStatus(docId: string, docType: 'core' | 'world' | 'adventure' | 'start'): PublishCheck | null {
    return this.checks.get(`${docType}.${docId}`) || null;
  }

  /**
   * Get all publish checks
   */
  getAllChecks(): PublishCheck[] {
    return Array.from(this.checks.values());
  }

  /**
   * Get checks by status
   */
  getChecksByStatus(ready: boolean): PublishCheck[] {
    return this.getAllChecks().filter(check => check.readyForPublish === ready);
  }

  private async checkLintResults(reportPath: string): Promise<boolean> {
    try {
      if (!existsSync(reportPath)) {
        return false;
      }

      const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
      
      // Check if there are any errors
      if (report.summary?.totalErrors > 0) {
        return false;
      }

      // Check if warnings are allowed
      if (!this.config.allowWarnings && report.summary?.totalWarnings > 0) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to check lint results:', error);
      return false;
    }
  }

  private async checkPlaytestResults(reportPath: string): Promise<boolean> {
    try {
      if (!existsSync(reportPath)) {
        return false;
      }

      const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
      
      // Check if all scenarios passed
      if (report.summary?.failedScenarios > 0) {
        return false;
      }

      // Check if all turns passed
      if (report.summary?.failedTurns > 0) {
        return false;
      }

      // Check latency threshold
      if (report.summary?.averageLatency > this.config.maxLatency) {
        return false;
      }

      // Check token usage threshold
      if (report.summary?.tokenUsage?.average > this.config.maxTokenUsage) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to check playtest results:', error);
      return false;
    }
  }

  private logPublishAction(docId: string, docType: string, ready: boolean, actor: string): void {
    const action = ready ? 'publish_ready' : 'publish_not_ready';
    const message = `Document ${docType}.${docId} ${ready ? 'marked ready' : 'marked not ready'} for publish by ${actor}`;
    
    console.log(`[PUBLISH_GATE] ${action}: ${message}`);
    
    // In a real implementation, this would be logged to the audit system
    // For now, just log to console
  }

  /**
   * Generate a publish readiness report
   */
  generateReport(): {
    timestamp: string;
    config: PublishGateConfig;
    checks: PublishCheck[];
    summary: {
      total: number;
      ready: number;
      notReady: number;
      lintFailures: number;
      playtestFailures: number;
    };
  } {
    const checks = this.getAllChecks();
    const ready = checks.filter(c => c.readyForPublish).length;
    const notReady = checks.length - ready;
    const lintFailures = checks.filter(c => !c.checks.lintPassed).length;
    const playtestFailures = checks.filter(c => !c.checks.playtestPassed).length;

    return {
      timestamp: new Date().toISOString(),
      config: this.config,
      checks,
      summary: {
        total: checks.length,
        ready,
        notReady,
        lintFailures,
        playtestFailures
      }
    };
  }

  /**
   * Save report to file
   */
  saveReport(outputPath: string): void {
    const report = this.generateReport();
    writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`📄 Publish gate report saved to: ${outputPath}`);
  }

  /**
   * Print report to console
   */
  printReport(): void {
    const report = this.generateReport();
    
    console.log('\n🚪 Publish Gate Report');
    console.log('='.repeat(50));
    console.log(`Total Documents: ${report.summary.total}`);
    console.log(`Ready for Publish: ${report.summary.ready}`);
    console.log(`Not Ready: ${report.summary.notReady}`);
    console.log(`Lint Failures: ${report.summary.lintFailures}`);
    console.log(`Playtest Failures: ${report.summary.playtestFailures}`);
    
    if (report.summary.notReady > 0) {
      console.log('\n❌ Documents Not Ready:');
      const notReady = report.checks.filter(c => !c.readyForPublish);
      for (const check of notReady) {
        console.log(`  ${check.docType}.${check.docId}: Lint=${check.checks.lintPassed}, Playtest=${check.checks.playtestPassed}`);
      }
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const checkIndex = args.indexOf('--check');
  const setIndex = args.indexOf('--set');
  const statusIndex = args.indexOf('--status');
  const reportIndex = args.indexOf('--report');

  const gate = new PublishGate();

  if (checkIndex !== -1) {
    const [docType, docId, version] = args[checkIndex + 1].split('.');
    const lintReport = args.includes('--lint') ? args[args.indexOf('--lint') + 1] : undefined;
    const playtestReport = args.includes('--playtest') ? args[args.indexOf('--playtest') + 1] : undefined;
    
    gate.checkPublishReadiness(docId, docType as any, version, lintReport, playtestReport)
      .then(check => {
        console.log(`📋 Publish check for ${docType}.${docId}:`);
        console.log(`  Ready: ${check.readyForPublish}`);
        console.log(`  Lint: ${check.checks.lintPassed}`);
        console.log(`  Playtest: ${check.checks.playtestPassed}`);
      });
  } else if (setIndex !== -1) {
    const [docType, docId] = args[setIndex + 1].split('.');
    const ready = args[setIndex + 2] === 'true';
    const actor = args[args.indexOf('--actor') + 1] || 'admin';
    
    gate.setPublishReady(docId, docType as any, ready, actor)
      .then(result => {
        console.log(result.message);
        if (!result.success) {
          process.exit(1);
        }
      });
  } else if (statusIndex !== -1) {
    const [docType, docId] = args[statusIndex + 1].split('.');
    const status = gate.getPublishStatus(docId, docType as any);
    
    if (status) {
      console.log(`📊 Status for ${docType}.${docId}:`);
      console.log(`  Ready: ${status.readyForPublish}`);
      console.log(`  Version: ${status.version}`);
      console.log(`  Last Checked: ${status.checks.lastChecked}`);
    } else {
      console.log(`❌ No status found for ${docType}.${docId}`);
    }
  } else if (reportIndex !== -1) {
    gate.printReport();
    
    const outputPath = args.includes('--output') ? args[args.indexOf('--output') + 1] : undefined;
    if (outputPath) {
      gate.saveReport(outputPath);
    }
  } else {
    console.error('Usage: yarn awf:publish --check <type.id.version> [--lint <path>] [--playtest <path>]');
    console.error('       yarn awf:publish --set <type.id> <true|false> --actor <name>');
    console.error('       yarn awf:publish --status <type.id>');
    console.error('       yarn awf:publish --report [--output <path>]');
    process.exit(1);
  }
}


