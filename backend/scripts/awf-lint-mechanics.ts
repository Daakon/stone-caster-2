/**
 * AWF Mechanics Linter
 * Validates mechanics registries and checks for issues
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface LintResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

interface LintOptions {
  checkSkills: boolean;
  checkConditions: boolean;
  checkResources: boolean;
  checkConflicts: boolean;
  checkThresholds: boolean;
  verbose: boolean;
}

class MechanicsLinter {
  private options: LintOptions;

  constructor(options: Partial<LintOptions> = {}) {
    this.options = {
      checkSkills: true,
      checkConditions: true,
      checkResources: true,
      checkConflicts: true,
      checkThresholds: true,
      verbose: false,
      ...options,
    };
  }

  /**
   * Lint all mechanics registries
   */
  async lintAll(): Promise<LintResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Load registries
      const skills = await this.loadSkills();
      const conditions = await this.loadConditions();
      const resources = await this.loadResources();

      // Check skills
      if (this.options.checkSkills) {
        const skillResults = this.lintSkills(skills);
        errors.push(...skillResults.errors);
        warnings.push(...skillResults.warnings);
        suggestions.push(...skillResults.suggestions);
      }

      // Check conditions
      if (this.options.checkConditions) {
        const conditionResults = this.lintConditions(conditions);
        errors.push(...conditionResults.errors);
        warnings.push(...conditionResults.warnings);
        suggestions.push(...conditionResults.suggestions);
      }

      // Check resources
      if (this.options.checkResources) {
        const resourceResults = this.lintResources(resources);
        errors.push(...resourceResults.errors);
        warnings.push(...resourceResults.warnings);
        suggestions.push(...resourceResults.suggestions);
      }

      // Check conflicts
      if (this.options.checkConflicts) {
        const conflictResults = this.lintConflicts(skills, conditions, resources);
        errors.push(...conflictResults.errors);
        warnings.push(...conflictResults.warnings);
        suggestions.push(...conflictResults.suggestions);
      }

      // Check thresholds
      if (this.options.checkThresholds) {
        const thresholdResults = this.lintThresholds(skills, conditions, resources);
        errors.push(...thresholdResults.errors);
        warnings.push(...thresholdResults.warnings);
        suggestions.push(...thresholdResults.suggestions);
      }

    } catch (error) {
      errors.push(`Failed to load mechanics registries: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Load skills from database
   */
  private async loadSkills(): Promise<any[]> {
    const { data, error } = await supabase
      .from('mechanics_skills')
      .select('*');

    if (error) {
      throw new Error(`Failed to load skills: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Load conditions from database
   */
  private async loadConditions(): Promise<any[]> {
    const { data, error } = await supabase
      .from('mechanics_conditions')
      .select('*');

    if (error) {
      throw new Error(`Failed to load conditions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Load resources from database
   */
  private async loadResources(): Promise<any[]> {
    const { data, error } = await supabase
      .from('mechanics_resources')
      .select('*');

    if (error) {
      throw new Error(`Failed to load resources: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Lint skills registry
   */
  private lintSkills(skills: any[]): LintResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for duplicate IDs
    const ids = new Set<string>();
    for (const skill of skills) {
      if (ids.has(skill.id)) {
        errors.push(`Duplicate skill ID: ${skill.id}`);
      }
      ids.add(skill.id);
    }

    // Check baseline values
    for (const skill of skills) {
      if (skill.baseline < 0 || skill.baseline > 100) {
        warnings.push(`Skill ${skill.id}: baseline ${skill.baseline} outside recommended range (0-100)`);
      }
    }

    // Check for missing descriptions
    for (const skill of skills) {
      if (!skill.description || skill.description.trim().length === 0) {
        errors.push(`Skill ${skill.id}: missing description`);
      }
    }

    // Check for missing tags
    for (const skill of skills) {
      if (!skill.tags || skill.tags.length === 0) {
        suggestions.push(`Skill ${skill.id}: consider adding tags for categorization`);
      }
    }

    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  /**
   * Lint conditions registry
   */
  private lintConditions(conditions: any[]): LintResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for duplicate IDs
    const ids = new Set<string>();
    for (const condition of conditions) {
      if (ids.has(condition.id)) {
        errors.push(`Duplicate condition ID: ${condition.id}`);
      }
      ids.add(condition.id);
    }

    // Check stacking rules
    for (const condition of conditions) {
      if (condition.stacking === 'cap' && (!condition.cap || condition.cap < 1)) {
        errors.push(`Condition ${condition.id}: capped stacking requires cap > 0`);
      }
    }

    // Check cleanse keys
    for (const condition of conditions) {
      if (condition.cleanse_keys) {
        for (const cleanseKey of condition.cleanse_keys) {
          if (!conditions.find(c => c.id === cleanseKey)) {
            warnings.push(`Condition ${condition.id}: references unknown cleanse key ${cleanseKey}`);
          }
        }
      }
    }

    // Check tick hooks
    for (const condition of conditions) {
      if (condition.tick_hooks && condition.tick_hooks.resource_deltas) {
        for (const delta of condition.tick_hooks.resource_deltas) {
          if (!delta.key || typeof delta.delta !== 'number') {
            errors.push(`Condition ${condition.id}: invalid tick hook resource delta`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  /**
   * Lint resources registry
   */
  private lintResources(resources: any[]): LintResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for duplicate IDs
    const ids = new Set<string>();
    for (const resource of resources) {
      if (ids.has(resource.id)) {
        errors.push(`Duplicate resource ID: ${resource.id}`);
      }
      ids.add(resource.id);
    }

    // Check min/max values
    for (const resource of resources) {
      if (resource.min_value >= resource.max_value) {
        errors.push(`Resource ${resource.id}: min_value (${resource.min_value}) >= max_value (${resource.max_value})`);
      }
    }

    // Check regen/decay values
    for (const resource of resources) {
      if (resource.regen_per_tick < 0 || resource.regen_per_tick > 100) {
        warnings.push(`Resource ${resource.id}: regen_per_tick ${resource.regen_per_tick} outside recommended range (0-100)`);
      }
      if (resource.decay_per_tick < 0 || resource.decay_per_tick > 100) {
        warnings.push(`Resource ${resource.id}: decay_per_tick ${resource.decay_per_tick} outside recommended range (0-100)`);
      }
    }

    // Check for conflicting regen/decay
    for (const resource of resources) {
      if (resource.regen_per_tick > 0 && resource.decay_per_tick > 0) {
        suggestions.push(`Resource ${resource.id}: has both regen and decay - consider if this is intended`);
      }
    }

    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  /**
   * Lint for conflicts between registries
   */
  private lintConflicts(skills: any[], conditions: any[], resources: any[]): LintResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for ID conflicts
    const allIds = new Set<string>();
    const skillIds = skills.map(s => s.id);
    const conditionIds = conditions.map(c => c.id);
    const resourceIds = resources.map(r => r.id);

    for (const id of skillIds) {
      if (allIds.has(id)) {
        errors.push(`ID conflict: ${id} exists in multiple registries`);
      }
      allIds.add(id);
    }

    for (const id of conditionIds) {
      if (allIds.has(id)) {
        errors.push(`ID conflict: ${id} exists in multiple registries`);
      }
      allIds.add(id);
    }

    for (const id of resourceIds) {
      if (allIds.has(id)) {
        errors.push(`ID conflict: ${id} exists in multiple registries`);
      }
      allIds.add(id);
    }

    // Check for circular cleanse dependencies
    for (const condition of conditions) {
      if (condition.cleanse_keys) {
        for (const cleanseKey of condition.cleanse_keys) {
          const cleanseCondition = conditions.find(c => c.id === cleanseKey);
          if (cleanseCondition && cleanseCondition.cleanse_keys?.includes(condition.id)) {
            warnings.push(`Circular cleanse dependency: ${condition.id} <-> ${cleanseKey}`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  /**
   * Lint for missing thresholds and baselines
   */
  private lintThresholds(skills: any[], conditions: any[], resources: any[]): LintResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for skills with extreme baselines
    for (const skill of skills) {
      if (skill.baseline < 5) {
        warnings.push(`Skill ${skill.id}: very low baseline (${skill.baseline}) may make checks too difficult`);
      }
      if (skill.baseline > 95) {
        warnings.push(`Skill ${skill.id}: very high baseline (${skill.baseline}) may make checks too easy`);
      }
    }

    // Check for resources with extreme ranges
    for (const resource of resources) {
      const range = resource.max_value - resource.min_value;
      if (range < 10) {
        warnings.push(`Resource ${resource.id}: very small range (${range}) may limit gameplay variety`);
      }
      if (range > 1000) {
        warnings.push(`Resource ${resource.id}: very large range (${range}) may be difficult to balance`);
      }
    }

    // Check for missing resource definitions
    const resourceIds = new Set(resources.map(r => r.id));
    for (const condition of conditions) {
      if (condition.tick_hooks?.resource_deltas) {
        for (const delta of condition.tick_hooks.resource_deltas) {
          if (!resourceIds.has(delta.key)) {
            errors.push(`Condition ${condition.id}: references undefined resource ${delta.key}`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings, suggestions };
  }
}

/**
 * CLI entry point
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'lint') {
    const linter = new MechanicsLinter({ verbose: true });
    
    linter.lintAll().then(result => {
      console.log(`\nMechanics Lint Results:`);
      console.log(`Valid: ${result.valid ? '✅' : '❌'}`);
      
      if (result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach(error => console.log(`  ❌ ${error}`));
      }
      
      if (result.warnings.length > 0) {
        console.log('\nWarnings:');
        result.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
      }
      
      if (result.suggestions.length > 0) {
        console.log('\nSuggestions:');
        result.suggestions.forEach(suggestion => console.log(`  💡 ${suggestion}`));
      }

      process.exit(result.valid ? 0 : 1);
    }).catch(error => {
      console.error('Lint error:', error);
      process.exit(1);
    });
  } else {
    console.log('Usage:');
    console.log('  npm run awf:lint:mechanics lint');
    process.exit(1);
  }
}


