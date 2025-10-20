/**
 * Injection Map Executor
 * Phase 5: Apply injection map rules to bundle data
 */

import { InjectionRuleV1, InjectionMapDocV1 } from '../types/awf-injection-map.js';
import { getAtPointer, setAtPointer } from '../utils/awf-bundle-helpers.js';

export interface InjectionContext extends Record<string, unknown> {
  world: any;
  adventure: any;
  scenario: any;
  npcs: any;
  contract: any;
  player: any;
  game: any;
  session: any;
}

export interface InjectionResult {
  success: boolean;
  appliedRules: number;
  skippedRules: number;
  errors: string[];
  finalBundle: any;
}

/**
 * Execute injection map rules against bundle data
 */
export function executeInjectionMap(
  injectionMap: InjectionMapDocV1,
  context: InjectionContext,
  targetBundle: any = {}
): InjectionResult {
  const result: InjectionResult = {
    success: true,
    appliedRules: 0,
    skippedRules: 0,
    errors: []
  };

  if (!injectionMap.rules || injectionMap.rules.length === 0) {
    console.warn('[InjectionMap] No rules defined in injection map');
    return result;
  }

  console.log(`[InjectionMap] Executing ${injectionMap.rules.length} rules`);

  for (const rule of injectionMap.rules) {
    try {
      const ruleResult = executeRule(rule, context, targetBundle);
      
      if (ruleResult.applied) {
        result.appliedRules++;
        console.log(`[InjectionMap] Applied rule: ${rule.from} -> ${rule.to}`);
      } else {
        result.skippedRules++;
        console.log(`[InjectionMap] Skipped rule: ${rule.from} -> ${rule.to} (${ruleResult.reason})`);
      }
    } catch (error) {
      const errorMsg = `Rule ${rule.from} -> ${rule.to}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      console.error(`[InjectionMap] ${errorMsg}`);
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * Execute a single injection rule
 */
function executeRule(
  rule: InjectionRuleV1,
  context: InjectionContext,
  targetBundle: any
): { applied: boolean; reason?: string } {
  // Resolve source value from context
  const sourceValue = resolveSourceValue(rule.from, context);
  
  // Check if we should skip empty values
  if (rule.skipIfEmpty && isEmptyValue(sourceValue)) {
    return { applied: false, reason: 'Source value is empty' };
  }
  
  // Use fallback if source is missing and fallback is defined
  let valueToInject = sourceValue;
  if (isEmptyValue(sourceValue) && rule.fallback?.ifMissing !== undefined) {
    valueToInject = rule.fallback.ifMissing;
    console.log(`[InjectionMap] Using fallback value for ${rule.from}`);
  }
  
  // Apply limits if defined
  if (rule.limit) {
    const limitedValue = applyLimit(valueToInject, rule.limit);
    if (limitedValue !== valueToInject) {
      console.log(`[InjectionMap] Applied limit to ${rule.from}: ${rule.limit.units} <= ${rule.limit.max}`);
    }
    valueToInject = limitedValue;
  }
  
  // Skip if still empty after fallback
  if (isEmptyValue(valueToInject)) {
    return { applied: false, reason: 'No value to inject after fallback' };
  }
  
  // Inject value into target bundle
  console.log(`[InjectionMap] Setting ${rule.to} to:`, valueToInject);
  console.log(`[InjectionMap] Target bundle before:`, JSON.stringify(targetBundle, null, 2));
  setAtPointer(targetBundle, rule.to, valueToInject);
  console.log(`[InjectionMap] Target bundle after:`, JSON.stringify(targetBundle, null, 2));
  
  return { applied: true };
}

/**
 * Resolve source value from context using JSON pointer
 */
function resolveSourceValue(pointer: string, context: InjectionContext): any {
  // Handle special context paths
  if (pointer.startsWith('/context/')) {
    const contextPath = pointer.substring('/context/'.length);
    return getAtPointer(context, `/${contextPath}`);
  }
  
  // Handle direct context object references
  if (pointer.startsWith('/world/')) {
    const relativePointer = pointer.substring('/world'.length); // Remove '/world' prefix
    return getAtPointer(context.world as Record<string, unknown>, relativePointer);
  }
  if (pointer.startsWith('/adventure/')) {
    const relativePointer = pointer.substring('/adventure'.length); // Remove '/adventure' prefix
    return getAtPointer(context.adventure as Record<string, unknown>, relativePointer);
  }
  if (pointer.startsWith('/scenario/')) {
    const relativePointer = pointer.substring('/scenario'.length); // Remove '/scenario' prefix
    return getAtPointer(context.scenario as Record<string, unknown>, relativePointer);
  }
  if (pointer.startsWith('/npcs/')) {
    const relativePointer = pointer.substring('/npcs'.length); // Remove '/npcs' prefix
    return getAtPointer(context.npcs as Record<string, unknown>, relativePointer);
  }
  if (pointer.startsWith('/contract/')) {
    const relativePointer = pointer.substring('/contract'.length); // Remove '/contract' prefix
    return getAtPointer(context.contract as Record<string, unknown>, relativePointer);
  }
  if (pointer.startsWith('/player/')) {
    const relativePointer = pointer.substring('/player'.length); // Remove '/player' prefix
    return getAtPointer(context.player as Record<string, unknown>, relativePointer);
  }
  if (pointer.startsWith('/game/')) {
    const relativePointer = pointer.substring('/game'.length); // Remove '/game' prefix
    return getAtPointer(context.game as Record<string, unknown>, relativePointer);
  }
  if (pointer.startsWith('/session/')) {
    const relativePointer = pointer.substring('/session'.length); // Remove '/session' prefix
    return getAtPointer(context.session as Record<string, unknown>, relativePointer);
  }
  
  // Handle direct object references (without trailing slash)
  if (pointer === '/world') {
    return context.world;
  }
  if (pointer === '/adventure') {
    return context.adventure;
  }
  if (pointer === '/scenario') {
    return context.scenario;
  }
  if (pointer === '/npcs') {
    return context.npcs;
  }
  if (pointer === '/contract') {
    return context.contract;
  }
  if (pointer === '/player') {
    return context.player;
  }
  if (pointer === '/game') {
    return context.game;
  }
  if (pointer === '/session') {
    return context.session;
  }
  
  // Default: try to resolve from context root
  return getAtPointer(context, pointer);
}

/**
 * Check if a value is considered empty
 */
function isEmptyValue(value: any): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  if (typeof value === 'object' && Object.keys(value).length === 0) {
    return true;
  }
  return false;
}

/**
 * Apply limits to a value based on rule configuration
 */
function applyLimit(value: any, limit: { units: "tokens"|"count"; max: number }): any {
  if (limit.units === 'count') {
    if (Array.isArray(value)) {
      return value.slice(0, limit.max);
    }
    if (typeof value === 'string') {
      // For strings, count could mean characters
      return value.substring(0, limit.max);
    }
    return value;
  }
  
  if (limit.units === 'tokens') {
    // Rough token estimation: 1 token ≈ 4 characters
    const estimatedTokens = estimateTokens(value);
    if (estimatedTokens <= limit.max) {
      return value;
    }
    
    // Trim based on token limit - use actual token estimation
    if (typeof value === 'string') {
      // For strings, trim character by character until we're under the token limit
      let trimmed = value;
      while (estimateTokens(trimmed) > limit.max && trimmed.length > 0) {
        trimmed = trimmed.substring(0, trimmed.length - 1);
      }
      return trimmed;
    }
    if (Array.isArray(value)) {
      // For arrays, trim items until we're under the token limit
      let trimmed = value;
      while (estimateTokens(trimmed) > limit.max && trimmed.length > 0) {
        trimmed = trimmed.slice(0, trimmed.length - 1);
      }
      return trimmed;
    }
    if (typeof value === 'object') {
      // For objects, we could implement more sophisticated trimming
      // For now, just return as-is and let the caller handle it
      return value;
    }
  }
  
  return value;
}

/**
 * Rough token estimation
 */
function estimateTokens(value: any): number {
  if (typeof value === 'string') {
    return Math.ceil(value.length / 4);
  }
  if (Array.isArray(value)) {
    return Math.ceil(JSON.stringify(value).length / 4);
  }
  if (typeof value === 'object') {
    return Math.ceil(JSON.stringify(value).length / 4);
  }
  return 1;
}

/**
 * Create injection context from loaded data
 */
export function createInjectionContext(data: {
  world: any;
  adventure: any;
  scenario: any;
  npcs: any;
  contract: any;
  player: any;
  game: any;
  session: any;
}): InjectionContext {
  return {
    world: data.world,
    adventure: data.adventure,
    scenario: data.scenario,
    npcs: data.npcs,
    contract: data.contract,
    player: data.player,
    game: data.game,
    session: data.session
  };
}
