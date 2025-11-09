/**
 * Relationship Reducers
 */

import type { GameState } from '../../services/game-state.service.js';
import type { RelationshipDelta, RelationshipSet } from '../schemas/relationships.js';
import { getModuleParams } from '../../services/module-params.service.js';

/**
 * Apply relationship.delta action
 */
export async function applyRelationshipDelta(
  state: GameState,
  payload: RelationshipDelta,
  storyId?: string
): Promise<GameState> {
  // Get module params (merged with defaults)
  let params: Record<string, any> | null = null;
  if (storyId) {
    params = await getModuleParams(storyId, 'module.relationships.v3');
  }

  // Fallback to defaults if params invalid
  const scale = params?.gainCurve?.scale ?? 1.0;
  const softCap = params?.gainCurve?.softCap ?? 12;
  const hardCap = params?.gainCurve?.hardCap ?? 20;
  const minTrustToRomance = params?.minTrustToRomance ?? 6;

  // Initialize relationships slice if not present
  if (!state.ledgers) {
    state.ledgers = {};
  }
  if (!state.ledgers['relationships']) {
    state.ledgers['relationships'] = {};
  }

  const relationships = state.ledgers['relationships'] as Record<string, Record<string, number>>;
  
  // Initialize NPC if not present
  if (!relationships[payload.npcId]) {
    relationships[payload.npcId] = {
      warmth: 5,
      trust: 5,
      respect: 5,
      desire: 5,
      awe: 5,
    };
  }

  // Apply scaled delta
  const currentValue = relationships[payload.npcId][payload.stat] || 5;
  const scaledDelta = Math.round(payload.delta * scale);
  let newValue = currentValue + scaledDelta;

  // Apply soft cap (gradual reduction above threshold)
  if (newValue > softCap) {
    const excess = newValue - softCap;
    const reduction = excess * 0.5; // Reduce excess by 50%
    newValue = softCap + reduction;
  }

  // Apply hard cap
  newValue = Math.max(0, Math.min(hardCap, newValue));

  // Enforce romance gating if applicable
  if (payload.stat === 'desire' && params?.romance?.allowed && newValue > 0) {
    const trust = relationships[payload.npcId].trust || 5;
    if (trust < minTrustToRomance) {
      // Block romance if trust too low
      newValue = 0;
      console.warn(`[Relationships] Romance blocked: trust ${trust} < minTrustToRomance ${minTrustToRomance}`);
    }
  }

  relationships[payload.npcId][payload.stat] = newValue;

  return state;
}

/**
 * Apply relationship.set action
 */
export async function applyRelationshipSet(
  state: GameState,
  payload: RelationshipSet,
  storyId?: string
): Promise<GameState> {
  // Initialize relationships slice if not present
  if (!state.ledgers) {
    state.ledgers = {};
  }
  if (!state.ledgers['relationships']) {
    state.ledgers['relationships'] = {};
  }

  const relationships = state.ledgers['relationships'] as Record<string, Record<string, number>>;
  
  // Initialize NPC if not present
  if (!relationships[payload.npcId]) {
    relationships[payload.npcId] = {
      warmth: 5,
      trust: 5,
      respect: 5,
      desire: 5,
      awe: 5,
    };
  }

  // Get module params for hard cap
  let params: Record<string, any> | null = null;
  if (storyId) {
    params = await getModuleParams(storyId, 'module.relationships.v3');
  }
  const hardCap = params?.gainCurve?.hardCap ?? 20;

  // Set value (clamp to hard cap)
  relationships[payload.npcId][payload.stat] = Math.max(0, Math.min(hardCap, payload.value));

  return state;
}

