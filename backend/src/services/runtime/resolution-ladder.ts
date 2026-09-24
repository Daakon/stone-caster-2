// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * [MODULE] Resolution Ladder & Situational Modifier Engine
 * ----------------------------------------------------------------------
 * ROLE: 4-Tier Priority Resolution System with Situational Modifiers
 * RESPONSIBILITY:
 * - Calculate resolution modifiers using 4-tier priority ladder
 * - Map situational tags to numerical modifiers
 * - Apply dual-impact logic for special conditions (e.g., INTOXICATED)
 * - Provide comprehensive math breakdown for audit logging
 *
 * CONSTRAINTS:
 * - 100% deterministic (no LLM calls)
 * - Tier 1 (Comparative) > Tier 2 (Situational) > Tier 3 (Difficulty) > Tier 4 (Tactic)
 * - Full LOGIC_TRACE math breakdown required
 */

import type { Mas1Intent } from '@shared/types/chimera-runtime';
import { calculateResolutionModifier, getEntityFromState, getActorSkill, type EntityReference } from './d100-resolution.js';
import type { GameState } from '@shared/types/chimera-runtime';

/**
 * Resolution Ladder Breakdown
 * Complete math breakdown for audit logging
 */
export interface ResolutionLadderBreakdown {
  actorSkill: number;
  tier1_comparative: number;
  tier2_situational: number;
  tier3_difficulty: number;
  tier4_tactic: number;
  totalModifier: number;
  finalTarget: number;
  situationalTags: string[];
  hasIntoxicated: boolean;
}

/**
 * Situational Modifier Registry
 * Maps situational tags from MAS-1 to numerical modifiers
 */
const SITUATIONAL_MODIFIER_REGISTRY: Record<string, number> = {
  INTOXICATED: -15,
  PROTECTING_ALLY: +10,
  EXHAUSTED: -20,
  ENRAGED: +5,
  TERRIFIED: -25,
  FOCUSED: +5,
};

/**
 * Tactic Modifier Registry
 * Maps tactic tags to modifiers (e.g., aggressive = +5 hit / -5 defense)
 */
const TACTIC_MODIFIER_REGISTRY: Record<string, number> = {
  aggressive: +5,
  defensive: -5,
  trickery: +0,
  reckless: +10,
  cautious: -5,
};

/**
 * Archetype Fallback Registry
 * Used when target stats are missing (Genesis Spawns)
 * Updated per requirements: Check properties.archetype if combat_prowess missing
 */
const ARCHETYPE_FALLBACK_REGISTRY: Record<string, number> = {
  'Bartender': -10,
  'Entertainer': -10,
  'Guard': -30,
  'Thug': -30,
  'Guard Captain': -50,
  'Knight': -50,
  // Legacy entries for backward compatibility
  'Elite Guard': -30,
  'Peasant': +10,
  'Merchant': 0,
  'Noble': -10,
};

/**
 * [METHOD] calculateTier1Comparative
 * ----------------------------------------------------------------
 * @sourceOfTruth - actor and target entities from gameState
 * @logic_flow
 * 1. Compare actor vs target stats (combat_prowess, occupation_tags)
 * 2. Return comparative modifier
 * 3. If target stats missing, use archetype fallback
 */
function calculateTier1Comparative(
  actor: EntityReference | null,
  target: EntityReference | null,
  actionType: string,
  targetName?: string
): number {
  // Use existing comparative logic
  let modifier = calculateResolutionModifier(actor, target, actionType);
  
  // Hierarchical Fallback: If target stats missing, use archetype
  if (modifier === 0 && targetName) {
    const archetypeMod = ARCHETYPE_FALLBACK_REGISTRY[targetName];
    if (archetypeMod !== undefined) {
      console.log(`[LOGIC_TRACE] [ResolutionLadder] Tier 1: Using archetype fallback for "${targetName}": ${archetypeMod}`);
      return archetypeMod;
    }
  }
  
  return modifier;
}

/**
 * [METHOD] calculateTier2Situational
 * ----------------------------------------------------------------
 * @sourceOfTruth - situational_tags from MAS-1 intent
 * @logic_flow
 * 1. Extract situational_tags from intent
 * 2. Map each tag to modifier via Situational Modifier Registry
 * 3. Sum all situational modifiers
 * 4. Return total
 */
