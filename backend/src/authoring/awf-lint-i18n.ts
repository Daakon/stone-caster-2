/**
 * AWF i18n Linter
 * Phase 12: Multilingual Support - Lint for localization quality
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
// import { glob } from 'glob'; // Commented out due to type issues

export interface LintResult {
  file: string;
  locale: string;
  errors: LintError[];
  warnings: LintWarning[];
}

export interface LintError {
  type: 'placeholder_loss' | 'length_exceeded' | 'mixed_language' | 'mechanics_leakage' | 'glossary_violation';
  message: string;
  line?: number;
  column?: number;
  context?: string;
}

export interface LintWarning {
  type: 'near_miss' | 'style_inconsistency' | 'unused_entry';
  message: string;
  line?: number;
  column?: number;
  context?: string;
}

export interface LintOptions {
  locale: string;
  paths: string[];
  strict?: boolean;
  outputFile?: string;
}

export class AWFI18nLinter {
  private locale: string;
  private strict: boolean;
  private rules: any;
  private glossary: any;

  constructor(locale: string, strict: boolean = false) {
    this.locale = locale;
    this.strict = strict;
    this.rules = this.loadLocalizationRules(locale);
    this.glossary = this.loadGlossary(locale);
  }

  /**
   * Lint localization files
   * @param paths - File paths to lint
   * @returns Array of lint results
   */
  async lint(paths: string[]): Promise<LintResult[]> {
    const results: LintResult[] = [];
    
    for (const path of paths) {
      try {
        const content = readFileSync(path, 'utf-8');
        const result = this.lintFile(path, content);
        results.push(result);
      } catch (error) {
        console.error(`[i18n Linter] Error reading file ${path}:`, error);
        results.push({
          file: path,
          locale: this.locale,
          errors: [{
            type: 'placeholder_loss',
            message: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          warnings: [],
        });
      }
    }
    
    return results;
  }

  /**
   * Lint a single file
   * @param filePath - File path
   * @param content - File content
   * @returns Lint result
   */
  private lintFile(filePath: string, content: string): LintResult {
    const errors: LintError[] = [];
    const warnings: LintWarning[] = [];
    
    try {
      const data = JSON.parse(content);
      
      // Lint based on file type
      if (filePath.includes('localization_packs')) {
        this.lintLocalizationPack(data, errors, warnings);
      } else if (filePath.includes('glossary')) {
        this.lintGlossary(data, errors, warnings);
      } else if (filePath.includes('rules')) {
        this.lintRules(data, errors, warnings);
      }
      
    } catch (error) {
      errors.push({
        type: 'placeholder_loss',
        message: `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
    
    return {
      file: filePath,
      locale: this.locale,
      errors,
      warnings,
    };
  }

  /**
   * Lint localization pack
   * @param data - Pack data
   * @param errors - Errors array
   * @param warnings - Warnings array
   */
  private lintLocalizationPack(data: any, errors: LintError[], warnings: LintWarning[]): void {
    if (!data.payload) return;
    
    const payload = data.payload;
    
    // Check for placeholder integrity
    this.checkPlaceholderIntegrity(payload, errors);
    
    // Check sentence length bounds
    this.checkSentenceLengthBounds(payload, errors);
    
    // Check for mixed language detection
    this.checkMixedLanguage(payload, errors);
    
    // Check for mechanics leakage
    this.checkMechanicsLeakage(payload, errors);
    
    // Check glossary conformity
    this.checkGlossaryConformity(payload, warnings);
  }

  /**
   * Lint glossary
   * @param data - Glossary data
   * @param errors - Errors array
   * @param warnings - Warnings array
   */
  private lintGlossary(data: any, errors: LintError[], warnings: LintWarning[]): void {
    if (!data.entries || !Array.isArray(data.entries)) {
      errors.push({
        type: 'glossary_violation',
        message: 'Glossary entries must be an array',
      });
      return;
    }
    
    for (const entry of data.entries) {
      if (!entry.term || !entry.preferred) {
        errors.push({
          type: 'glossary_violation',
          message: 'Glossary entries must have term and preferred fields',
        });
      }
    }
  }

  /**
   * Lint rules
   * @param data - Rules data
   * @param errors - Errors array
   * @param warnings - Warnings array
   */
  private lintRules(data: any, errors: LintError[], warnings: LintWarning[]): void {
    if (!data.policy) {
      errors.push({
        type: 'glossary_violation',
        message: 'Rules must have a policy object',
      });
      return;
    }
    
    const policy = data.policy;
    
    if (typeof policy.sentence_caps !== 'number' || policy.sentence_caps <= 0) {
      errors.push({
        type: 'glossary_violation',
        message: 'Policy must have valid sentence_caps number',
      });
    }
    
    if (typeof policy.choice_label_max !== 'number' || policy.choice_label_max <= 0) {
      errors.push({
        type: 'glossary_violation',
        message: 'Policy must have valid choice_label_max number',
      });
    }
    
    if (!Array.isArray(policy.forbidden_phrases)) {
      errors.push({
        type: 'glossary_violation',
        message: 'Policy must have forbidden_phrases array',
      });
    }
  }

  /**
   * Check placeholder integrity
   * @param payload - Payload to check
   * @param errors - Errors array
   */
  private checkPlaceholderIntegrity(payload: any, errors: LintError[]): void {
    const placeholders = ['{npc}', '{location}', '{objective}', '{item}', '{skill}'];
    
    const checkText = (text: string, context: string) => {
      if (typeof text !== 'string') return;
      
      for (const placeholder of placeholders) {
        if (text.includes(placeholder)) {
          // Check if placeholder is properly preserved
          const escapedPlaceholder = placeholder.replace(/[{}]/g, '\\$&');
          const regex = new RegExp(escapedPlaceholder, 'g');
          const matches = text.match(regex);
          
          if (!matches || matches.length === 0) {
            errors.push({
              type: 'placeholder_loss',
              message: `Placeholder ${placeholder} may have been lost in translation`,
              context,
            });
          }
        }
      }
    };
    
    // Check all text fields recursively
    this.walkObject(payload, (value, path) => {
      if (typeof value === 'string') {
        checkText(value, path);
      }
    });
  }

  /**
   * Check sentence length bounds
   * @param payload - Payload to check
   * @param errors - Errors array
   */
  private checkSentenceLengthBounds(payload: any, errors: LintError[]): void {
    const maxLength = this.rules.sentence_caps || 120;
    
    const checkText = (text: string, context: string) => {
      if (typeof text !== 'string') return;
      
      const sentences = text.split(/[.!?]+/);
      for (const sentence of sentences) {
        if (sentence.trim().length > maxLength) {
          errors.push({
            type: 'length_exceeded',
            message: `Sentence exceeds maximum length (${sentence.trim().length}/${maxLength})`,
            context,
          });
        }
      }
    };
    
    this.walkObject(payload, (value, path) => {
      if (typeof value === 'string') {
        checkText(value, path);
      }
    });
  }

  /**
   * Check for mixed language detection
   * @param payload - Payload to check
   * @param errors - Errors array
   */
  private checkMixedLanguage(payload: any, errors: LintError[]): void {
    if (this.locale === 'en-US') return; // Skip for English
    
    const englishWords = /\b(the|and|or|but|in|on|at|to|for|of|with|by|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|can|must|shall)\b/gi;
    
    const checkText = (text: string, context: string) => {
      if (typeof text !== 'string') return;
      
      const matches = text.match(englishWords);
      if (matches && matches.length > 2) {
        errors.push({
          type: 'mixed_language',
          message: `Text contains English words in ${this.locale} locale: ${matches.slice(0, 3).join(', ')}...`,
          context,
        });
      }
    };
    
    this.walkObject(payload, (value, path) => {
      if (typeof value === 'string') {
        checkText(value, path);
      }
    });
  }

  /**
   * Check for mechanics leakage
   * @param payload - Payload to check
   * @param errors - Errors array
   */
  private checkMechanicsLeakage(payload: any, errors: LintError[]): void {
    const forbiddenTerms = ['tick', 'band', 'TIME_ADVANCE', 'merge_delta', 'upsert_by_id'];
    
    const checkText = (text: string, context: string) => {
      if (typeof text !== 'string') return;
      
      for (const term of forbiddenTerms) {
        if (text.toLowerCase().includes(term.toLowerCase())) {
          errors.push({
            type: 'mechanics_leakage',
            message: `Forbidden mechanics term detected: ${term}`,
            context,
          });
        }
      }
    };
    
    this.walkObject(payload, (value, path) => {
      if (typeof value === 'string') {
        checkText(value, path);
      }
    });
  }

  /**
   * Check glossary conformity
   * @param payload - Payload to check
   * @param warnings - Warnings array
   */
  private checkGlossaryConformity(payload: any, warnings: LintWarning[]): void {
    if (!this.glossary || !this.glossary.entries) return;
    
    const glossaryTerms = new Map();
    for (const entry of this.glossary.entries) {
      glossaryTerms.set(entry.term.toLowerCase(), entry.preferred);
    }
    
    const checkText = (text: string, context: string) => {
      if (typeof text !== 'string') return;
      
      for (const [term, preferred] of glossaryTerms) {
        if (text.toLowerCase().includes(term) && !text.includes(preferred)) {
          warnings.push({
            type: 'near_miss',
            message: `Term "${term}" should be "${preferred}" according to glossary`,
            context,
          });
        }
      }
    };
    
    this.walkObject(payload, (value, path) => {
      if (typeof value === 'string') {
        checkText(value, path);
      }
    });
  }

  /**
   * Walk object recursively
   * @param obj - Object to walk
   * @param callback - Callback function
   * @param path - Current path
   */
  private walkObject(obj: any, callback: (value: any, path: string) => void, path: string = ''): void {
    if (obj === null || obj === undefined) return;
    
    if (typeof obj === 'string') {
      callback(obj, path);
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.walkObject(item, callback, `${path}[${index}]`);
      });
    } else if (typeof obj === 'object') {
      Object.entries(obj).forEach(([key, value]) => {
        this.walkObject(value, callback, path ? `${path}.${key}` : key);
      });
    }
  }

  /**
   * Load localization rules for locale
   * @param locale - Target locale
   * @returns Rules object
   */
  private loadLocalizationRules(locale: string): any {
    // Default rules - in production, load from database
    const defaultRules = {
      sentence_caps: 120,
      choice_label_max: 48,
      forbidden_phrases: [],
      formal_you: false,
    };
    
    // Locale-specific overrides
    const localeRules: Record<string, any> = {
      'fr-FR': { ...defaultRules, sentence_caps: 140, formal_you: true },
      'es-ES': { ...defaultRules, sentence_caps: 130, formal_you: true },
    };
    
    return localeRules[locale] || defaultRules;
  }

  /**
   * Load glossary for locale
   * @param locale - Target locale
   * @returns Glossary object
   */
  private loadGlossary(locale: string): any {
    // Default empty glossary - in production, load from database
    return {
      entries: [],
    };
  }
}

/**
 * CLI interface for i18n linter
 */
export async function runI18nLinter(options: LintOptions): Promise<void> {
  const linter = new AWFI18nLinter(options.locale, options.strict);
  
  // Use paths directly (glob expansion disabled for now)
  const allPaths = options.paths;
  
  if (allPaths.length === 0) {
    console.log('No files found to lint');
    return;
  }
  
  console.log(`[i18n Linter] Linting ${allPaths.length} files for locale ${options.locale}`);
  
  const results = await linter.lint(allPaths);
  
  // Report results
  let totalErrors = 0;
  let totalWarnings = 0;
  
  for (const result of results) {
    if (result.errors.length > 0 || result.warnings.length > 0) {
      console.log(`\n${result.file}:`);
      
      for (const error of result.errors) {
        console.log(`  ERROR: ${error.message}`);
        if (error.context) {
          console.log(`    Context: ${error.context}`);
        }
        totalErrors++;
      }
      
      for (const warning of result.warnings) {
        console.log(`  WARNING: ${warning.message}`);
        if (warning.context) {
          console.log(`    Context: ${warning.context}`);
        }
        totalWarnings++;
      }
    }
  }
  
  console.log(`\n[i18n Linter] Summary: ${totalErrors} errors, ${totalWarnings} warnings`);
  
  // Write report if requested
  if (options.outputFile) {
    const report = {
      timestamp: new Date().toISOString(),
      locale: options.locale,
      strict: options.strict,
      results,
      summary: {
        totalFiles: results.length,
        totalErrors,
        totalWarnings,
      },
    };
    
    const reportDir = join(process.cwd(), 'reports');
    if (!existsSync(reportDir)) {
      mkdirSync(reportDir, { recursive: true });
    }
    
    const reportPath = join(reportDir, options.outputFile);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`[i18n Linter] Report written to ${reportPath}`);
  }
  
  // Exit with error code if errors found and strict mode
  if (options.strict && totalErrors > 0) {
    process.exit(1);
  }
}
