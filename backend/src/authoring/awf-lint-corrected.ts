/**
 * AWF Linter (Corrected)
 * Corrected version with proper path detection logic
 */

import { readFileSync } from 'fs';
import { join } from 'path';

export interface LintIssue {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  path: string;
  suggestion?: string;
}

export interface LintResult {
  path: string;
  issues: LintIssue[];
  passed: boolean;
  errorCount: number;
  warningCount: number;
}

export interface LintReport {
  results: LintResult[];
  totalFiles: number;
  totalErrors: number;
  totalWarnings: number;
  passed: boolean;
}

export interface LintRule {
  name: string;
  severity: 'error' | 'warning' | 'info';
  check: (doc: any, path: string) => LintIssue[];
}

export class AwfLinter {
  private rules: LintRule[] = [];

  constructor() {
    this.registerRules();
  }

  private registerRules() {
    // World validation rules (flexible)
    this.rules.push({
      name: 'world_validation',
      severity: 'error',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Check if this is a world document
        if (!path.includes('worlds/')) {
          return issues;
        }

        // Validate required fields
        if (!doc.name || typeof doc.name !== 'string') {
          issues.push({
            rule: 'world_validation',
            severity: 'error',
            message: 'World missing required name',
            path,
            suggestion: 'Add world.name string'
          });
        }

        // Warn if timeworld missing (allowed but recommended)
        if (!doc.timeworld) {
          issues.push({
            rule: 'world_validation',
            severity: 'warning',
            message: 'World missing timeworld (recommended)',
            path,
            suggestion: 'Add timeworld object with timezone and calendar'
          });
        }

        // Check for large unknown objects (prevent bloat)
        Object.keys(doc).forEach(key => {
          if (!['id', 'name', 'version', 'timeworld', 'slices', 'i18n'].includes(key)) {
            const value = doc[key];
            if (typeof value === 'object' && value !== null) {
              const serialized = JSON.stringify(value);
              if (serialized.length > 2048) { // 2KB limit
                issues.push({
                  rule: 'world_validation',
                  severity: 'warning',
                  message: `World custom field '${key}' exceeds 2KB (${Math.round(serialized.length/1024)}KB)`,
                  path,
                  suggestion: 'Consider splitting large custom fields or reducing size'
                });
              }
            }
          }
        });

        return issues;
      }
    });

    // Adventure validation rules (flexible)
    this.rules.push({
      name: 'adventure_validation',
      severity: 'error',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Check if this is an adventure document
        if (!path.includes('adventures/')) {
          return issues;
        }

        // Validate required fields
        if (!doc.name || typeof doc.name !== 'string') {
          issues.push({
            rule: 'adventure_validation',
            severity: 'error',
            message: 'Adventure missing required name',
            path,
            suggestion: 'Add adventure.name string'
          });
        }

        if (!doc.world_ref || typeof doc.world_ref !== 'string') {
          issues.push({
            rule: 'adventure_validation',
            severity: 'error',
            message: 'Adventure missing required world_ref',
            path,
            suggestion: 'Add adventure.world_ref string'
          });
        }

        // Check cast length
        if (doc.cast && Array.isArray(doc.cast) && doc.cast.length > 12) {
          issues.push({
            rule: 'adventure_validation',
            severity: 'warning',
            message: `Adventure cast has ${doc.cast.length} NPCs, exceeds recommended limit of 12`,
            path,
            suggestion: 'Reduce cast size or consider splitting into multiple adventures'
          });
        }

        // Check for large unknown objects (prevent bloat)
        Object.keys(doc).forEach(key => {
          if (!['id', 'name', 'version', 'world_ref', 'synopsis', 'cast', 'slices', 'i18n'].includes(key)) {
            const value = doc[key];
            if (typeof value === 'object' && value !== null) {
              const serialized = JSON.stringify(value);
              if (serialized.length > 2048) { // 2KB limit
                issues.push({
                  rule: 'adventure_validation',
                  severity: 'warning',
                  message: `Adventure custom field '${key}' exceeds 2KB (${Math.round(serialized.length/1024)}KB)`,
                  path,
                  suggestion: 'Consider splitting large custom fields or reducing size'
                });
              }
            }
          }
        });

        return issues;
      }
    });

    // Bundle world/adventure validation
    this.rules.push({
      name: 'bundle_world_adv_validation',
      severity: 'warning',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Check bundle world/adventure blocks
        if (path.includes('bundles/') && doc.awf_bundle) {
          const bundle = doc.awf_bundle;
          
          // Check world block
          if (bundle.world) {
            if (!bundle.world.name || typeof bundle.world.name !== 'string') {
              issues.push({
                rule: 'bundle_world_adv_validation',
                severity: 'error',
                message: 'Bundle world missing name',
                path,
                suggestion: 'Add world.name string'
              });
            }
          }
          
          // Check adventure block
          if (bundle.adventure) {
            if (!bundle.adventure.name || typeof bundle.adventure.name !== 'string') {
              issues.push({
                rule: 'bundle_world_adv_validation',
                severity: 'error',
                message: 'Bundle adventure missing name',
                path,
                suggestion: 'Add adventure.name string'
              });
            }

            // Check adventure cast length
            if (bundle.adventure.cast && Array.isArray(bundle.adventure.cast)) {
              if (bundle.adventure.cast.length > 12) {
                issues.push({
                  rule: 'bundle_world_adv_validation',
                  severity: 'warning',
                  message: `Bundle adventure cast has ${bundle.adventure.cast.length} NPCs, may have been trimmed`,
                  path,
                  suggestion: 'Check if cast was trimmed due to token limits'
                });
              }
            }
          }
        }

        return issues;
      }
    });
  }

  lintDocument(doc: any, path: string): LintResult {
    const issues: LintIssue[] = [];
    
    // Apply all rules
    for (const rule of this.rules) {
      const ruleIssues = rule.check(doc, path);
      issues.push(...ruleIssues);
    }
    
    const errorCount = issues.filter(issue => issue.severity === 'error').length;
    const warningCount = issues.filter(issue => issue.severity === 'warning').length;
    
    return {
      path,
      issues,
      passed: errorCount === 0,
      errorCount,
      warningCount
    };
  }

  async lintFiles(paths: string[]): Promise<LintReport> {
    const results: LintResult[] = [];
    let totalErrors = 0;
    let totalWarnings = 0;

    for (const filePath of paths) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        const doc = JSON.parse(content);
        const result = this.lintDocument(doc, filePath);
        results.push(result);
        totalErrors += result.errorCount;
        totalWarnings += result.warningCount;
      } catch (error) {
        results.push({
          path: filePath,
          issues: [{
            rule: 'file_parse',
            severity: 'error',
            message: `Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`,
            path: filePath
          }],
          passed: false,
          errorCount: 1,
          warningCount: 0
        });
        totalErrors += 1;
      }
    }

    return {
      results,
      totalFiles: paths.length,
      totalErrors,
      totalWarnings,
      passed: totalErrors === 0
    };
  }
}