function calculateTier2Situational(intent: Mas1Intent): { modifier: number; tags: string[] } {
  const situationalTags = intent.situational_tags || [];
  let totalModifier = 0;
  
  for (const tag of situationalTags) {
    const tagModifier = SITUATIONAL_MODIFIER_REGISTRY[tag];
    if (tagModifier !== undefined) {
      totalModifier += tagModifier;
      console.log(`[LOGIC_TRACE] [ResolutionLadder] Tier 2: Situational tag "${tag}": ${tagModifier > 0 ? '+' : ''}${tagModifier}`);
    } else {
      console.log(`[LOGIC_TRACE] [ResolutionLadder] Tier 2: Unknown situational tag "${tag}", ignoring`);
    }
  }
  
  return { modifier: totalModifier, tags: situationalTags };
}

/**
 * [METHOD] calculateTier3Difficulty
 * ----------------------------------------------------------------
 * @sourceOfTruth - difficulty_mod from MAS-1 intent parameters
 * @logic_flow
 * 1. Extract difficulty_mod from intent.parameters
 * 2. Return modifier (default 0)
 */
function calculateTier3Difficulty(intent: Mas1Intent): number {
  const difficultyMod = intent.parameters.difficulty_mod || 0;
  if (difficultyMod !== 0) {
    console.log(`[LOGIC_TRACE] [ResolutionLadder] Tier 3: Difficulty modifier: ${difficultyMod > 0 ? '+' : ''}${difficultyMod}`);
  }
  return difficultyMod;
}

/**
 * [METHOD] calculateTier4Tactic
 * ----------------------------------------------------------------
 * @sourceOfTruth - tactic_tag from MAS-1 intent parameters
 * @logic_flow
 * 1. Extract tactic_tag from intent.parameters
 * 2. Map to modifier via Tactic Modifier Registry
 * 3. Return modifier (default 0)
 */
function calculateTier4Tactic(intent: Mas1Intent): number {
  const tacticTag = intent.parameters.tactic_tag;
  if (!tacticTag) {
    return 0;
  }
  
  const tacticModifier = TACTIC_MODIFIER_REGISTRY[tacticTag];
  if (tacticModifier !== undefined) {
    console.log(`[LOGIC_TRACE] [ResolutionLadder] Tier 4: Tactic "${tacticTag}": ${tacticModifier > 0 ? '+' : ''}${tacticModifier}`);
    return tacticModifier;
  }
  
  console.log(`[LOGIC_TRACE] [ResolutionLadder] Tier 4: Unknown tactic tag "${tacticTag}", defaulting to 0`);
  return 0;
}

/**
 * [METHOD] calculateResolutionLadder
 * ----------------------------------------------------------------
 * @sourceOfTruth - gameState, intent, actor, target
 * @logic_flow
 * 1. Get actor skill
 * 2. Calculate Tier 1 (Comparative)
 * 3. Calculate Tier 2 (Situational)
 * 4. Calculate Tier 3 (Difficulty)
 * 5. Calculate Tier 4 (Tactic)
 * 6. Sum all modifiers
 * 7. Calculate final target (clamped 1-100)
 * 8. Return complete breakdown
 */
