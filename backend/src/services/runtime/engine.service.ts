// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * [SERVICE] EngineService
 * ----------------------------------------------------------------------
 * ROLE: Deterministic Logic Processor (The "CPU").
 * RESPONSIBILITY:
 * - Matching MAS-1 Intents to Ruleset Actions.
 * - Executing JSON-Logic steps sequentially.
 * - Orchestrating Multi-Target and Multi-Intent loops.
 *
 * CONSTRAINTS:
 * - Stateless execution (relies on StateService for data).
 * - Must log all decisions via [LOGIC_TRACE].
 */

import type { GameState, Mas1Intent, EngineResultDto } from '@shared/types/chimera-runtime';
import { EngineResultDtoSchema } from '@shared/types/chimera-runtime';
import {
  resolveD100Check,
  getEntityFromState,
  type ResolutionSummary,
} from './d100-resolution.js';
import {
  calculateResolutionLadder,
  applyDamageReductionHook,
  type ResolutionLadderBreakdown,
} from './resolution-ladder.js';

export class EngineService {
  /**
   * [METHOD] executeActionSteps
   * ----------------------------------------------------------------
   * @sourceOfTruth - gameState parameter (read-only)
   * @logic_flow
   * 1. Accept array of Mas1Intent[] from MAS1
   * 2. Iterate through intents sequentially
   * 3. Pass updated state from Intent 1 into Intent 2 (chained execution)
   * 4. Aggregate all deltas and summaries
   * 5. Return combined EngineResultDto
   */
  async executeActionSteps(
    intents: Mas1Intent[],
    gameState: GameState,
    actionsMap: Record<string, unknown>
  ): Promise<EngineResultDto> {
    console.log(`[LOGIC_TRACE] [EngineService] Input: Processing ${intents.length} intent(s)`);
    
    let currentState = gameState;
    const aggregatedDeltas: Record<string, number> = {};
    const resolutionSummaries: string[] = [];
    let allSuccess = true;

    for (let i = 0; i < intents.length; i++) {
      const intent = intents[i];
      console.log(`[LOGIC_TRACE] [EngineService] Execution: Processing intent ${i + 1}/${intents.length}: ${intent.trigger_id}`);
      
      // Execute this intent against current state
      const result = await this.execute(intent, currentState, actionsMap);
      
      // Aggregate results
      allSuccess = allSuccess && result.success;
      resolutionSummaries.push(result.outcome_summary);
      
      // Merge numeric deltas
      for (const [path, delta] of Object.entries(result.numeric_deltas)) {
        aggregatedDeltas[path] = (aggregatedDeltas[path] || 0) + delta;
      }

      // CRITICAL: Apply state changes immediately so subsequent actions see updated state
      // Note: This is a simplified state update - in production, use StateService
      currentState = this.applyStateUpdates(currentState, result);
      
      console.log(`[LOGIC_TRACE] [EngineService] Output: Intent ${i + 1} completed - Success: ${result.success}, Deltas: ${Object.keys(result.numeric_deltas).length}`);
    }

    const aggregatedResult: EngineResultDto = {
      success: allSuccess,
      outcome_summary: resolutionSummaries.join(' AND '),
      numeric_deltas: aggregatedDeltas,
    };

    console.log(`[LOGIC_TRACE] [EngineService] Output: All intents processed - Final Success: ${allSuccess}, Total Deltas: ${Object.keys(aggregatedDeltas).length}`);
    
    return EngineResultDtoSchema.parse(aggregatedResult);
  }

