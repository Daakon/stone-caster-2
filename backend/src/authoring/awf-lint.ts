import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
// @ts-ignore - glob module types
import { glob } from 'glob';

export interface LintRule {
  name: string;
  severity: 'error' | 'warning';
  check: (doc: any, path: string) => LintIssue[];
}

export interface LintIssue {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  path: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface LintConfig {
  rules: {
    [key: string]: {
      enabled: boolean;
      severity?: 'error' | 'warning';
      options?: any;
    };
  };
  ignore: string[];
  strict: boolean;
}

export interface LintResult {
  path: string;
  issues: LintIssue[];
  passed: boolean;
  errorCount: number;
  warningCount: number;
}

export interface LintReport {
  timestamp: string;
  config: LintConfig;
  results: LintResult[];
  summary: {
    totalFiles: number;
    passedFiles: number;
    failedFiles: number;
    totalErrors: number;
    totalWarnings: number;
  };
}

export class AwfLinter {
  private config: LintConfig;
  private rules: LintRule[] = [];

  constructor(configPath?: string) {
    this.config = this.loadConfig(configPath);
    this.registerRules();
  }

  private loadConfig(configPath?: string): LintConfig {
    const defaultConfig: LintConfig = {
      rules: {
        schema_validation: { enabled: true, severity: 'error' },
        tone_policy: { enabled: true, severity: 'error' },
        acts_budget: { enabled: true, severity: 'warning' },
        first_turn_rules: { enabled: true, severity: 'error' },
        slice_coverage: { enabled: true, severity: 'warning' },
        stable_ids: { enabled: true, severity: 'error' },
        time_bands: { enabled: true, severity: 'error' }
      },
      ignore: ['node_modules/**', '.git/**'],
      strict: false
    };

    if (configPath && existsSync(configPath)) {
      try {
        const configContent = readFileSync(configPath, 'utf-8');
        const userConfig = JSON.parse(configContent);
        return { ...defaultConfig, ...userConfig };
      } catch (error) {
        console.warn(`Failed to load config from ${configPath}, using defaults`);
      }
    }

    return defaultConfig;
  }

  private registerRules(): void {
    // Schema validation rule
    this.rules.push({
      name: 'schema_validation',
      severity: 'error',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Check required fields based on document type
        if (path.includes('core/contract')) {
          if (!doc.contract) {
            issues.push({
              rule: 'schema_validation',
              severity: 'error',
              message: 'Missing required field: contract',
              path
            });
          }
          if (!doc.contract?.acts) {
            issues.push({
              rule: 'schema_validation',
              severity: 'error',
              message: 'Missing required field: contract.acts',
              path
            });
          }
        }

        if (path.includes('worlds/')) {
          if (!doc.world) {
            issues.push({
              rule: 'schema_validation',
              severity: 'error',
              message: 'Missing required field: world',
              path
            });
          }
        }

        if (path.includes('adventures/')) {
          if (!doc.adventure) {
            issues.push({
              rule: 'schema_validation',
              severity: 'error',
              message: 'Missing required field: adventure',
              path
            });
          }
        }

        if (path.includes('start/')) {
          if (!doc.adventure_start) {
            issues.push({
              rule: 'schema_validation',
              severity: 'error',
              message: 'Missing required field: adventure_start',
              path
            });
          }
        }

        return issues;
      }
    });

    // Tone policy rule
    this.rules.push({
      name: 'tone_policy',
      severity: 'error',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Check txt.policy sentence bounds (2-6 sentences)
        if (doc.contract?.txt?.policy) {
          const sentences = doc.contract.txt.policy.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
          if (sentences.length < 2 || sentences.length > 6) {
            issues.push({
              rule: 'tone_policy',
              severity: 'error',
              message: `txt.policy must have 2-6 sentences, found ${sentences.length}`,
              path,
              suggestion: 'Adjust sentence count to be between 2-6 sentences'
            });
          }
        }

        // Check for mechanics in txt (should be in acts, not txt)
        if (doc.contract?.txt?.policy) {
          const mechanics = ['[', ']', '{', '}', 'roll', 'dice', 'skill', 'check'];
          const hasMechanics = mechanics.some(mech => 
            doc.contract.txt.policy.toLowerCase().includes(mech)
          );
          if (hasMechanics) {
            issues.push({
              rule: 'tone_policy',
              severity: 'error',
              message: 'txt.policy should not contain mechanics (use acts instead)',
              path,
              suggestion: 'Move mechanical content to acts section'
            });
          }
        }

        // Check choice labels ≤ 48 chars
        if (doc.contract?.choices) {
          doc.contract.choices.forEach((choice: any, index: number) => {
            if (choice.label && choice.label.length > 48) {
              issues.push({
                rule: 'tone_policy',
                severity: 'error',
                message: `Choice ${index + 1} label exceeds 48 characters (${choice.label.length})`,
                path,
                suggestion: `Shorten label to ≤48 characters: "${choice.label.substring(0, 45)}..."`
              });
            }
          });
        }

        return issues;
      }
    });