export function calculateResolutionLadder(
  actor: EntityReference | null,
  target: EntityReference | null,
  intent: Mas1Intent,
  gameState: GameState,
  skillId: string
): ResolutionLadderBreakdown {
  // Get actor skill
  const actorSkill = getActorSkill(actor, skillId);
  
  // Get target name for archetype fallback
  const targetName = target?.properties?.name as string | undefined ||
                     target?.properties?.display_name as string | undefined;
  
  // Tier 1: Comparative Modifiers (Highest Priority)
  const tier1 = calculateTier1Comparative(actor, target, intent.trigger_id, targetName);
  
  // Tier 2: Situational Modifiers
  const tier2Result = calculateTier2Situational(intent);
  const tier2 = tier2Result.modifier;
  
  // Tier 3: Difficulty Modifiers
  const tier3 = calculateTier3Difficulty(intent);
  
  // Tier 4: Tactic Modifiers (Lowest Priority)
  const tier4 = calculateTier4Tactic(intent);
  
  // Calculate total modifier
  const totalModifier = tier1 + tier2 + tier3 + tier4;
  
  // Calculate final target (clamped to 1-100)
  const finalTarget = Math.max(1, Math.min(100, actorSkill + totalModifier));
  
  // Check for INTOXICATED tag
  const hasIntoxicated = tier2Result.tags.includes('INTOXICATED');
  
  // Full Math Breakdown Logging
  console.log(`[LOGIC_TRACE] [ResolutionLadder] ===== MATH BREAKDOWN =====`);
  console.log(`[LOGIC_TRACE] [ResolutionLadder] Actor Skill: ${actorSkill}`);
  console.log(`[LOGIC_TRACE] [ResolutionLadder] Tier 1 (Comparative): ${tier1 > 0 ? '+' : ''}${tier1}`);
  console.log(`[LOGIC_TRACE] [ResolutionLadder] Tier 2 (Situational): ${tier2 > 0 ? '+' : ''}${tier2} ${tier2Result.tags.length > 0 ? `[${tier2Result.tags.join(', ')}]` : ''}`);
  console.log(`[LOGIC_TRACE] [ResolutionLadder] Tier 3 (Difficulty): ${tier3 > 0 ? '+' : ''}${tier3}`);
  console.log(`[LOGIC_TRACE] [ResolutionLadder] Tier 4 (Tactic): ${tier4 > 0 ? '+' : ''}${tier4}`);
  console.log(`[LOGIC_TRACE] [ResolutionLadder] Total Modifier: ${totalModifier > 0 ? '+' : ''}${totalModifier}`);
  console.log(`[LOGIC_TRACE] [ResolutionLadder] Final Target: ${finalTarget} (${actorSkill} + ${totalModifier})`);
  console.log(`[LOGIC_TRACE] [ResolutionLadder] ===========================`);
  
  return {
    actorSkill,
    tier1_comparative: tier1,
    tier2_situational: tier2,
    tier3_difficulty: tier3,
    tier4_tactic: tier4,
    totalModifier,
    finalTarget,
    situationalTags: tier2Result.tags,
    hasIntoxicated,
  };
}

/**
 * [METHOD] applyDamageReductionHook
 * ----------------------------------------------------------------
 * @mutates deltas - Applies damage reduction for INTOXICATED
 * @sourceOfTruth - deltas parameter
 * @logic_flow
 * 1. Check if INTOXICATED tag is present
 * 2. For each delta affecting actor's HP or Stamina, reduce by 20%
 * 3. Log reduction for audit
 */
/**
 * [METHOD] applyDamageReductionHook
 * ----------------------------------------------------------------
 * @mutates deltas - Applies 0.8x multiplier to all incoming HP/Stamina deltas for INTOXICATED actor
 * @sourceOfTruth - deltas parameter
 * @logic_flow
 * 1. Check if INTOXICATED tag is present
 * 2. For each delta affecting actor's HP or Stamina, apply 0.8x multiplier
 * 3. Log reduction for audit
 */
export function applyDamageReductionHook(
  deltas: Record<string, number>,
  actorId: string,
  hasIntoxicated: boolean
): Record<string, number> {
  if (!hasIntoxicated) {
    return deltas;
  }
  
  const reducedDeltas: Record<string, number> = { ...deltas };
  
  for (const [path, delta] of Object.entries(deltas)) {
    // Check if this delta affects the actor's HP or Stamina (incoming damage/healing)
    // Path format: entities.{actorId}.properties.hp or entities.{actorId}.properties.stamina
    if (path.includes(actorId) && (path.includes('hp') || path.includes('stamina'))) {
      // Apply 0.8x multiplier to ALL deltas (both positive and negative)
      const reducedDelta = Math.floor(delta * 0.8);
      reducedDeltas[path] = reducedDelta;
      
      console.log(`[LOGIC_TRACE] [ResolutionLadder] INTOXICATED: Applying 0.8x multiplier to ${path}`);
      console.log(`[LOGIC_TRACE] [ResolutionLadder]   Original: ${delta}, Reduced: ${reducedDelta} (20% reduction)`);
    }
  }
  
  return reducedDeltas;
}