  /**
   * [METHOD] execute
   * ----------------------------------------------------------------
   * @sourceOfTruth - gameState parameter (read-only)
   * @logic_flow
   * 1. Map trigger_id to action slug
   * 2. Parse action definition
   * 3. Execute logic (dice rolls, comparisons)
   * 4. Calculate numeric deltas
   * 5. Return EngineResultDto
   */
  async execute(
    intent: Mas1Intent,
    gameState: GameState,
    actionsMap: Record<string, unknown>
  ): Promise<EngineResultDto> {
    console.log(`[LOGIC_TRACE] [EngineService] Input: Intent ${intent.trigger_id}, Targets: ${intent.target_ids.length}`);
    
    // Map trigger_id to action slug (existing logic)
    const actionSlug = this.mapTriggerToActionSlug(intent.trigger_id, actionsMap);
    const actionDef = actionsMap[actionSlug];

    if (!actionDef) {
      console.log(`[LOGIC_TRACE] [EngineService] Execution: Unknown action: ${actionSlug}`);
      return {
        success: false,
        outcome_summary: `Unknown action: ${actionSlug}`,
        numeric_deltas: {},
      };
    }

    // Parse action definition (may be JSON string or object)
    let action: Record<string, unknown>;
    if (typeof actionDef === 'string') {
      try {
        action = JSON.parse(actionDef);
      } catch {
        action = { logic: actionDef };
      }
    } else {
      action = actionDef as Record<string, unknown>;
    }
    
    // Check if this action should use D100 resolution
    const useD100Resolution = intent.trigger_id === 'combat_action' || 
                              intent.trigger_id === 'attempt_action' ||
                              action.resolution_type === 'd100';
    
    if (useD100Resolution && intent.target_ids.length > 0) {
      // Use D100 Comparative Resolution
      return await this.executeD100Resolution(intent, gameState, action, actionSlug);
    }

    // Extract action logic (e.g., "1d20 + str vs 15")
    const logic = action.logic as string | undefined;
    const numericDeltas: Record<string, number> = {};
    let success = false;
    let outcomeSummary = '';

    if (logic && logic !== 'none') {
      // Parse dice codes and resolve action
      // Handle multiple targets if present
      const result = this.parseAndResolveLogic(
        logic,
        gameState,
        intent.parameters,
        actionSlug,
        intent,
        action,
        intent.target_ids
      );
      success = result.success;
      outcomeSummary = result.summary;
      Object.assign(numericDeltas, result.deltas);
    } else {
      // Simple action without dice logic
      success = true;
      
      // Build outcome summary with target information
      if (intent.target_ids.length > 0) {
        const targetNames = intent.target_ids.map(id => `entity-${id.substring(0, 8)}`).join(' and ');
        outcomeSummary = `Executed ${intent.parameters.verb} on ${targetNames}`;
      } else {
        outcomeSummary = `Executed action: ${actionSlug}`;
      }
      
      // Apply any direct deltas from action definition
      if (action.deltas && typeof action.deltas === 'object') {
        const deltas = action.deltas as Record<string, unknown>;
        for (const [key, value] of Object.entries(deltas)) {
          if (typeof value === 'number') {
            numericDeltas[key] = value;
          }
        }
      }
    }

    const result: EngineResultDto = {
      success,
      outcome_summary: outcomeSummary,
      numeric_deltas: numericDeltas,
    };

    console.log(`[LOGIC_TRACE] [EngineService] Output: Success: ${success}, Deltas: ${Object.keys(numericDeltas).length}`);

    return EngineResultDtoSchema.parse(result);
  }

