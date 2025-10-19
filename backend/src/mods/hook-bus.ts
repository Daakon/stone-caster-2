/**
 * Phase 22: Hook Bus & Engine
 * Manages procedural hooks and their execution
 */

import { z } from 'zod';
import { ModPacksService, ModHook } from './packs-service';
import { DSLInterpreter } from './dsl-interpreter';

// Types
export interface HookContext {
  session_id: string;
  turn_id: number;
  hook_type: string;
  game_state: any;
  slices: Record<string, any>;
  timestamp: number;
}

export interface HookResult {
  namespace: string;
  hook_id: string;
  executed: boolean;
  acts: any[];
  execution_ms: number;
  violations: string[];
  tokens_used: number;
}

export interface HookMetrics {
  namespace: string;
  hook_id: string;
  invocations: number;
  acts_emitted: number;
  tokens_used: number;
  violations: number;
  execution_ms: number;
}

// Hook types
export const HOOK_TYPES = {
  // Turn hooks
  TURN_START: 'onTurnStart',
  TURN_END: 'onTurnEnd',
  ASSEMBLE: 'onAssemble',
  BEFORE_INFER: 'onBeforeInfer',
  AFTER_INFER: 'onAfterInfer',
  APPLY_ACTS: 'onApplyActs',
  
  // Graph hooks
  NODE_ENTER: 'onNodeEnter',
  NODE_EXIT: 'onNodeExit',
  
  // World sim hooks
  WEATHER_CHANGE: 'onWeatherChange',
  REGION_DRIFT: 'onRegionDrift',
  EVENT_TRIGGER: 'onEventTrigger',
  
  // Party hooks
  RECRUIT: 'onRecruit',
  DISMISS: 'onDismiss',
  
  // Economy hooks
  LOOT_ROLL: 'onLootRoll',
  VENDOR_REFRESH: 'onVendorRefresh',
  CRAFT_RESULT: 'onCraftResult',
} as const;

export type HookType = typeof HOOK_TYPES[keyof typeof HOOK_TYPES];

export class HookBus {
  private modPacksService: ModPacksService;
  private dslInterpreter: DSLInterpreter;
  private config: any;
  private metrics: Map<string, HookMetrics> = new Map();

  constructor(modPacksService: ModPacksService, config: any) {
    this.modPacksService = modPacksService;
    this.dslInterpreter = new DSLInterpreter();
    this.config = config;
  }

  /**
   * Run hooks for a specific type
   */
  async runHooks(
    hookType: HookType,
    context: HookContext
  ): Promise<HookResult[]> {
    const startTime = Date.now();
    const results: HookResult[] = [];

    try {
      // Get enabled hooks for this type
      const hooks = await this.modPacksService.getModHooks(hookType);
      
      if (hooks.length === 0) {
        return results;
      }

      // Check quota limits
      const quotaCheck = await this.checkQuotas(hookType, hooks.length);
      if (!quotaCheck.allowed) {
        console.warn(`Hook quota exceeded for ${hookType}: ${quotaCheck.reason}`);
        return results;
      }

      // Execute hooks in priority order
      for (const hook of hooks) {
        const hookStartTime = Date.now();
        
        try {
          const result = await this.executeHook(hook, context);
          const executionMs = Date.now() - hookStartTime;
          
          results.push({
            namespace: hook.namespace,
            hook_id: hook.hook_id,
            executed: result.executed,
            acts: result.acts,
            execution_ms: executionMs,
            violations: result.violations,
            tokens_used: result.tokens_used,
          });

          // Record metrics
          await this.recordHookMetrics(hook, result, executionMs);

        } catch (error) {
          console.error(`Hook execution failed: ${hook.namespace}.${hook.hook_id}`, error);
          
          results.push({
            namespace: hook.namespace,
            hook_id: hook.hook_id,
            executed: false,
            acts: [],
            execution_ms: Date.now() - hookStartTime,
            violations: [`Execution error: ${error}`],
            tokens_used: 0,
          });
        }
      }

      // Record overall metrics
      const totalExecutionMs = Date.now() - startTime;
      await this.recordOverallMetrics(hookType, results, totalExecutionMs);

      return results;

    } catch (error) {
      console.error(`Hook bus execution failed for ${hookType}:`, error);
      return results;
    }
  }

  /**
   * Execute a single hook
   */
  private async executeHook(
    hook: ModHook,
    context: HookContext
  ): Promise<{
    executed: boolean;
    acts: any[];
    violations: string[];
    tokens_used: number;
  }> {
    const violations: string[] = [];
    let tokens_used = 0;

    try {
      // Validate hook document
      const hookDoc = hook.doc;
      if (!hookDoc.guards || !hookDoc.effects) {
        violations.push('Invalid hook document structure');
        return {
          executed: false,
          acts: [],
          violations,
          tokens_used: 0,
        };
      }

      // Evaluate guards
      const guardResults = await this.evaluateGuards(hookDoc.guards, context);
      if (!guardResults.all_passed) {
        return {
          executed: false,
          acts: [],
          violations: guardResults.violations,
          tokens_used: 0,
        };
      }

      // Evaluate probability
      const probability = await this.evaluateProbability(hookDoc.prob, context, hook);
      if (Math.random() > probability) {
        return {
          executed: false,
          acts: [],
          violations: [],
          tokens_used: 0,
        };
      }

      // Generate acts from effects
      const acts = await this.generateActs(hookDoc.effects, context, hook);
      
      // Validate acts
      const actValidation = await this.validateActs(acts, hook);
      if (!actValidation.valid) {
        violations.push(...actValidation.errors);
        return {
          executed: false,
          acts: [],
          violations,
          tokens_used: 0,
        };
      }

      // Calculate tokens used
      tokens_used = this.calculateTokensUsed(context, acts);

      return {
        executed: true,
        acts,
        violations,
        tokens_used,
      };

    } catch (error) {
      violations.push(`Hook execution error: ${error}`);
      return {
        executed: false,
        acts: [],
        violations,
        tokens_used: 0,
      };
    }
  }

