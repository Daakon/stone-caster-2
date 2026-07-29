// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * [SERVICE] EngineService
 * ----------------------------------------------------------------------
 * ROLE: Deterministic Logic Processor (The "Physics Engine").
 * RESPONSIBILITY:
 * - Processing Director's intent_queue sequentially.
 * - Converting tiered impacts to numerical deltas.
 * - Handling proximity-based accidents (fumbles).
 * - Enforcing stamina drain and status tags.
 *
 * CONSTRAINTS:
 * - Stateless execution (relies on StateService for data).
 * - Must log all decisions via [LOGIC_TRACE].
 * - Processes DirectorUnifiedIntent.intent_queue directly.
 */

import type { GameState, Mas1Intent, EngineResultDto, DirectorUnifiedIntent } from '@shared/types/chimera-runtime';
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
import {
  calculateTierDelta,
  upgradeTierOnCritical,
  type ImpactTier,
  type ImpactTierLow,
} from './tier-value-mapper.js';

export class EngineService {
  /**
   * [METHOD] executeIntentQueue
   * ----------------------------------------------------------------
   * @sourceOfTruth - gameState parameter (read-only)
   * @logic_flow
   * 1. Accept DirectorUnifiedIntent from Director
   * 2. Iterate through intent_queue sequentially
   * 3. Process each intent with tier-to-value mapping
   * 4. Handle proximity cascade on fumbles
   * 5. Apply stamina drain and status tags
   * 6. Aggregate all deltas and summaries
   * 7. Return combined EngineResultDto with target information
   */
  async executeIntentQueue(
    directorIntent: DirectorUnifiedIntent,
    gameState: GameState,
    actionsMap: Record<string, unknown>
  ): Promise<EngineResultDto> {
    console.log(`[LOGIC_TRACE] [EngineService] Input: Processing ${directorIntent.intent_queue.length} intent(s) from Director`);

    let currentState = gameState;
    const aggregatedDeltas: Record<string, number> = {};
    const resolutionSummaries: string[] = [];
    const targetResults: EngineResultDto['target_results'] = [];
    const statusTags: Record<string, string[]> = {};
    let allSuccess = true;

    for (let i = 0; i < directorIntent.intent_queue.length; i++) {
      const intent = directorIntent.intent_queue[i];
      console.log(`[LOGIC_TRACE] [EngineService] Execution: Processing intent ${i + 1}/${directorIntent.intent_queue.length}: ${intent.trigger_id} by actor ${intent.actor_id}`);

      // Execute this intent against current state
      const result = await this.executeIntent(
        intent,
        currentState,
        actionsMap,
        directorIntent
      );

      // Aggregate results
      allSuccess = allSuccess && result.success;
      resolutionSummaries.push(result.outcome_summary);

      // Set intent_index for target results
      const indexedTargetResults = result.target_results.map(tr => ({
        ...tr,
        intent_index: i,
      }));
      targetResults.push(...indexedTargetResults);

      // Merge numeric deltas
      for (const [path, delta] of Object.entries(result.numeric_deltas)) {
        aggregatedDeltas[path] = (aggregatedDeltas[path] || 0) + delta;
      }

      // Merge status tags
      for (const [actorId, tags] of Object.entries(result.status_tags)) {
        if (!statusTags[actorId]) {
          statusTags[actorId] = [];
        }
        statusTags[actorId].push(...tags);
      }

      // CRITICAL: Apply state changes immediately so subsequent actions see updated state
      currentState = this.applyStateUpdates(currentState, result);

      console.log(`[LOGIC_TRACE] [EngineService] Output: Intent ${i + 1} completed - Success: ${result.success}, Deltas: ${Object.keys(result.numeric_deltas).length}, Targets: ${result.target_results.length}`);
    }

    const aggregatedResult: EngineResultDto = {
      success: allSuccess,
      outcome_summary: resolutionSummaries.join(' AND '),
      numeric_deltas: aggregatedDeltas,
      target_results: targetResults,
      status_tags: statusTags,
    };

    console.log(`[LOGIC_TRACE] [EngineService] Output: All intents processed - Final Success: ${allSuccess}, Total Deltas: ${Object.keys(aggregatedDeltas).length}, Total Targets: ${targetResults.length}`);

    return EngineResultDtoSchema.parse(aggregatedResult);
  }

