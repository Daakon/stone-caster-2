/**
 * State Factory Service
 * Phase 4: The Play Engine
 * 
 * Creates and initializes new game states from compiled story rulesets
 */

import { supabaseAdmin } from '../supabase.js';
import type { CompiledStoryJson } from '../chimera/rebuild-service.js';

/**
 * ChimeraGameState interface
 */
export interface ChimeraGameState {
  id: string;
  story_id: string; // UUID reference to chimera_stories.id
  user_id: string;
  current_game_state: Record<string, unknown>;
  turn_count: number;
  status: 'active' | 'ended' | 'abandoned';
  created_at: string;
  updated_at: string;
}

/**
 * Initialize a new game state from a compiled story
 * 
 * @param storyId - The story ID (UUID) to start
 * @param compiledStory - The compiled story JSON from the compiler
 * @param userId - The user ID starting the game
 * @returns The created game state
 */
export async function createInitialState(
  storyId: string, // UUID
  compiledStory: CompiledStoryJson,
  userId: string
): Promise<ChimeraGameState> {
  // Step 1: Create newGameState object initialized from final_state_schema
  const newGameState = initializeGameState(compiledStory);

  // Step 2: Set default values from rules/defaults
  applyDefaultValues(newGameState, compiledStory);

  // Step 3: Create DB record
  const { data: gameState, error } = await supabaseAdmin
    .from('chimera_game_states')
    .insert({
      story_id: storyId,
      user_id: userId,
      current_game_state: newGameState,
      turn_count: 0,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create game state: ${error.message}`);
  }

  return gameState as ChimeraGameState;
}

/**
 * Initialize game state structure from final_state_schema
 * 
 * The final_state_schema contains the default values defined in the ruleset's
 * state_schema_contributions. Deep cloning preserves all default values.
 */
function initializeGameState(compiledStory: CompiledStoryJson): Record<string, unknown> {
  const stateSchema = compiledStory.final_state_schema;

  // Initialize the tiered structure with defaults from the schema
  // Deep clone ensures we get all default values from state_schema_contributions
  const gameState: Record<string, unknown> = {
    tier0_tracked_state: stateSchema.tier0_tracked_state
      ? deepClone(stateSchema.tier0_tracked_state as Record<string, unknown>)
      : {},
    tier1_singular_state: stateSchema.tier1_singular_state
      ? deepClone(stateSchema.tier1_singular_state as Record<string, unknown>)
      : {},
    tier2_relational_state: stateSchema.tier2_relational_state
      ? deepClone(stateSchema.tier2_relational_state as Record<string, unknown>)
      : {},
  };

  return gameState;
}

/**
 * Apply default values from the compiled story
 * 
 * This function ensures common defaults are set if not already present in the schema.
 * The primary defaults come from final_state_schema (handled in initializeGameState),
 * but we apply fallback defaults for common fields like world_time.
 */
function applyDefaultValues(
  gameState: Record<string, unknown>,
  compiledStory: CompiledStoryJson
): void {
  const tier1 = gameState.tier1_singular_state as Record<string, unknown>;
  
  // Set world_time to 00:00 (midnight) if not already set in the schema
  // Format: ISO 8601 timestamp
  if (!tier1.world_time) {
    // Set to current date at midnight (00:00:00)
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    tier1.world_time = now.toISOString();
  }

  // Ensure actor_health structure exists if referenced in schema
  // Default player health to 100 if actor_health.player is not set
  if (tier1.actor_health) {
    const actorHealth = tier1.actor_health as Record<string, unknown>;
    if (!actorHealth.player && typeof actorHealth.player !== 'number') {
      actorHealth.player = 100;
    }
  }
}

/**
 * Deep clone an object
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }
  
  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  
  return cloned;
}

