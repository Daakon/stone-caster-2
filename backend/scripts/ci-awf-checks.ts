import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

export interface CICheckResult {
  type: 'lint' | 'playtest';
  success: boolean;
  output: string;
  reportPath?: string;
  errorCount: number;
  warningCount: number;
}

export interface CIReport {
  timestamp: string;
  branch: string;
  commit: string;
  changedFiles: string[];
  checks: CICheckResult[];
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    totalErrors: number;
    totalWarnings: number;
  };
}

export class CIChecker {
  private outputDir: string;
  private reportsDir: string;

  constructor(outputDir: string = './reports/ci') {
    this.outputDir = outputDir;
    this.reportsDir = join(outputDir, 'reports');
    
    // Ensure output directories exist
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
    if (!existsSync(this.reportsDir)) {
      mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Run all CI checks for changed AWF content
   */
  async runChecks(changedFiles?: string[]): Promise<CIReport> {
    const timestamp = new Date().toISOString();
    const branch = this.getCurrentBranch();
    const commit = this.getCurrentCommit();
    
    // Get changed files if not provided
    const files = changedFiles || await this.getChangedFiles();
    const awfFiles = this.filterAwfFiles(files);
    
    console.log(`🔍 Running CI checks for ${awfFiles.length} changed AWF files`);
    console.log(`📁 Files: ${awfFiles.join(', ')}`);
    
    const checks: CICheckResult[] = [];
    
    // Run lint checks
    if (awfFiles.length > 0) {
      const lintResult = await this.runLintChecks(awfFiles);
      checks.push(lintResult);
    }
    
    // Run playtest checks
    if (awfFiles.length > 0) {
      const playtestResult = await this.runPlaytestChecks(awfFiles);
      checks.push(playtestResult);
    }
    
    const report = this.generateReport(timestamp, branch, commit, awfFiles, checks);
    
    // Save report
    const reportPath = join(this.reportsDir, `ci-${timestamp.replace(/[:.]/g, '-')}.json`);
    this.saveReport(report, reportPath);
    
    return report;
  }

  /**
   * Run lint checks on changed files
   */
  private async runLintChecks(files: string[]): Promise<CICheckResult> {
    console.log('🔍 Running lint checks...');
    
    try {
      const lintPaths = files.join(',');
      const reportPath = join(this.reportsDir, `lint-${Date.now()}.json`);
      
      const command = `yarn awf:lint --paths "${lintPaths}" --strict --output "${reportPath}"`;
      const output = execSync(command, { 
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      
      // Parse lint report
      const lintReport = JSON.parse(readFileSync(reportPath, 'utf-8'));
      
      return {
        type: 'lint',
        success: lintReport.summary.totalErrors === 0,
        output,
        reportPath,
        errorCount: lintReport.summary.totalErrors,
        warningCount: lintReport.summary.totalWarnings
      };
      
    } catch (error) {
      return {
        type: 'lint',
        success: false,
        output: error instanceof Error ? error.message : String(error),
        errorCount: 1,
        warningCount: 0
      };
    }
  }

  /**
   * Run playtest checks on changed files
   */
  private async runPlaytestChecks(files: string[]): Promise<CICheckResult> {
    console.log('🎮 Running playtest checks...');
    
    try {
      const reportPath = join(this.reportsDir, `playtest-${Date.now()}.json`);
      
      // Run playtest verify for all scenarios
      const command = `yarn awf:playtest:verify --all --output "${reportPath}"`;
      const output = execSync(command, { 
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      
      // Parse playtest report
      const playtestReport = JSON.parse(readFileSync(reportPath, 'utf-8'));
      
      return {
        type: 'playtest',
        success: playtestReport.summary.failedTurns === 0,
        output,
        reportPath,
        errorCount: playtestReport.summary.failedTurns,
        warningCount: 0
      };
      
    } catch (error) {
      return {
        type: 'playtest',
        success: false,
        output: error instanceof Error ? error.message : String(error),
        errorCount: 1,
        warningCount: 0
      };
    }
  }

  /**
   * Get changed files from git
   */
  private async getChangedFiles(): Promise<string[]> {
    try {
      const command = 'git diff --name-only HEAD~1 HEAD';
      const output = execSync(command, { encoding: 'utf-8' });
      return output.trim().split('\n').filter(line => line.length > 0);
    } catch (error) {
      console.warn('Failed to get changed files from git:', error);
      return [];
    }
  }

  /**
   * Filter files to only include AWF content
   */
  private filterAwfFiles(files: string[]): string[] {
    const awfPatterns = [
      '**/core/**/*.json',
      '**/worlds/**/*.json',
      '**/adventures/**/*.json',
      '**/start/**/*.json',
      '**/scenarios/**/*.json',
      '**/games/**/*.json', // Phase 1: Include games for state validation
      '**/rulesets/**/*.json' // Phase 1: Include rulesets for narrative validation
    ];
    
    return files.filter(file => 
      awfPatterns.some(pattern => this.matchesPattern(file, pattern))
    );
  }

  /**
   * Check if file matches pattern
   */
  private matchesPattern(file: string, pattern: string): boolean {
    // Simple pattern matching - in production, use proper glob matching
    const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
    return regex.test(file);
  }

  /**
   * Get current git branch
   */
  private getCurrentBranch(): string {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get current git commit
   */
  private getCurrentCommit(): string {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Generate CI report
   */
  private generateReport(
    timestamp: string,
    branch: string,
    commit: string,
    changedFiles: string[],
    checks: CICheckResult[]
  ): CIReport {
    const passedChecks = checks.filter(c => c.success).length;
    const failedChecks = checks.length - passedChecks;
    const totalErrors = checks.reduce((sum, c) => sum + c.errorCount, 0);
    const totalWarnings = checks.reduce((sum, c) => sum + c.warningCount, 0);

    return {
      timestamp,
      branch,
      commit,
      changedFiles,
      checks,
      summary: {
        totalChecks: checks.length,
        passedChecks,
        failedChecks,
        totalErrors,
        totalWarnings
      }
    };
  }

  /**
   * Save report to file
   */
  private saveReport(report: CIReport, path: string): void {
    writeFileSync(path, JSON.stringify(report, null, 2));
    console.log(`📄 CI report saved to: ${path}`);
  }

  /**
   * Print report summary
   */
  printReport(report: CIReport): void {
    console.log('\n🚀 CI Check Report');
    console.log('='.repeat(50));
    console.log(`Branch: ${report.branch}`);
    console.log(`Commit: ${report.commit.substring(0, 8)}`);
    console.log(`Changed Files: ${report.changedFiles.length}`);
    console.log(`Checks: ${report.summary.passedChecks}/${report.summary.totalChecks} passed`);
    console.log(`Errors: ${report.summary.totalErrors}`);
    console.log(`Warnings: ${report.summary.totalWarnings}`);
    
    if (report.summary.failedChecks > 0) {
      console.log('\n❌ Failed Checks:');
      const failedChecks = report.checks.filter(c => !c.success);
      for (const check of failedChecks) {
        console.log(`  ${check.type}: ${check.output}`);
      }
    }
    
    if (report.summary.totalErrors > 0) {
      console.log('\n💥 CI checks failed!');
      process.exit(1);
    } else {
      console.log('\n✅ All CI checks passed!');
    }
  }

  /**
   * Upload reports as artifacts (for CI systems)
   */
  async uploadArtifacts(): Promise<void> {
    console.log('📤 Uploading CI artifacts...');
    
    // In a real CI system, this would upload to the appropriate service
    // For now, just log what would be uploaded
    const artifacts = await glob(join(this.reportsDir, '*.json'));
    
    console.log(`📦 Would upload ${artifacts.length} artifacts:`);
    for (const artifact of artifacts) {
      console.log(`  - ${artifact}`);
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const filesIndex = args.indexOf('--files');
  const uploadIndex = args.indexOf('--upload');

  const checker = new CIChecker();
  
  const changedFiles = filesIndex !== -1 ? args[filesIndex + 1].split(',') : undefined;
  
  checker.runChecks(changedFiles).then(report => {
    checker.printReport(report);
    
    if (uploadIndex !== -1) {
      checker.uploadArtifacts();
    }
  }).catch(error => {
    console.error('❌ CI checks failed:', error);
    process.exit(1);
  });
}