  /**
   * [METHOD] executeActionSteps (Legacy Bridge)
   * ----------------------------------------------------------------
   * Temporary bridge method for backward compatibility
   * Converts Mas1Intent[] to DirectorUnifiedIntent format internally
   * @deprecated Use executeIntentQueue instead
   */
  async executeActionSteps(
    intents: Mas1Intent[],
    gameState: GameState,
    actionsMap: Record<string, unknown>
  ): Promise<EngineResultDto> {
    // Convert Mas1Intent[] to DirectorUnifiedIntent format
    const directorIntent: DirectorUnifiedIntent = {
      turn_meta: {
        resolution_mode: 'engine',
        time_jump_minutes: 0,
      },
      unseen_ripples: [],
      intent_queue: intents.map(intent => ({
        actor_id: (gameState as any).player_id || 'unknown',
        trigger_id: intent.trigger_id,
        intended_targets: intent.target_ids,
        proximity_cluster: [],
        parameters: {
          verb: intent.parameters.verb,
          impact_tier: 'Moderate' as ImpactTierLow,
          tactic_tag: intent.parameters.tactic_tag,
          skill_id: intent.parameters.skill_id,
        },
      })),
    };

    return this.executeIntentQueue(directorIntent, gameState, actionsMap);
  }

  /**
   * [METHOD] executeIntent
   * ----------------------------------------------------------------
   * Processes a single intent from Director's intent_queue
   * @sourceOfTruth - gameState parameter (read-only)
   * @logic_flow
   * 1. Get actor and targets from gameState
   * 2. Execute D100 resolution if applicable
   * 3. Handle proximity cascade on fumble
   * 4. Apply tier-to-value mapping for impact_tier
   * 5. Apply stamina drain for physical intents
   * 6. Apply status tags on failure
   * 7. Return EngineResultDto with target information
   */
  private async executeIntent(
    intent: DirectorUnifiedIntent['intent_queue'][0],
    gameState: GameState,
    actionsMap: Record<string, unknown>,
    directorIntent: DirectorUnifiedIntent
  ): Promise<EngineResultDto> {
    console.log(`[LOGIC_TRACE] [EngineService] Input: Intent ${intent.trigger_id}, Actor: ${intent.actor_id}, Targets: ${intent.intended_targets.length}, Proximity: ${intent.proximity_cluster.length}`);

    // Get actor entity
    const actor = getEntityFromState(gameState, intent.actor_id);
    if (!actor) {
      console.log(`[LOGIC_TRACE] [EngineService] Actor not found: ${intent.actor_id}`);
      return {
        success: false,
        outcome_summary: `Actor not found: ${intent.actor_id}`,
        numeric_deltas: {},
        target_results: [],
        status_tags: {},
      };
    }

    // Map trigger_id to action slug
    const actionSlug = this.mapTriggerToActionSlug(intent.trigger_id, actionsMap);
    const actionDef = actionsMap[actionSlug];
    if (!actionDef) {
      console.log(`[LOGIC_TRACE] [EngineService] Unknown action: ${actionSlug}`);
      return {
        success: false,
        outcome_summary: `Unknown action: ${actionSlug}`,
        numeric_deltas: {},
        target_results: [],
        status_tags: {},
      };
    }

    // Parse action definition
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

    if (useD100Resolution && intent.intended_targets.length > 0) {
      return await this.executeD100Intent(intent, gameState, action, actionSlug, actor, directorIntent);
    }

    // Simple action without dice logic
    return await this.executeSimpleIntent(intent, gameState, action, actionSlug, actor);
  }