  /**
   * Evaluate hook guards
   */
  private async evaluateGuards(
    guards: any[],
    context: HookContext
  ): Promise<{
    all_passed: boolean;
    violations: string[];
  }> {
    const violations: string[] = [];

    for (const guard of guards) {
      try {
        const result = await this.dslInterpreter.evaluateGuard(guard, context);
        if (!result.passed) {
          violations.push(`Guard failed: ${guard.path} ${guard.op} ${guard.val}`);
        }
      } catch (error) {
        violations.push(`Guard evaluation error: ${error}`);
      }
    }

    return {
      all_passed: violations.length === 0,
      violations,
    };
  }

  /**
   * Evaluate probability expression
   */
  private async evaluateProbability(
    prob: string,
    context: HookContext,
    hook: ModHook
  ): Promise<number> {
    try {
      if (prob.startsWith('seeded(')) {
        const match = prob.match(/seeded\(([0-9.]+)\)/);
        if (match) {
          const value = parseFloat(match[1]);
          const seed = `${hook.namespace}:${context.session_id}:${context.turn_id}:${hook.hook_id}`;
          return this.dslInterpreter.seededRandom(seed, value);
        }
      }
      
      return parseFloat(prob) || 0;
    } catch (error) {
      console.error(`Probability evaluation error: ${error}`);
      return 0;
    }
  }

  /**
   * Generate acts from effects
   */
  private async generateActs(
    effects: any[],
    context: HookContext,
    hook: ModHook
  ): Promise<any[]> {
    const acts: any[] = [];

    for (const effect of effects) {
      if (effect.act) {
        acts.push({
          type: effect.act,
          ...effect,
          _mod_namespace: hook.namespace,
          _mod_hook_id: hook.hook_id,
        });
      }
    }

    return acts;
  }

  /**
   * Validate generated acts
   */
  private async validateActs(
    acts: any[],
    hook: ModHook
  ): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Check act count limit
    if (acts.length > this.config.max_acts_per_turn) {
      errors.push(`Too many acts: ${acts.length} > ${this.config.max_acts_per_turn}`);
    }

    // Check for explicit content
    for (const act of acts) {
      if (this.containsExplicitContent(act)) {
        errors.push('Act contains explicit content');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check for explicit content
   */
  private containsExplicitContent(act: any): boolean {
    const text = JSON.stringify(act).toLowerCase();
    const explicitTerms = ['explicit', 'sexual', 'adult', 'nsfw'];
    return explicitTerms.some(term => text.includes(term));
  }

  /**
   * Calculate tokens used
   */
  private calculateTokensUsed(context: HookContext, acts: any[]): number {
    // Simple token estimation
    const contextTokens = JSON.stringify(context).length / 4;
    const actsTokens = JSON.stringify(acts).length / 4;
    return Math.ceil(contextTokens + actsTokens);
  }

  /**
   * Check quota limits
   */
  private async checkQuotas(
    hookType: HookType,
    hookCount: number
  ): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    // Check max hooks per turn
    if (hookCount > this.config.max_hooks_per_turn) {
      return {
        allowed: false,
        reason: `Too many hooks: ${hookCount} > ${this.config.max_hooks_per_turn}`,
      };
    }

    // Check execution time limit
    if (this.config.max_eval_ms > 0) {
      // This would be checked during execution
    }

    return { allowed: true };
  }

  /**
   * Record hook metrics
   */
  private async recordHookMetrics(
    hook: ModHook,
    result: any,
    executionMs: number
  ): Promise<void> {
    const key = `${hook.namespace}.${hook.hook_id}`;
    const existing = this.metrics.get(key) || {
      namespace: hook.namespace,
      hook_id: hook.hook_id,
      invocations: 0,
      acts_emitted: 0,
      tokens_used: 0,
      violations: 0,
      execution_ms: 0,
    };

    existing.invocations += 1;
    existing.acts_emitted += result.acts.length;
    existing.tokens_used += result.tokens_used;
    existing.violations += result.violations.length;
    existing.execution_ms += executionMs;

    this.metrics.set(key, existing);

    // Record in database
    await this.modPacksService.recordMetrics(
      hook.namespace,
      hook.hook_id,
      'execution_ms',
      executionMs
    );
  }

  /**
   * Record overall metrics
   */
  private async recordOverallMetrics(
    hookType: HookType,
    results: HookResult[],
    totalExecutionMs: number
  ): Promise<void> {
    const totalActs = results.reduce((sum, r) => sum + r.acts.length, 0);
    const totalTokens = results.reduce((sum, r) => sum + r.tokens_used, 0);
    const totalViolations = results.reduce((sum, r) => sum + r.violations.length, 0);

    console.log(`Hook bus metrics for ${hookType}:`, {
      hooks_executed: results.length,
      total_acts: totalActs,
      total_tokens: totalTokens,
      total_violations: totalViolations,
      execution_ms: totalExecutionMs,
    });
  }

  /**
   * Get hook metrics
   */
  getMetrics(): Map<string, HookMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
  }
}

// Singleton instance
let hookBus: HookBus | null = null;

export function getHookBus(modPacksService: ModPacksService, config: any): HookBus {
  if (!hookBus) {
    hookBus = new HookBus(modPacksService, config);
  }
  return hookBus;
}
