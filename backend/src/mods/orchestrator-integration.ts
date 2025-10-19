/**
 * Phase 22: Orchestrator Integration
 * Wires procedural hooks into turn flow and engine integration points
 */

import { HookBus, HookContext, HOOK_TYPES } from './hook-bus';
import { ModPacksService } from './packs-service';
import { AssemblerModIntegration } from './assembler-integration';

// Types
export interface OrchestratorContext {
  session_id: string;
  turn_id: number;
  game_state: any;
  slices: Record<string, any>;
  timestamp: number;
}

export interface TurnHookResult {
  turn_start: any[];
  assemble: any[];
  before_infer: any[];
  after_infer: any[];
  apply_acts: any[];
  turn_end: any[];
  total_acts: number;
  total_tokens: number;
  violations: string[];
}

export interface EngineHookResult {
  graph: {
    node_enter: any[];
    node_exit: any[];
  };
  world_sim: {
    weather_change: any[];
    region_drift: any[];
    event_trigger: any[];
  };
  party: {
    recruit: any[];
    dismiss: any[];
  };
  economy: {
    loot_roll: any[];
    vendor_refresh: any[];
    craft_result: any[];
  };
}

export class OrchestratorModIntegration {
  private modPacksService: ModPacksService;
  private hookBus: HookBus;
  private assemblerIntegration: AssemblerModIntegration;
  private config: any;

  constructor(
    modPacksService: ModPacksService,
    hookBus: HookBus,
    assemblerIntegration: AssemblerModIntegration,
    config: any
  ) {
    this.modPacksService = modPacksService;
    this.hookBus = hookBus;
    this.assemblerIntegration = assemblerIntegration;
    this.config = config;
  }

  /**
   * Run turn hooks
   */
  async runTurnHooks(context: OrchestratorContext): Promise<TurnHookResult> {
    const result: TurnHookResult = {
      turn_start: [],
      assemble: [],
      before_infer: [],
      after_infer: [],
      apply_acts: [],
      turn_end: [],
      total_acts: 0,
      total_tokens: 0,
      violations: [],
    };

    try {
      // onTurnStart
      const turnStartContext = this.createHookContext(context, HOOK_TYPES.TURN_START);
      const turnStartResults = await this.hookBus.runHooks(HOOK_TYPES.TURN_START, turnStartContext);
      result.turn_start = this.extractActs(turnStartResults);

      // onAssemble
      const assembleContext = this.createHookContext(context, HOOK_TYPES.ASSEMBLE);
      const assembleResults = await this.hookBus.runHooks(HOOK_TYPES.ASSEMBLE, assembleContext);
      result.assemble = this.extractActs(assembleResults);

      // onBeforeInfer
      const beforeInferContext = this.createHookContext(context, HOOK_TYPES.BEFORE_INFER);
      const beforeInferResults = await this.hookBus.runHooks(HOOK_TYPES.BEFORE_INFER, beforeInferContext);
      result.before_infer = this.extractActs(beforeInferResults);

      // onAfterInfer
      const afterInferContext = this.createHookContext(context, HOOK_TYPES.AFTER_INFER);
      const afterInferResults = await this.hookBus.runHooks(HOOK_TYPES.AFTER_INFER, afterInferContext);
      result.after_infer = this.extractActs(afterInferResults);

      // onApplyActs
      const applyActsContext = this.createHookContext(context, HOOK_TYPES.APPLY_ACTS);
      const applyActsResults = await this.hookBus.runHooks(HOOK_TYPES.APPLY_ACTS, applyActsContext);
      result.apply_acts = this.extractActs(applyActsResults);

      // onTurnEnd
      const turnEndContext = this.createHookContext(context, HOOK_TYPES.TURN_END);
      const turnEndResults = await this.hookBus.runHooks(HOOK_TYPES.TURN_END, turnEndContext);
      result.turn_end = this.extractActs(turnEndResults);

      // Calculate totals
      result.total_acts = result.turn_start.length + result.assemble.length + 
                         result.before_infer.length + result.after_infer.length + 
                         result.apply_acts.length + result.turn_end.length;
      
      result.total_tokens = this.calculateTotalTokens(turnStartResults, assembleResults, 
                                                    beforeInferResults, afterInferResults, 
                                                    applyActsResults, turnEndResults);

      // Collect violations
      result.violations = this.collectViolations(turnStartResults, assembleResults, 
                                               beforeInferResults, afterInferResults, 
                                               applyActsResults, turnEndResults);

    } catch (error) {
      console.error('Turn hooks execution failed:', error);
      result.violations.push(`Turn hooks error: ${error}`);
    }

    return result;
  }