  /**
   * [METHOD] execute (Legacy)
   * ----------------------------------------------------------------
   * @deprecated Use executeIntent instead
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
        target_results: [],
        status_tags: {},
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
      target_results: [],
      status_tags: {},
    };

    console.log(`[LOGIC_TRACE] [EngineService] Output: Success: ${success}, Deltas: ${Object.keys(numericDeltas).length}`);

    return EngineResultDtoSchema.parse(result);
  }

  /**
   * [METHOD] executeD100Intent
   * ----------------------------------------------------------------
   * Processes D100 resolution for Director intent with proximity cascade
   * @sourceOfTruth - gameState parameter
   * @logic_flow
   * 1. Get actor and intended targets
   * 2. Calculate Resolution Ladder for each target
   * 3. Execute D100 roll-under check
   * 4. Handle proximity cascade on fumble
   * 5. Apply tier-to-value mapping for impact_tier
   * 6. Apply stamina drain
   * 7. Apply status tags on failure
   * 8. Return EngineResultDto with target information
   */
  private async executeD100Intent(
    intent: DirectorUnifiedIntent['intent_queue'][0],
    gameState: GameState,
    action: Record<string, unknown>,
    actionSlug: string,
    actor: any,
    directorIntent: DirectorUnifiedIntent
  ): Promise<EngineResultDto> {
    console.log(`[LOGIC_TRACE] [EngineService] Using D100 Resolution Ladder System with Proximity Cascade`);

    // Get skill ID from intent parameters or default
    const skillId = intent.parameters.skill_id || 'root_force';

    // Process each intended target
    const resolutionSummaries: string[] = [];
    const numericDeltas: Record<string, number> = {};
    const targetResults: EngineResultDto['target_results'] = [];
    const statusTags: Record<string, string[]> = {};
    let allSuccess = true;
    let hasIntoxicated = false;

    // Determine impact tier (upgrade on critical if applicable)
    let impactTier: ImpactTier | ImpactTierLow = intent.parameters.impact_tier || 'Moderate';

    for (const intendedTargetId of intent.intended_targets) {
      let target = getEntityFromState(gameState, intendedTargetId);

      if (!target) {
        console.log(`[LOGIC_TRACE] [EngineService] Intended target not found: ${intendedTargetId}`);
        resolutionSummaries.push(`Target ${intendedTargetId.substring(0, 8)} not found`);
        allSuccess = false;
        targetResults.push({
          intent_index: 0,
          intended_targets: [intendedTargetId],
          actual_targets: [],
          resolution_summary: 'fail',
        });
        continue;
      }

      // Calculate Resolution Ladder (4-tier priority system)
      // Convert Director intent to Mas1Intent format for ladder calculation (temporary bridge)
      const mas1Intent: Mas1Intent = {
        trigger_id: intent.trigger_id as any,
        target_ids: [intendedTargetId],
        parameters: {
          verb: intent.parameters.verb,
          tactic_tag: intent.parameters.tactic_tag,
          skill_id: skillId,
          difficulty_mod: 0, // Will be calculated by ladder
        },
        duration_tag: 'moment',
        situational_tags: [],
        original_text: intent.parameters.verb,
      };

      const ladder = calculateResolutionLadder(actor, target, mas1Intent, gameState, skillId);
      hasIntoxicated = ladder.hasIntoxicated;

      // Execute D100 check
      const resolution = resolveD100Check(ladder.actorSkill, ladder.totalModifier);

      // Handle Critical: Upgrade impact tier
      if (resolution.summary === 'crit') {
        impactTier = upgradeTierOnCritical(impactTier);
        console.log(`[LOGIC_TRACE] [EngineService] Critical success! Upgraded impact tier to ${impactTier}`);
      }

      // Handle Fumble: Proximity Cascade
      let actualTargets = [intendedTargetId];
      if (resolution.summary === 'fumble' && intent.proximity_cluster.length > 0) {
        // Select random target from proximity_cluster
        const randomIndex = Math.floor(Math.random() * intent.proximity_cluster.length);
        const accidentTargetId = intent.proximity_cluster[randomIndex];
        actualTargets = [accidentTargetId];
        console.log(`[LOGIC_TRACE] [EngineService] FUMBLE! Redirected from ${intendedTargetId.substring(0, 8)} to ${accidentTargetId.substring(0, 8)} (proximity cascade)`);

        // Get the accident target for damage application
        const accidentTarget = getEntityFromState(gameState, accidentTargetId);
        if (accidentTarget) {
          target = accidentTarget;
        }
      }

      // Determine success (crit or success = true, fail or fumble = false)
      const targetSuccess = resolution.summary === 'crit' || resolution.summary === 'success';
      allSuccess = allSuccess && targetSuccess;

      // Apply status tags on failure
      if (!targetSuccess) {
        if (!statusTags[intent.actor_id]) {
          statusTags[intent.actor_id] = [];
        }
        statusTags[intent.actor_id].push('OFF_BALANCE');
        console.log(`[LOGIC_TRACE] [EngineService] Applied [OFF_BALANCE] status tag to actor ${intent.actor_id}`);
      }

      // Build summary with full breakdown
      const targetName = (target.properties?.display_name as string) ||
        (target.properties?.name as string) ||
        `entity-${actualTargets[0].substring(0, 8)}`;
      const outcomeDesc = resolution.summary === 'crit' ? 'critical success' :
        resolution.summary === 'fumble' ? 'critical failure (accident)' :
          resolution.summary;
      resolutionSummaries.push(
        `${targetName}: ${outcomeDesc} (Roll: ${resolution.roll}, Target: ${ladder.finalTarget}, Impact: ${impactTier})`
      );

      // Apply tier-to-value mapping for impact
      if (targetSuccess || resolution.summary === 'fumble') {
        // Get base HP or resource value
        const baseHp = (target.properties?.hp as number) ||
          (target.stats?.hp as number) ||
          (target.properties?.health as number) ||
          100; // Default base

        // Calculate damage/healing based on impact tier
        const impactDelta = calculateTierDelta(baseHp, impactTier);

        if (targetSuccess) {
          // Apply damage to target
          const deltaPath = `entities.${actualTargets[0]}.properties.hp`;
          numericDeltas[deltaPath] = (numericDeltas[deltaPath] || 0) - impactDelta;
          console.log(`[LOGIC_TRACE] [EngineService] Applying ${impactTier} impact (${impactDelta} damage) to ${actualTargets[0]}`);
        } else if (resolution.summary === 'fumble') {
          // Fumble still hits the accident target, but with reduced impact
          const fumbleDelta = Math.round(impactDelta * 0.5); // Half damage on accident
          const deltaPath = `entities.${actualTargets[0]}.properties.hp`;
          numericDeltas[deltaPath] = (numericDeltas[deltaPath] || 0) - fumbleDelta;
          console.log(`[LOGIC_TRACE] [EngineService] Applying fumble impact (${fumbleDelta} damage) to accident target ${actualTargets[0]}`);
        }
      }

      // Record target result (intent_index will be set by executeIntentQueue)
      targetResults.push({
        intent_index: -1, // Will be set by caller
        intended_targets: [intendedTargetId],
        actual_targets: actualTargets,
        resolution_summary: resolution.summary,
        roll: resolution.roll,
      });
    }

    // Apply stamina drain for physical intents (5-10 stamina)
    const isPhysicalIntent = intent.trigger_id === 'combat_action' ||
      intent.trigger_id === 'attempt_action' ||
      actionSlug === 'resolve_clash' ||
      actionSlug === 'attack';

    if (isPhysicalIntent) {
      const staminaDrain = 5 + Math.floor(Math.random() * 6); // 5-10
      // Target the resource key that actually exists on the actor.
      // `current_stamina` is the canonical live resource (per the vitality
      // ruleset and the client contract); `stamina` is a legacy fallback.
      const actorProps = (actor?.properties || {}) as Record<string, unknown>;
      const staminaKey = typeof actorProps.current_stamina === 'number' ? 'current_stamina'
        : typeof actorProps.stamina === 'number' ? 'stamina'
          : 'current_stamina';
      const staminaPath = `entities.${intent.actor_id}.properties.${staminaKey}`;
      numericDeltas[staminaPath] = (numericDeltas[staminaPath] || 0) - staminaDrain;
      console.log(`[LOGIC_TRACE] [EngineService] Applied stamina drain: ${staminaDrain} to ${staminaPath}`);
    }

    // Apply damage reduction hook for INTOXICATED (affects actor's incoming damage)
    const finalDeltas = applyDamageReductionHook(numericDeltas, intent.actor_id, hasIntoxicated);

    const outcomeSummary = resolutionSummaries.join(' AND ');

    return {
      success: allSuccess,
      outcome_summary: outcomeSummary,
      numeric_deltas: finalDeltas,
      target_results: targetResults,
      status_tags: statusTags,
    };
  }

