/**
 * Phase 22: Mod Linter and Certification Pipeline
 * Validates mod packs, hooks, and enforces safety constraints
 */

import { z } from 'zod';
import { createHash } from 'crypto';

// Types
export interface LintResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  score: number;
}

export interface ModLintResult {
  namespace: string;
  manifest: LintResult;
  hooks: Record<string, LintResult>;
  overall: LintResult;
}

export interface CertificationResult {
  namespace: string;
  certified: boolean;
  score: number;
  errors: string[];
  warnings: string[];
  tests_passed: number;
  tests_total: number;
}

// Schemas
const ModManifestSchema = z.object({
  namespace: z.string().regex(/^[a-z0-9._-]+$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  awf_core: z.string(),
  declares: z.object({
    hooks: z.array(z.string()),
    slices: z.array(z.string()),
  }),
  permissions: z.object({
    acts: z.array(z.string()),
    perTurnActsMax: z.number().int().min(0).max(10),
    requiresCertification: z.boolean(),
  }),
});

const HookSchema = z.object({
  hook_id: z.string().regex(/^[a-z0-9._-]+$/),
  type: z.string(),
  guards: z.array(z.object({
    path: z.string(),
    op: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'has', 'contains', 'in', 'not_in']),
    val: z.any(),
  })),
  prob: z.string(),
  effects: z.array(z.object({
    act: z.string(),
    [z.string()]: z.any(),
  })),
});

export class ModLinter {
  private allowedActs: string[] = [
    'OBJECTIVE_UPDATE',
    'RESOURCE_DELTA',
    'ITEM_ADD',
    'ITEM_REMOVE',
    'APPLY_STATUS',
    'REMOVE_STATUS',
    'REQUEST_SLICE',
  ];

  private allowedHookTypes: string[] = [
    'onTurnStart',
    'onTurnEnd',
    'onAssemble',
    'onBeforeInfer',
    'onAfterInfer',
    'onApplyActs',
    'onNodeEnter',
    'onNodeExit',
    'onWeatherChange',
    'onRegionDrift',
    'onEventTrigger',
    'onRecruit',
    'onDismiss',
    'onLootRoll',
    'onVendorRefresh',
    'onCraftResult',
  ];

  private allowedSlicePaths: string[] = [
    'sim.weather',
    'sim.regions',
    'sim.events',
    'hot.objectives',
    'hot.inventory',
    'warm.relationships',
    'warm.party',
    'graph.current_node',
    'graph.visited_nodes',
  ];

  /**
   * Lint a mod pack
   */
  async lintModPack(
    namespace: string,
    manifest: any,
    hooks: any[]
  ): Promise<ModLintResult> {
    const result: ModLintResult = {
      namespace,
      manifest: { valid: true, errors: [], warnings: [], score: 0 },
      hooks: {},
      overall: { valid: true, errors: [], warnings: [], score: 0 },
    };

    // Lint manifest
    result.manifest = this.lintManifest(manifest);
    
    // Lint hooks
    for (const hook of hooks) {
      result.hooks[hook.hook_id] = this.lintHook(hook);
    }

    // Calculate overall score
    const manifestScore = result.manifest.score;
    const hookScores = Object.values(result.hooks).map(h => h.score);
    const avgHookScore = hookScores.length > 0 ? hookScores.reduce((a, b) => a + b, 0) / hookScores.length : 0;
    
    result.overall.score = Math.round((manifestScore + avgHookScore) / 2);
    result.overall.valid = result.manifest.valid && Object.values(result.hooks).every(h => h.valid);
    result.overall.errors = [...result.manifest.errors, ...Object.values(result.hooks).flatMap(h => h.errors)];
    result.overall.warnings = [...result.manifest.warnings, ...Object.values(result.hooks).flatMap(h => h.warnings)];

    return result;
  }