  /**
   * Run graph hooks
   */
  async runGraphHooks(
    context: OrchestratorContext,
    nodeId: string,
    action: 'enter' | 'exit'
  ): Promise<any[]> {
    try {
      const hookType = action === 'enter' ? HOOK_TYPES.NODE_ENTER : HOOK_TYPES.NODE_EXIT;
      const hookContext = this.createHookContext(context, hookType);
      
      // Add node-specific context
      hookContext.game_state = {
        ...hookContext.game_state,
        graph: {
          ...hookContext.game_state.graph,
          current_node: nodeId,
          action: action,
        },
      };

      const results = await this.hookBus.runHooks(hookType, hookContext);
      return this.extractActs(results);

    } catch (error) {
      console.error(`Graph hooks execution failed for ${action}:`, error);
      return [];
    }
  }

  /**
   * Run world sim hooks
   */
  async runWorldSimHooks(
    context: OrchestratorContext,
    eventType: 'weather_change' | 'region_drift' | 'event_trigger',
    eventData: any
  ): Promise<any[]> {
    try {
      const hookType = this.getWorldSimHookType(eventType);
      const hookContext = this.createHookContext(context, hookType);
      
      // Add event-specific context
      hookContext.game_state = {
        ...hookContext.game_state,
        world_sim: {
          ...hookContext.game_state.world_sim,
          event: {
            type: eventType,
            data: eventData,
          },
        },
      };

      const results = await this.hookBus.runHooks(hookType, hookContext);
      return this.extractActs(results);

    } catch (error) {
      console.error(`World sim hooks execution failed for ${eventType}:`, error);
      return [];
    }
  }

  /**
   * Run party hooks
   */
  async runPartyHooks(
    context: OrchestratorContext,
    action: 'recruit' | 'dismiss',
    characterData: any
  ): Promise<any[]> {
    try {
      const hookType = action === 'recruit' ? HOOK_TYPES.RECRUIT : HOOK_TYPES.DISMISS;
      const hookContext = this.createHookContext(context, hookType);
      
      // Add character-specific context
      hookContext.game_state = {
        ...hookContext.game_state,
        party: {
          ...hookContext.game_state.party,
          action: action,
          character: characterData,
        },
      };

      const results = await this.hookBus.runHooks(hookType, hookContext);
      return this.extractActs(results);

    } catch (error) {
      console.error(`Party hooks execution failed for ${action}:`, error);
      return [];
    }
  }

  /**
   * Run economy hooks
   */
  async runEconomyHooks(
    context: OrchestratorContext,
    eventType: 'loot_roll' | 'vendor_refresh' | 'craft_result',
    eventData: any
  ): Promise<any[]> {
    try {
      const hookType = this.getEconomyHookType(eventType);
      const hookContext = this.createHookContext(context, hookType);
      
      // Add economy-specific context
      hookContext.game_state = {
        ...hookContext.game_state,
        economy: {
          ...hookContext.game_state.economy,
          event: {
            type: eventType,
            data: eventData,
          },
        },
      };

      const results = await this.hookBus.runHooks(hookType, hookContext);
      return this.extractActs(results);

    } catch (error) {
      console.error(`Economy hooks execution failed for ${eventType}:`, error);
      return [];
    }
  }

  /**
   * Process assemble hooks with mod context
   */
  async processAssembleHooks(
    context: OrchestratorContext,
    baseSlices: Record<string, any>
  ): Promise<{
    mod_context: Record<string, any>;
    acts: any[];
    total_tokens: number;
    trimmed_namespaces: string[];
  }> {
    try {
      // Process assemble hooks
      const assembleContext = this.createHookContext(context, HOOK_TYPES.ASSEMBLE);
      const assembleResults = await this.hookBus.runHooks(HOOK_TYPES.ASSEMBLE, assembleContext);
      
      // Build mod context
      const modResult = await this.assemblerIntegration.processAssembleHooks(
        context.session_id,
        context.turn_id,
        context.game_state,
        baseSlices
      );

      return {
        mod_context: modResult.mod_ctx,
        acts: this.extractActs(assembleResults),
        total_tokens: modResult.total_tokens,
        trimmed_namespaces: modResult.trimmed_namespaces,
      };

    } catch (error) {
      console.error('Assemble hooks processing failed:', error);
      return {
        mod_context: {},
        acts: [],
        total_tokens: 0,
        trimmed_namespaces: [],
      };
    }
  }

