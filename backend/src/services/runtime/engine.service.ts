// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Engine Service (The Resolver)
 * Deterministic action processing - no LLM calls, pure logic
 */

import type { GameState, Mas1Intent, EngineResultDto } from '@shared/types/chimera-runtime';
import { EngineResultDtoSchema } from '@shared/types/chimera-runtime';

export class EngineService {
  /**
   * Execute an action deterministically
   * @param intent - The interpreted intent from MAS1
   * @param gameState - Current game state
   * @param actionsMap - Map of action definitions from compiled story
   * @returns EngineResultDto with success, outcome_summary, and numeric_deltas
   */
  async execute(
    intent: Mas1Intent,
    gameState: GameState,
    actionsMap: Record<string, unknown>
  ): Promise<EngineResultDto> {
    // Map trigger_id to action slug (existing logic)
    const actionSlug = this.mapTriggerToActionSlug(intent.trigger_id, actionsMap);
    const actionDef = actionsMap[actionSlug];

    if (!actionDef) {
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

    return EngineResultDtoSchema.parse(result);
  }

  /**
   * Map trigger_id to action slug (ruleset matching logic)
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
   * Parse dice code logic and resolve it
   * Supports patterns like "1d20 + str vs 15" or "2d6 + 3"
   * Now handles multiple targets via target_ids array
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
   * Get a stat value from game state
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
   * Roll dice from a dice code string (e.g., "1d6", "2d8+3")
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