  /**
   * Lint manifest
   */
  private lintManifest(manifest: any): LintResult {
    const result: LintResult = {
      valid: true,
      errors: [],
      warnings: [],
      score: 0,
    };

    try {
      // Validate schema
      const validation = ModManifestSchema.safeParse(manifest);
      if (!validation.success) {
        result.errors.push(`Invalid manifest schema: ${validation.error.message}`);
        result.valid = false;
        return result;
      }

      // Check namespace format
      if (!/^[a-z0-9._-]+$/.test(manifest.namespace)) {
        result.errors.push('Invalid namespace format');
        result.valid = false;
      }

      // Check version format
      if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
        result.errors.push('Invalid version format');
        result.valid = false;
      }

      // Check AWF core compatibility
      if (!this.checkAWFCompatibility(manifest.awf_core)) {
        result.warnings.push('AWF core version may be incompatible');
      }

      // Check declared hooks
      for (const hook of manifest.declares.hooks) {
        if (!this.allowedHookTypes.includes(hook)) {
          result.errors.push(`Unknown hook type: ${hook}`);
          result.valid = false;
        }
      }

      // Check declared slices
      for (const slice of manifest.declares.slices) {
        if (!this.allowedSlicePaths.includes(slice)) {
          result.warnings.push(`Unknown slice path: ${slice}`);
        }
      }

      // Check permissions
      for (const act of manifest.permissions.acts) {
        if (!this.allowedActs.includes(act)) {
          result.errors.push(`Unknown act type: ${act}`);
          result.valid = false;
        }
      }

      // Check per-turn acts limit
      if (manifest.permissions.perTurnActsMax > 10) {
        result.warnings.push('High per-turn acts limit may impact performance');
      }

      // Calculate score
      result.score = this.calculateManifestScore(manifest);

    } catch (error) {
      result.errors.push(`Manifest linting error: ${error}`);
      result.valid = false;
    }