  /**
   * Create hook context
   */
  private createHookContext(
    context: OrchestratorContext,
    hookType: string
  ): HookContext {
    return {
      session_id: context.session_id,
      turn_id: context.turn_id,
      hook_type: hookType,
      game_state: context.game_state,
      slices: context.slices,
      timestamp: context.timestamp,
    };
  }

  /**
   * Extract acts from hook results
   */
  private extractActs(results: any[]): any[] {
    const acts: any[] = [];
    
    for (const result of results) {
      if (result.executed && result.acts) {
        acts.push(...result.acts);
      }
    }
    
    return acts;
  }

  /**
   * Calculate total tokens
   */
  private calculateTotalTokens(...resultsArrays: any[][]): number {
    let totalTokens = 0;
    
    for (const results of resultsArrays) {
      for (const result of results) {
        totalTokens += result.tokens_used || 0;
      }
    }
    
    return totalTokens;
  }

  /**
   * Collect violations
   */
  private collectViolations(...resultsArrays: any[][]): string[] {
    const violations: string[] = [];
    
    for (const results of resultsArrays) {
      for (const result of results) {
        if (result.violations) {
          violations.push(...result.violations);
        }
      }
    }
    
    return violations;
  }

  /**
   * Get world sim hook type
   */
  private getWorldSimHookType(eventType: string): string {
    switch (eventType) {
      case 'weather_change':
        return HOOK_TYPES.WEATHER_CHANGE;
      case 'region_drift':
        return HOOK_TYPES.REGION_DRIFT;
      case 'event_trigger':
        return HOOK_TYPES.EVENT_TRIGGER;
      default:
        throw new Error(`Unknown world sim event type: ${eventType}`);
    }
  }

  /**
   * Get economy hook type
   */
  private getEconomyHookType(eventType: string): string {
    switch (eventType) {
      case 'loot_roll':
        return HOOK_TYPES.LOOT_ROLL;
      case 'vendor_refresh':
        return HOOK_TYPES.VENDOR_REFRESH;
      case 'craft_result':
        return HOOK_TYPES.CRAFT_RESULT;
      default:
        throw new Error(`Unknown economy event type: ${eventType}`);
    }
  }

  /**
   * Check if mod system is enabled
   */
  async isModSystemEnabled(): Promise<boolean> {
    try {
      const config = await this.modPacksService.getConfig();
      return config.mods_enabled;
    } catch (error) {
      console.error('Failed to check mod system status:', error);
      return false;
    }
  }

  /**
   * Get mod system metrics
   */
  async getModSystemMetrics(): Promise<{
    enabled_packs: number;
    total_hooks: number;
    total_acts: number;
    total_tokens: number;
    violations: number;
  }> {
    try {
      const enabledPacks = await this.modPacksService.getEnabledModPacks();
      const hookMetrics = this.hookBus.getMetrics();
      
      let totalHooks = 0;
      let totalActs = 0;
      let totalTokens = 0;
      let violations = 0;
      
      for (const metrics of hookMetrics.values()) {
        totalHooks += metrics.invocations;
        totalActs += metrics.acts_emitted;
        totalTokens += metrics.tokens_used;
        violations += metrics.violations;
      }
      
      return {
        enabled_packs: enabledPacks.length,
        total_hooks: totalHooks,
        total_acts: totalActs,
        total_tokens: totalTokens,
        violations: violations,
      };
    } catch (error) {
      console.error('Failed to get mod system metrics:', error);
      return {
        enabled_packs: 0,
        total_hooks: 0,
        total_acts: 0,
        total_tokens: 0,
        violations: 0,
      };
    }
  }
}

// Singleton instance
let orchestratorModIntegration: OrchestratorModIntegration | null = null;

export function getOrchestratorModIntegration(
  modPacksService: ModPacksService,
  hookBus: HookBus,
  assemblerIntegration: AssemblerModIntegration,
  config: any
): OrchestratorModIntegration {
  if (!orchestratorModIntegration) {
    orchestratorModIntegration = new OrchestratorModIntegration(
      modPacksService,
      hookBus,
      assemblerIntegration,
      config
    );
  }
  return orchestratorModIntegration;
}