  /**
   * [METHOD] executeD100Resolution
   * ----------------------------------------------------------------
   * @sourceOfTruth - gameState parameter
   * @logic_flow
   * 1. Get actor entity from gameState (player)
   * 2. Get target entity from gameState
   * 3. Get actor skill from intent.parameters.skill_id
   * 4. Calculate Resolution Ladder (4-tier priority system)
   * 5. Execute D100 roll-under check using final target
   * 6. Apply damage reduction hook if INTOXICATED
   * 7. Only apply state deltas if resolution is success or crit
   * 8. Return EngineResultDto with resolution summary
   */
  private async executeD100Resolution(
    intent: Mas1Intent,
    gameState: GameState,
    action: Record<string, unknown>,
    actionSlug: string
  ): Promise<EngineResultDto> {
    console.log(`[LOGIC_TRACE] [EngineService] Using D100 Resolution Ladder System`);
    
    // Get actor (player) - use player_id from gameState
    const playerId = (gameState as any).player_id;
    if (!playerId) {
      console.log(`[LOGIC_TRACE] [EngineService] No player_id in gameState`);
      return {
        success: false,
        outcome_summary: 'No player_id found in game state',
        numeric_deltas: {},
      };
    }
    
    const actor = getEntityFromState(gameState, playerId);
    
    if (!actor) {
      console.log(`[LOGIC_TRACE] [EngineService] Actor not found: ${playerId}`);
      return {
        success: false,
        outcome_summary: `Actor not found: ${playerId}`,
        numeric_deltas: {},
      };
    }
    
    // Get skill ID from intent parameters or default
    const skillId = (intent.parameters.skill_id as string) || 'root_force';
    
    // Process each target
    const resolutionSummaries: string[] = [];
    const numericDeltas: Record<string, number> = {};
    let allSuccess = true;
    let resolutionSummary: ResolutionSummary = 'fail';
    let hasIntoxicated = false;
    
    for (const targetId of intent.target_ids) {
      const target = getEntityFromState(gameState, targetId);
      
      if (!target) {
        console.log(`[LOGIC_TRACE] [EngineService] Target not found: ${targetId}`);
        resolutionSummaries.push(`Target ${targetId.substring(0, 8)} not found`);
        allSuccess = false;
        continue;
      }
      
      // Calculate Resolution Ladder (4-tier priority system)
      const ladder = calculateResolutionLadder(actor, target, intent, gameState, skillId);
      hasIntoxicated = ladder.hasIntoxicated;
      
      // Execute D100 check using final target from ladder
      // Note: resolveD100Check expects (actorSkill, modifier), but we've already calculated finalTarget
      // So we pass actorSkill and totalModifier, which will be recalculated but should match
      const resolution = resolveD100Check(ladder.actorSkill, ladder.totalModifier);
      resolutionSummary = resolution.summary;
      
      // Verify the target matches (should be identical)
      if (resolution.target !== ladder.finalTarget) {
        console.warn(`[LOGIC_TRACE] [EngineService] Target mismatch: ladder=${ladder.finalTarget}, resolution=${resolution.target}`);
      }
      
      // Determine success (crit or success = true, fail or fumble = false)
      const targetSuccess = resolution.summary === 'crit' || resolution.summary === 'success';
      allSuccess = allSuccess && targetSuccess;
      
      // Build summary with full breakdown
      const targetName = (target.properties?.display_name as string) || 
                        (target.properties?.name as string) || 
                        `entity-${targetId.substring(0, 8)}`;
      const outcomeDesc = resolution.summary === 'crit' ? 'critical success' :
                          resolution.summary === 'fumble' ? 'critical failure' :
                          resolution.summary;
      resolutionSummaries.push(
        `${targetName}: ${outcomeDesc} (Roll: ${resolution.roll}, Target: ${ladder.finalTarget}, ` +
        `T1:${ladder.tier1_comparative} T2:${ladder.tier2_situational} T3:${ladder.tier3_difficulty} T4:${ladder.tier4_tactic})`
      );
      
      // Only apply state deltas if resolution is success or crit
      if (targetSuccess) {
        // Extract damage/healing from action definition or parameters
        const damage = (action.damage as number) || (intent.parameters.damage as number);
        const healing = (action.healing as number) || (intent.parameters.healing as number);
        
        if (damage && typeof damage === 'number') {
          const deltaPath = `entities.${targetId}.properties.hp`;
          numericDeltas[deltaPath] = (numericDeltas[deltaPath] || 0) - damage;
          console.log(`[LOGIC_TRACE] [EngineService] Applying damage ${damage} to ${targetId} (success)`);
        } else if (healing && typeof healing === 'number') {
          const deltaPath = `entities.${targetId}.properties.hp`;
          numericDeltas[deltaPath] = (numericDeltas[deltaPath] || 0) + healing;
          console.log(`[LOGIC_TRACE] [EngineService] Applying healing ${healing} to ${targetId} (success)`);
        } else if (actionSlug === 'attack' || actionSlug === 'resolve_clash') {
          // Default attack damage if not specified
          const rolledDamage = this.rollDice('1d6');
          const deltaPath = `entities.${targetId}.properties.hp`;
          numericDeltas[deltaPath] = (numericDeltas[deltaPath] || 0) - rolledDamage;
          console.log(`[LOGIC_TRACE] [EngineService] Applying default damage ${rolledDamage} to ${targetId} (success)`);
        }
      } else {
        console.log(`[LOGIC_TRACE] [EngineService] Skipping state deltas for ${targetId} (${resolution.summary})`);
      }
    }
    
    // Apply damage reduction hook for INTOXICATED (affects actor's incoming damage)
    // Note: This applies to any deltas that would affect the actor (e.g., counter-attack damage)
    const finalDeltas = applyDamageReductionHook(numericDeltas, playerId, hasIntoxicated);
    
    const outcomeSummary = resolutionSummaries.join(' AND ');
    
    return {
      success: allSuccess,
      outcome_summary: outcomeSummary,
      numeric_deltas: finalDeltas,
    };
  }

