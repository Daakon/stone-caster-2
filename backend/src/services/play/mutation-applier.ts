/**
 * Mutation Applier Utility
 * Phase 4: The Play Engine
 * 
 * Applies mutations to game state using JSON path operations
 */

import type { MutationDto } from './action-resolver.js';

/**
 * Apply a mutation to a game state object
 * 
 * @param state - The game state object to mutate (GameStateTiers structure)
 * @param mutation - The mutation to apply
 */
export function applyMutation(
  state: Record<string, unknown>,
  mutation: MutationDto
): void {
  const pathParts = mutation.path.split('/').filter((p) => p.length > 0);
  
  if (pathParts.length === 0) {
    throw new Error(`Invalid mutation path: ${mutation.path}`);
  }

  // Navigate to the parent object
  // Paths are like: /tier1_singular_state/world_time or /tier1_singular_state/actor_health/player
  let current: Record<string, unknown> = state;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const key = pathParts[i];
    if (!(key in current)) {
      // Create nested object if it doesn't exist
      current[key] = {};
    }
    const next = current[key];
    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      // Overwrite if it's not an object
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  const finalKey = pathParts[pathParts.length - 1];

  // Apply the operation
  switch (mutation.op) {
    case 'set':
      current[finalKey] = mutation.value;
      break;
    case 'add':
      const currentValue = current[finalKey];
      if (typeof currentValue === 'number' && typeof mutation.value === 'number') {
        current[finalKey] = currentValue + mutation.value;
      } else if (Array.isArray(currentValue)) {
        current[finalKey] = [...currentValue, mutation.value];
      } else {
        throw new Error(`Cannot add to non-numeric/non-array value at ${mutation.path}`);
      }
      break;
    case 'remove':
      if (Array.isArray(current[finalKey])) {
        const arr = current[finalKey] as unknown[];
        const index = arr.indexOf(mutation.value);
        if (index !== -1) {
          arr.splice(index, 1);
        }
      } else {
        delete current[finalKey];
      }
      break;
    default:
      throw new Error(`Unknown mutation operation: ${(mutation as MutationDto).op}`);
  }
}

/**
 * Apply multiple mutations to a game state
 * 
 * @param state - The game state object to mutate
 * @param mutations - Array of mutations to apply
 */
export function applyMutations(
  state: Record<string, unknown>,
  mutations: MutationDto[]
): void {
  for (const mutation of mutations) {
    applyMutation(state, mutation);
  }
}

