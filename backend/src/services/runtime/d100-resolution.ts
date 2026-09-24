// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * [MODULE] D100 Resolution System
 * ----------------------------------------------------------------------
 * ROLE: Comparative D100 Roll-Under Resolution Engine
 * RESPONSIBILITY:
 * - Calculate resolution modifiers based on actor/target comparison
 * - Execute D100 roll-under checks
 * - Determine resolution outcomes (crit/success/fail/fumble)
 *
 * CONSTRAINTS:
 * - 100% deterministic (no LLM calls)
 * - Roll-Under: Success = Roll <= (ActorSkill + Modifier)
 * - Critical: Roll <= 5
 * - Fumble: Roll >= 96
 */

import type { GameState } from '@shared/types/chimera-runtime';

/**
 * Resolution Summary
 * The outcome of a D100 resolution check
 */
export type ResolutionSummary = 'crit' | 'success' | 'fail' | 'fumble';

/**
 * Resolution Result
 * Complete result of a D100 resolution
 */
export interface ResolutionResult {
  roll: number;
  target: number; // ActorSkill + Modifier
  modifier: number;
  summary: ResolutionSummary;
  margin: number; // target - roll (positive = success, negative = fail)
}

/**
 * Entity Reference
 * Simplified entity structure for resolution calculations
 */
interface EntityReference {
  id: string;
  properties?: {
    occupation_tags?: string[];
    combat_prowess?: number;
    [key: string]: unknown;
  };
  stats?: Record<string, number>;
  [key: string]: unknown;
}

/**
 * [METHOD] calculateResolutionModifier
 * ----------------------------------------------------------------
 * @sourceOfTruth - actor and target entity data from gameState
 * @logic_flow
 * 1. Check target's occupation_tags for "Combat" -> apply negative modifier
 * 2. Check target's combat_prowess -> apply negative modifier if high
 * 3. Check if target is "Entertainer" or low-prowess -> apply positive modifier
 * 4. Default to 0 if no clear comparison
 */
/**
 * Archetype Fallback Registry (Tier 1)
 * Used when combat_prowess is missing - check properties.archetype
 */
const ARCHETYPE_TIER1_REGISTRY: Record<string, number> = {
  'Bartender': -10,
  'Entertainer': -10,
  'Guard': -30,
  'Thug': -30,
  'Guard Captain': -50,
  'Knight': -50,
};

export function calculateResolutionModifier(
  actor: EntityReference | null,
  target: EntityReference | null,
  actionType: string
): number {
  if (!target || !target.properties) {
    return 0;
  }

  const occupationTags = target.properties.occupation_tags || [];
  const combatProwess = target.properties.combat_prowess;
  const archetype = target.properties.archetype as string | undefined;

  // TIER 1 HARDENING: If combat_prowess is missing, check archetype
  if (combatProwess === undefined || combatProwess === null) {
    if (archetype) {
      const archetypeMod = ARCHETYPE_TIER1_REGISTRY[archetype];
      if (archetypeMod !== undefined) {
        console.log(`[LOGIC_TRACE] [D100Resolution] Tier 1: Missing combat_prowess, using archetype "${archetype}": ${archetypeMod} modifier`);
        return archetypeMod;
      }
    }
    // If no archetype match, continue with other checks
  }

  // Check for combat-oriented target
  if (occupationTags.includes('Combat') || occupationTags.includes('combat')) {
    // Elite combatant: heavy penalty
    if (combatProwess && combatProwess >= 70) {
      console.log(`[LOGIC_TRACE] [D100Resolution] Elite combatant detected: -30 modifier`);
      return -30;
    }
    // Standard combatant: moderate penalty
    console.log(`[LOGIC_TRACE] [D100Resolution] Combat-oriented target: -20 modifier`);
    return -20;
  }

  // Check for high combat prowess (even without combat tag)
  if (combatProwess && combatProwess >= 70) {
    console.log(`[LOGIC_TRACE] [D100Resolution] High combat prowess (${combatProwess}): -25 modifier`);
    return -25;
  }

  // Check for entertainer or low-prowess (easy target)
  if (occupationTags.includes('Entertainer') || occupationTags.includes('entertainer')) {
    console.log(`[LOGIC_TRACE] [D100Resolution] Entertainer target: +15 modifier`);
    return 15;
  }

  // Low combat prowess (weak target)
  if (combatProwess !== undefined && combatProwess < 30) {
    console.log(`[LOGIC_TRACE] [D100Resolution] Low combat prowess (${combatProwess}): +10 modifier`);
    return 10;
  }

  // Default: no modifier
  console.log(`[LOGIC_TRACE] [D100Resolution] No clear comparison: 0 modifier`);
  return 0;
}

/**
 * [METHOD] resolveD100Check
 * ----------------------------------------------------------------
 * @logic_flow
 * 1. Calculate target value: ActorSkill + Modifier
 * 2. Roll D100 (1-100)
 * 3. Determine outcome based on roll vs target:
 *    - Crit: roll <= 5
 *    - Fumble: roll >= 96
 *    - Success: roll <= target (and not crit/fumble)
 *    - Fail: roll > target (and not fumble)
 * 4. Calculate margin (target - roll)
 * 5. Return ResolutionResult
 */
export function resolveD100Check(
  actorSkill: number,
  modifier: number
): ResolutionResult {
  // Calculate target (clamp to valid range 1-100)
  const target = Math.max(1, Math.min(100, actorSkill + modifier));
  
  // Roll D100
  const roll = Math.floor(Math.random() * 100) + 1;
  
  // Determine outcome
  let summary: ResolutionSummary;
  if (roll <= 5) {
    summary = 'crit';
  } else if (roll >= 96) {
    summary = 'fumble';
  } else if (roll <= target) {
    summary = 'success';
  } else {
    summary = 'fail';
  }
  
  const margin = target - roll;
  
  console.log(`[LOGIC_TRACE] [D100Resolution] Roll: ${roll}, Target: ${target} (Skill: ${actorSkill} + Mod: ${modifier}), Outcome: ${summary}, Margin: ${margin}`);
  
  return {
    roll,
    target,
    modifier,
    summary,
    margin,
  };
}

/**
 * [METHOD] getEntityFromState
 * ----------------------------------------------------------------
 * @sourceOfTruth - gameState parameter
 * @logic_flow
 * 1. Check tier1_mechanical.entities[entityId]
 * 2. Return entity or null if not found
 */
export function getEntityFromState(
  gameState: GameState,
  entityId: string
): EntityReference | null {
  const tier1 = (gameState as any).tier1_mechanical || {};
  const entities = tier1.entities || {};
  const entity = entities[entityId];
  
  if (!entity) {
    return null;
  }
  
  return entity as EntityReference;
}

/**
 * [METHOD] getActorSkill
 * ----------------------------------------------------------------
 * @sourceOfTruth - actor entity from gameState
 * @logic_flow
 * 1. Check actor.stats for skill_id
 * 2. Check actor.properties for skill_id
 * 3. Default to 50 (human average) if not found
 */
export function getActorSkill(
  actor: EntityReference | null,
  skillId: string
): number {
  if (!actor) {
    return 50; // Default human average
  }
  
  // Check stats first
  if (actor.stats && typeof actor.stats[skillId] === 'number') {
    return actor.stats[skillId];
  }
  
  // Check properties
  if (actor.properties && typeof actor.properties[skillId] === 'number') {
    return actor.properties[skillId] as number;
  }
  
  // Default to 50 (human average for D100 system)
  return 50;
}