  /**
   * [METHOD] applyStateUpdates
   * ----------------------------------------------------------------
   * @sourceOfTruth - currentState parameter
   * @logic_flow
   * 1. Deep clone current state
   * 2. Apply numeric deltas from engine result
   * 3. Return updated state (for chained execution)
   */
  private applyStateUpdates(
    currentState: GameState,
    engineResult: EngineResultDto
  ): GameState {
    // Deep clone to avoid mutations
    const updatedState: GameState = {
      ...currentState,
      tier1_mechanical: JSON.parse(JSON.stringify(currentState.tier1_mechanical)),
      tier0_narrative: JSON.parse(JSON.stringify(currentState.tier0_narrative)),
    };

    // Apply Tier 1 (Mechanical) deltas from Engine
    for (const [path, delta] of Object.entries(engineResult.numeric_deltas)) {
      const deltaNum = typeof delta === 'number' ? delta : 0;
      
      if (path.includes('.')) {
        // Deep path update (e.g., "entities.enemy.stats.hp")
        this.setDeepValue(updatedState.tier1_mechanical, path, deltaNum);
      } else {
        // Simple path update
        const currentValue = updatedState.tier1_mechanical[path];
        if (typeof currentValue === 'number') {
          updatedState.tier1_mechanical[path] = currentValue + deltaNum;
        } else {
          // Initialize if doesn't exist
          updatedState.tier1_mechanical[path] = deltaNum;
        }
      }
    }

    return updatedState;
  }

  /**
   * [METHOD] setDeepValue
   * ----------------------------------------------------------------
   * @mutates obj - Sets value at deep path, creating intermediate objects as needed
   * @logic_flow
   * 1. Split path by dots
   * 2. Navigate/create path except for the last part
   * 3. Set the final value (add delta to existing value or initialize)
   */
  private setDeepValue(obj: Record<string, unknown>, path: string, delta: number): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;