  /**
   * [METHOD] executeSimpleIntent
   * ----------------------------------------------------------------
   * Processes simple actions without D100 resolution
   */
  private async executeSimpleIntent(
    intent: DirectorUnifiedIntent['intent_queue'][0],
    gameState: GameState,
    action: Record<string, unknown>,
    actionSlug: string,
    actor: any
  ): Promise<EngineResultDto> {
    const numericDeltas: Record<string, number> = {};
    let outcomeSummary = '';

    // Build outcome summary
    if (intent.intended_targets.length > 0) {
      const targetNames = intent.intended_targets.map(id => `entity-${id.substring(0, 8)}`).join(' and ');
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

    return {
      success: true,
      outcome_summary: outcomeSummary,
      numeric_deltas: numericDeltas,
      target_results: intent.intended_targets.map(targetId => ({
        intent_index: 0,
        intended_targets: [targetId],
        actual_targets: [targetId],
        resolution_summary: 'success' as const,
      })),
      status_tags: {},
    };
  }

  /**
   * [METHOD] executeD100Resolution (Legacy)
   * ----------------------------------------------------------------
   * @deprecated Use executeD100Intent instead
   * Legacy method for backward compatibility - converts Mas1Intent to Director format
   */
  private async executeD100Resolution(
    intent: Mas1Intent,
    gameState: GameState,
    action: Record<string, unknown>,
    actionSlug: string
  ): Promise<EngineResultDto> {
    // Convert Mas1Intent to Director intent format for new method
    const playerId = (gameState as any).player_id || 'unknown';
    const directorIntent: DirectorUnifiedIntent = {
      turn_meta: {
        resolution_mode: 'engine',
        time_jump_minutes: 0,
      },
      unseen_ripples: [],
      intent_queue: [{
        actor_id: playerId,
        trigger_id: intent.trigger_id,
        intended_targets: intent.target_ids,
        proximity_cluster: [],
        parameters: {
          verb: intent.parameters.verb,
          impact_tier: 'Moderate' as ImpactTierLow,
          tactic_tag: intent.parameters.tactic_tag,
          skill_id: intent.parameters.skill_id,
        },
      }],
    };

    const actor = getEntityFromState(gameState, playerId);
    if (!actor) {
      return {
        success: false,
        outcome_summary: `Actor not found: ${playerId}`,
        numeric_deltas: {},
        target_results: [],
        status_tags: {},
      };
    }

    return this.executeD100Intent(
      directorIntent.intent_queue[0],
      gameState,
      action,
      actionSlug,
      actor,
      directorIntent
    );
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