    // Acts budget rule
    this.rules.push({
      name: 'acts_budget',
      severity: 'warning',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        if (doc.contract?.acts) {
          const allowedActs = doc.contract.acts.allowed || [];
          const exemplars = doc.contract.acts.exemplars || {};
          
          // Check if acts listed in contract.acts.allowed
          if (allowedActs.length === 0) {
            issues.push({
              rule: 'acts_budget',
              severity: 'warning',
              message: 'No acts listed in contract.acts.allowed',
              path,
              suggestion: 'Add allowed acts to contract.acts.allowed'
            });
          }

          // Warn on unused exemplars
          const usedExemplars = Object.keys(exemplars);
          const unusedExemplars = usedExemplars.filter(act => !allowedActs.includes(act));
          if (unusedExemplars.length > 0) {
            issues.push({
              rule: 'acts_budget',
              severity: 'warning',
              message: `Unused exemplars found: ${unusedExemplars.join(', ')}`,
              path,
              suggestion: 'Remove unused exemplars or add them to allowed acts'
            });
          }
        }

        return issues;
      }
    });

    // First-turn rules
    this.rules.push({
      name: 'first_turn_rules',
      severity: 'error',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Start docs must set rules.no_time_advance=true
        if (path.includes('start/')) {
          if (!doc.adventure_start?.rules?.no_time_advance) {
            issues.push({
              rule: 'first_turn_rules',
              severity: 'error',
              message: 'Start documents must set rules.no_time_advance=true',
              path,
              suggestion: 'Add "rules": {"no_time_advance": true} to adventure_start'
            });
          }
        }

        return issues;
      }
    });

    // Slice coverage rule
    this.rules.push({
      name: 'slice_coverage',
      severity: 'warning',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Warn if missing slice names for world/adventure
        if (path.includes('worlds/') && doc.world) {
          if (!doc.world.slices || Object.keys(doc.world.slices).length === 0) {
            issues.push({
              rule: 'slice_coverage',
              severity: 'warning',
              message: 'World document missing slice definitions',
              path,
              suggestion: 'Add slice definitions to reduce token usage'
            });
          }
        }

        if (path.includes('adventures/') && doc.adventure) {
          if (!doc.adventure.slices || Object.keys(doc.adventure.slices).length === 0) {
            issues.push({
              rule: 'slice_coverage',
              severity: 'warning',
              message: 'Adventure document missing slice definitions',
              path,
              suggestion: 'Add slice definitions to reduce token usage'
            });
          }
        }

        return issues;
      }
    });

    // Stable IDs rule
    this.rules.push({
      name: 'stable_ids',
      severity: 'error',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Check for stable IDs in locations/npcs/objectives
        const checkIds = (items: any[], type: string) => {
          items?.forEach((item: any, index: number) => {
            if (item.id) {
              // Forbid whitespace/uppercase
              if (item.id !== item.id.toLowerCase()) {
                issues.push({
                  rule: 'stable_ids',
                  severity: 'error',
                  message: `${type} ${index + 1} ID contains uppercase: "${item.id}"`,
                  path,
                  suggestion: `Use lowercase ID: "${item.id.toLowerCase()}"`
                });
              }
              if (item.id.includes(' ')) {
                issues.push({
                  rule: 'stable_ids',
                  severity: 'error',
                  message: `${type} ${index + 1} ID contains whitespace: "${item.id}"`,
                  path,
                  suggestion: `Use underscore or kebab-case: "${item.id.replace(/\s+/g, '_')}"`
                });
              }
            }
          });
        };

        if (doc.world?.places) {
          checkIds(doc.world.places, 'Place');
        }
        if (doc.world?.npcs) {
          checkIds(doc.world.npcs, 'NPC');
        }
        if (doc.adventure?.objectives) {
          checkIds(doc.adventure.objectives, 'Objective');
        }

        return issues;
      }
    });

    // Time bands rule
    this.rules.push({
      name: 'time_bands',
      severity: 'error',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        if (path.includes('worlds/') && doc.world?.timeworld?.bands) {
          const bands = doc.world.timeworld.bands;
          
          // Check for at least 4 bands
          if (bands.length < 4) {
            issues.push({
              rule: 'time_bands',
              severity: 'error',
              message: `World must have ≥4 time bands, found ${bands.length}`,
              path,
              suggestion: 'Add more time bands to create a cyclic schedule'
            });
          }

          // Check that bands sum to cyclic schedule
          const totalTicks = bands.reduce((sum: number, band: any) => sum + (band.ticks || 0), 0);
          if (totalTicks === 0) {
            issues.push({
              rule: 'time_bands',
              severity: 'error',
              message: 'Time bands must have non-zero tick values',
              path,
              suggestion: 'Set appropriate tick values for each band'
            });
          }
        }

        return issues;
      }
    });
  }

  async lintFiles(paths: string[]): Promise<LintReport> {
    const results: LintResult[] = [];
    let totalErrors = 0;
    let totalWarnings = 0;

    for (const pattern of paths) {
      const files = await glob(pattern, { ignore: this.config.ignore });
      
      if (!Array.isArray(files)) {
        console.warn(`No files found for pattern: ${pattern}`);
        continue;
      }
      
      for (const file of files) {
        try {
          const content = readFileSync(file, 'utf-8');
          const doc = JSON.parse(content);
          
          const result = this.lintDocument(doc, file);
          results.push(result);
          
          totalErrors += result.errorCount;
          totalWarnings += result.warningCount;
        } catch (error) {
          results.push({
            path: file,
            issues: [{
              rule: 'parse_error',
              severity: 'error',
              message: `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`,
              path: file
            }],
            passed: false,
            errorCount: 1,
            warningCount: 0
          });
          totalErrors += 1;
        }
      }
    }

    const passedFiles = results.filter(r => r.passed).length;
    const failedFiles = results.length - passedFiles;

    return {
      timestamp: new Date().toISOString(),
      config: this.config,
      results,
      summary: {
        totalFiles: results.length,
        passedFiles,
        failedFiles,
        totalErrors,
        totalWarnings
      }
    };
  }

  public lintDocument(doc: any, path: string): LintResult {
    const issues: LintIssue[] = [];
    
    for (const rule of this.rules) {
      const ruleConfig = this.config.rules[rule.name];
      if (!ruleConfig?.enabled) continue;
      
      const ruleIssues = rule.check(doc, path);
      const filteredIssues = ruleIssues.map(issue => ({
        ...issue,
        severity: ruleConfig.severity || rule.severity
      }));
      
      issues.push(...filteredIssues);
    }

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const passed = errorCount === 0;

    return {
      path,
      issues,
      passed,
      errorCount,
      warningCount
    };
  }

  printReport(report: LintReport): void {
    console.log('\n🔍 AWF Lint Report');
    console.log('='.repeat(50));
    
    if (report.summary.totalErrors === 0 && report.summary.totalWarnings === 0) {
      console.log('✅ All files passed linting!');
      return;
    }

    console.log(`📊 Summary: ${report.summary.passedFiles}/${report.summary.totalFiles} files passed`);
    console.log(`❌ Errors: ${report.summary.totalErrors}`);
    console.log(`⚠️  Warnings: ${report.summary.totalWarnings}\n`);

    for (const result of report.results) {
      if (result.issues.length === 0) continue;

      console.log(`📄 ${result.path}`);
      console.log('-'.repeat(result.path.length));

      for (const issue of result.issues) {
        const icon = issue.severity === 'error' ? '❌' : '⚠️';
        console.log(`${icon} [${issue.rule}] ${issue.message}`);
        if (issue.suggestion) {
          console.log(`   💡 ${issue.suggestion}`);
        }
      }
      console.log();
    }
  }

  saveReport(report: LintReport, outputPath: string): void {
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved to: ${outputPath}`);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const pathsIndex = args.indexOf('--paths');
  const strictIndex = args.indexOf('--strict');
  const configIndex = args.indexOf('--config');
  const outputIndex = args.indexOf('--output');

  const paths = pathsIndex !== -1 && args[pathsIndex + 1] 
    ? args[pathsIndex + 1].split(',')
    : ['**/*.json'];
  
  const strict = strictIndex !== -1;
  const configPath = configIndex !== -1 ? args[configIndex + 1] : undefined;
  const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : undefined;

  const linter = new AwfLinter(configPath);
  
  linter.lintFiles(paths).then(report => {
    linter.printReport(report);
    
    if (outputPath) {
      linter.saveReport(report, outputPath);
    }

    // Exit codes: 0 (clean), 1 (errors), 2 (warnings-only when --strict off)
    if (report.summary.totalErrors > 0) {
      process.exit(1);
    } else if (strict && report.summary.totalWarnings > 0) {
      process.exit(2);
    } else {
      process.exit(0);
    }
  }).catch(error => {
    console.error('Linting failed:', error);
    process.exit(1);
  });
}