    // Navigate/create path except for the last part
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    // Set the final value (add delta to existing value or initialize)
    const finalKey = parts[parts.length - 1];
    const currentValue = current[finalKey];
    if (typeof currentValue === 'number') {
      current[finalKey] = currentValue + delta;
    } else {
      current[finalKey] = delta;
    }
  }

  /**
   * [METHOD] mapTriggerToActionSlug
   * ----------------------------------------------------------------
   * @logic_flow
   * 1. Map trigger_id to action slug using predefined mapping
   * 2. Fallback to finding action by key matching
   * 3. Return action slug or default 'wait'
   */
  private mapTriggerToActionSlug(triggerId: string, actionsMap: Record<string, unknown>): string {
    // Existing logic: map trigger_id to action slug
    // combat_action -> resolve_clash
    // social_action -> apply_relationship_delta
    // rest_action -> take_rest
    // etc.
    const triggerMap: Record<string, string> = {
      combat_action: 'resolve_clash',
      social_action: 'apply_relationship_delta',
      rest_action: 'take_rest',
      attempt_action: 'attempt_action',
      navigate: 'navigate',
    };

    const mappedSlug = triggerMap[triggerId];
    if (mappedSlug && actionsMap[mappedSlug]) {
      return mappedSlug;
    }

    // Fallback: try to find action with matching key
    const actionKeys = Object.keys(actionsMap);
    const matchingAction = actionKeys.find(key => key.includes(triggerId) || triggerId.includes(key));
    return matchingAction || actionKeys[0] || 'wait';
  }

  /**
   * [METHOD] parseAndResolveLogic
   * ----------------------------------------------------------------
   * @logic_flow
   * 1. Parse dice codes from logic string
   * 2. Roll dice and calculate total
   * 3. Extract modifiers (stats or numbers)
   * 4. Check comparison operators (vs, >=, etc.)
   * 5. Calculate success/failure
   * 6. Generate deltas for each target
   * 7. Return success, summary, and deltas
   */
  private parseAndResolveLogic(
    logic: string,
    gameState: GameState,
    parameters: Record<string, unknown>,
    actionSlug: string,
    intent: Mas1Intent,
    actionDef: Record<string, unknown>,
    targetIds: string[] = []
  ): { success: boolean; summary: string; deltas: Record<string, number> } {
    // Parse dice codes: (\d+)d(\d+)
    const dicePattern = /(\d+)d(\d+)/g;
    const diceMatches = Array.from(logic.matchAll(dicePattern));
    
    let total = 0;
    const diceRolls: number[] = [];

    // Roll all dice
    for (const match of diceMatches) {
      const count = parseInt(match[1], 10);
      const sides = parseInt(match[2], 10);
      
      for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * sides) + 1;
        diceRolls.push(roll);
        total += roll;
      }
    }

    // Extract modifiers (e.g., "+ str", "+ 3")
    const modifierPattern = /\+?\s*([a-z_]+|\d+)/g;
    const modifierMatches = Array.from(logic.matchAll(modifierPattern));
    
    for (const match of modifierMatches) {
      const modifier = match[1];
      
      // Check if it's a stat reference (e.g., "str", "dex")
      if (/^[a-z_]+$/.test(modifier)) {
        const statValue = this.getStatValue(modifier, gameState);
        total += statValue;
      } else if (/^\d+$/.test(modifier)) {
        // Direct number
        total += parseInt(modifier, 10);
      }
    }

    // Check for comparison (e.g., "vs 15", ">= 10")
    const comparisonPattern = /(vs|>=|<=|>|<)\s*(\d+)/;
    const comparisonMatch = logic.match(comparisonPattern);
    
    let success = true;
    let threshold = 0;
    
    if (comparisonMatch) {
      threshold = parseInt(comparisonMatch[2], 10);
      const operator = comparisonMatch[1];
      
      switch (operator) {
        case 'vs':
        case '>=':
          success = total >= threshold;
          break;
        case '>':
          success = total > threshold;
          break;
        case '<=':
          success = total <= threshold;
          break;
        case '<':
          success = total < threshold;
          break;
      }
    }

    // Generate outcome summary
    const diceStr = diceRolls.length > 0 
      ? `Rolled ${diceRolls.join(', ')} (total: ${total})`
      : `Total: ${total}`;
    
    const summary = comparisonMatch
      ? `${diceStr} ${success ? 'succeeds' : 'fails'} against ${threshold}`
      : `${diceStr}`;

    // Calculate deltas based on success/failure
    // Handle multiple targets: apply action to each target
    const deltas: Record<string, number> = {};
    const targetResults: string[] = [];
    
    // Extract damage/healing from action definition, parameters, or default
    const damage = (actionDef.damage as number) || (parameters.damage as number);
    const healing = (actionDef.healing as number) || (parameters.healing as number);
    
    // Process each target in the target_ids array
    const targetsToProcess = targetIds.length > 0 ? targetIds : ['default'];
    
    for (const targetId of targetsToProcess) {
      let targetSuccess = success;
      let targetSummary = summary;
      
      // For multi-target actions, roll separately for each target
      // Note: In a full implementation, each target would get its own roll
      // For now, we use the same roll result but apply it to each target
      targetSuccess = success;
      targetSummary = summary;
      
      // Build target-specific result summary
      const targetLabel = targetId === 'default' ? 'target' : `entity-${targetId.substring(0, 8)}`;
      targetResults.push(`${targetLabel} (${targetSuccess ? 'Success' : 'Fail'})`);
      
      // Apply damage/healing to this target
      if (damage && typeof damage === 'number') {
        const deltaPath = `entities.${targetId}.stats.hp`;
        deltas[deltaPath] = (deltas[deltaPath] || 0) + (targetSuccess ? -damage : 0);
      } else if (healing && typeof healing === 'number') {
        const deltaPath = `entities.${targetId}.stats.hp`;
        deltas[deltaPath] = (deltas[deltaPath] || 0) + (targetSuccess ? healing : 0);
      } else if ((actionSlug === 'attack' || actionSlug === 'resolve_clash') && targetSuccess) {
        // Default attack damage if not specified - roll 1d6
        const rolledDamage = this.rollDice('1d6');
        const deltaPath = `entities.${targetId}.stats.hp`;
        deltas[deltaPath] = (deltas[deltaPath] || 0) - rolledDamage;
      }
    }
    
    // Build combined summary for multiple targets
    const combinedSummary = targetIds.length > 1
      ? `You ${intent.parameters.verb} ${targetResults.join(' AND ')}`
      : summary;

    return { success, summary: combinedSummary, deltas };
  }

  /**
   * [METHOD] getStatValue
   * ----------------------------------------------------------------
   * @sourceOfTruth - gameState parameter
   * @logic_flow
   * 1. Check tier1_mechanical for stat
   * 2. Check nested stats structure
   * 3. Return stat value or 0 if not found
   */
  private getStatValue(statName: string, gameState: GameState): number {
    // Check tier1_mechanical first
    const tier1Value = gameState.tier1_mechanical[statName];
    if (typeof tier1Value === 'number') {
      return tier1Value;
    }

    // Check nested structures (e.g., stats.str)
    const stats = gameState.tier1_mechanical.stats as Record<string, unknown> | undefined;
    if (stats && typeof stats === 'object') {
      const statValue = stats[statName];
      if (typeof statValue === 'number') {
        return statValue;
      }
    }

    // Default to 0 if not found
    return 0;
  }

  /**
   * [METHOD] rollDice
   * ----------------------------------------------------------------
   * @logic_flow
   * 1. Parse dice code (e.g., "1d6", "2d8+3")
   * 2. Roll dice and sum results
   * 3. Apply modifiers
   * 4. Return total
   */
  private rollDice(diceCode: string): number {
    const dicePattern = /(\d+)d(\d+)/;
    const match = diceCode.match(dicePattern);
    
    if (!match) {
      return 0;
    }

    const count = parseInt(match[1], 10);
    const sides = parseInt(match[2], 10);
    let total = 0;

    for (let i = 0; i < count; i++) {
      total += Math.floor(Math.random() * sides) + 1;
    }

    // Extract modifiers
    const modifierMatch = diceCode.match(/[+-]\s*(\d+)/);
    if (modifierMatch) {
      const modifier = parseInt(modifierMatch[0].replace(/\s+/g, ''), 10);
      total += modifier;
    }

    return total;
  }
}