    return result;
  }

  /**
   * Lint hook
   */
  private lintHook(hook: any): LintResult {
    const result: LintResult = {
      valid: true,
      errors: [],
      warnings: [],
      score: 0,
    };

    try {
      // Validate schema
      const validation = HookSchema.safeParse(hook);
      if (!validation.success) {
        result.errors.push(`Invalid hook schema: ${validation.error.message}`);
        result.valid = false;
        return result;
      }

      // Check hook ID format
      if (!/^[a-z0-9._-]+$/.test(hook.hook_id)) {
        result.errors.push('Invalid hook ID format');
        result.valid = false;
      }

      // Check hook type
      if (!this.allowedHookTypes.includes(hook.type)) {
        result.errors.push(`Unknown hook type: ${hook.type}`);
        result.valid = false;
      }

      // Check guards
      for (const guard of hook.guards) {
        if (!this.isValidPath(guard.path)) {
          result.errors.push(`Invalid guard path: ${guard.path}`);
          result.valid = false;
        }
        
        if (!['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'has', 'contains', 'in', 'not_in'].includes(guard.op)) {
          result.errors.push(`Invalid guard operation: ${guard.op}`);
          result.valid = false;
        }
      }

      // Check probability expression
      if (!this.isValidProbabilityExpression(hook.prob)) {
        result.errors.push(`Invalid probability expression: ${hook.prob}`);
        result.valid = false;
      }

      // Check effects
      for (const effect of hook.effects) {
        if (!this.allowedActs.includes(effect.act)) {
          result.errors.push(`Unknown act type: ${effect.act}`);
          result.valid = false;
        }
      }

      // Check for explicit content
      if (this.containsExplicitContent(hook)) {
        result.errors.push('Hook contains explicit content');
        result.valid = false;
      }

      // Check complexity
      const complexity = this.calculateHookComplexity(hook);
      if (complexity > 50) {
        result.warnings.push('High hook complexity may impact performance');
      }

      // Calculate score
      result.score = this.calculateHookScore(hook, complexity);

    } catch (error) {
      result.errors.push(`Hook linting error: ${error}`);
      result.valid = false;
    }

    return result;
  }

  /**
   * Check AWF compatibility
   */
  private checkAWFCompatibility(awfCore: string): boolean {
    // This would check against current AWF core version
    // For now, always return true
    return true;
  }

  /**
   * Check if path is valid
   */
  private isValidPath(path: string): boolean {
    // Check for dangerous patterns
    const dangerousPatterns = [
      /\.\./,  // Path traversal
      /__proto__/,  // Prototype pollution
      /constructor/,  // Constructor access
      /prototype/,  // Prototype access
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(path)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if probability expression is valid
   */
  private isValidProbabilityExpression(prob: string): boolean {
    // Check for dangerous patterns
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /setTimeout\s*\(/,
      /setInterval\s*\(/,
      /require\s*\(/,
      /import\s*\(/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(prob)) {
        return false;
      }
    }

    // Check for balanced parentheses
    let parenCount = 0;
    for (const char of prob) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (parenCount < 0) return false;
    }

    return parenCount === 0;
  }

  /**
   * Check for explicit content
   */
  private containsExplicitContent(hook: any): boolean {
    const text = JSON.stringify(hook).toLowerCase();
    const explicitTerms = ['explicit', 'sexual', 'adult', 'nsfw', 'porn', 'xxx'];
    return explicitTerms.some(term => text.includes(term));
  }

  /**
   * Calculate hook complexity
   */
  private calculateHookComplexity(hook: any): number {
    let complexity = 0;
    
    // Count guards
    complexity += hook.guards?.length || 0;
    
    // Count effects
    complexity += hook.effects?.length || 0;
    
    // Count nested expressions
    const text = JSON.stringify(hook);
    complexity += (text.match(/\(/g) || []).length;
    
    return complexity;
  }

  /**
   * Calculate manifest score
   */
  private calculateManifestScore(manifest: any): number {
    let score = 0;
    
    // Base score
    score += 50;
    
    // Bonus for good practices
    if (manifest.permissions.perTurnActsMax <= 3) score += 10;
    if (manifest.permissions.requiresCertification) score += 10;
    if (manifest.declares.hooks.length <= 5) score += 10;
    if (manifest.declares.slices.length <= 3) score += 10;
    
    // Penalty for risky practices
    if (manifest.permissions.perTurnActsMax > 5) score -= 10;
    if (manifest.declares.hooks.length > 10) score -= 10;
    if (manifest.declares.slices.length > 5) score -= 10;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate hook score
   */
  private calculateHookScore(hook: any, complexity: number): number {
    let score = 0;
    
    // Base score
    score += 50;
    
    // Bonus for good practices
    if (hook.guards.length <= 3) score += 10;
    if (hook.effects.length <= 2) score += 10;
    if (complexity <= 20) score += 10;
    
    // Penalty for risky practices
    if (hook.guards.length > 5) score -= 10;
    if (hook.effects.length > 4) score -= 10;
    if (complexity > 50) score -= 20;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Certify mod pack
   */
  async certifyModPack(
    namespace: string,
    manifest: any,
    hooks: any[]
  ): Promise<CertificationResult> {
    const result: CertificationResult = {
      namespace,
      certified: false,
      score: 0,
      errors: [],
      warnings: [],
      tests_passed: 0,
      tests_total: 0,
    };

    try {
      // Run linting
      const lintResult = await this.lintModPack(namespace, manifest, hooks);
      
      if (!lintResult.overall.valid) {
        result.errors = lintResult.overall.errors;
        result.warnings = lintResult.overall.warnings;
        return result;
      }

      // Run tests
      const testResult = await this.runModTests(namespace, manifest, hooks);
      result.tests_passed = testResult.passed;
      result.tests_total = testResult.total;
      
      if (testResult.passed < testResult.total) {
        result.errors.push('Some tests failed');
        return result;
      }

      // Calculate final score
      result.score = Math.round((lintResult.overall.score + testResult.score) / 2);
      
      // Certification requirements
      if (result.score >= 80 && result.tests_passed === result.tests_total) {
        result.certified = true;
      } else {
        result.errors.push('Score too low or tests failed');
      }

      result.warnings = lintResult.overall.warnings;

    } catch (error) {
      result.errors.push(`Certification failed: ${error}`);
    }

    return result;
  }

  /**
   * Run mod tests
   */
  private async runModTests(
    namespace: string,
    manifest: any,
    hooks: any[]
  ): Promise<{
    passed: number;
    total: number;
    score: number;
  }> {
    const tests = [
      this.testManifestValidation(manifest),
      this.testHookExecution(hooks),
      this.testSafetyConstraints(hooks),
      this.testPerformanceConstraints(hooks),
    ];

    const results = await Promise.all(tests);
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const score = results.reduce((sum, r) => sum + r.score, 0) / results.length;

    return { passed, total, score };
  }

  /**
   * Test manifest validation
   */
  private async testManifestValidation(manifest: any): Promise<{
    passed: boolean;
    score: number;
  }> {
    try {
      const validation = ModManifestSchema.safeParse(manifest);
      return {
        passed: validation.success,
        score: validation.success ? 100 : 0,
      };
    } catch (error) {
      return { passed: false, score: 0 };
    }
  }

  /**
   * Test hook execution
   */
  private async testHookExecution(hooks: any[]): Promise<{
    passed: boolean;
    score: number;
  }> {
    try {
      // Test that hooks can be parsed and validated
      for (const hook of hooks) {
        const validation = HookSchema.safeParse(hook);
        if (!validation.success) {
          return { passed: false, score: 0 };
        }
      }
      
      return { passed: true, score: 100 };
    } catch (error) {
      return { passed: false, score: 0 };
    }
  }

  /**
   * Test safety constraints
   */
  private async testSafetyConstraints(hooks: any[]): Promise<{
    passed: boolean;
    score: number;
  }> {
    try {
      for (const hook of hooks) {
        if (this.containsExplicitContent(hook)) {
          return { passed: false, score: 0 };
        }
      }
      
      return { passed: true, score: 100 };
    } catch (error) {
      return { passed: false, score: 0 };
    }
  }

  /**
   * Test performance constraints
   */
  private async testPerformanceConstraints(hooks: any[]): Promise<{
    passed: boolean;
    score: number;
  }> {
    try {
      let totalComplexity = 0;
      
      for (const hook of hooks) {
        const complexity = this.calculateHookComplexity(hook);
        totalComplexity += complexity;
      }
      
      const avgComplexity = totalComplexity / hooks.length;
      const score = Math.max(0, 100 - avgComplexity);
      
      return {
        passed: avgComplexity <= 50,
        score,
      };
    } catch (error) {
      return { passed: false, score: 0 };
    }
  }
}

// CLI interface
export async function runModLinter(args: string[]): Promise<void> {
  const linter = new ModLinter();
  
  if (args.length < 2) {
    console.error('Usage: awf-lint-mods <namespace> [--certify]');
    process.exit(1);
  }

  const namespace = args[0];
  const certify = args.includes('--certify');

  try {
    // This would load the mod pack from database
    // For now, use mock data
    const manifest = {
      namespace: 'author.test_mod',
      version: '1.0.0',
      awf_core: '>=1.12.0',
      declares: {
        hooks: ['onTurnStart'],
        slices: ['sim.weather'],
      },
      permissions: {
        acts: ['RESOURCE_DELTA'],
        perTurnActsMax: 1,
        requiresCertification: true,
      },
    };

    const hooks = [
      {
        hook_id: 'test_hook',
        type: 'onTurnStart',
        guards: [
          { path: 'sim.weather.state', op: 'eq', val: 'rain' }
        ],
        prob: 'seeded(0.5)',
        effects: [
          { act: 'RESOURCE_DELTA', key: 'energy', delta: -1 }
        ],
      },
    ];

    if (certify) {
      const result = await linter.certifyModPack(namespace, manifest, hooks);
      console.log('Certification Result:', result);
    } else {
      const result = await linter.lintModPack(namespace, manifest, hooks);
      console.log('Lint Result:', result);
    }

  } catch (error) {
    console.error('Linter error:', error);
    process.exit(1);
  }
}

// Export for use in other modules
export { ModLinter as ModLinterClass };
