/**
 * Chimera Runtime Types
 * Defines the structure for runtime game state and communication DTOs
 */

import { z } from 'zod';

/**
 * GameState
 * The complete state of a game session, split into sharded tiers for DB sanity
 */
export const GameStateSchema = z.object({
  id: z.string().uuid().optional(),
  story_id: z.string().uuid(),
  player_id: z.string().uuid(),

  /**
   * Tier 1 (Mechanical/Strict) state
   * Contains deterministic, rule-bound state (HP, Inventory, Time, Stats)
   */
  mechanical_state: z.record(z.unknown()).default({}),

  /**
   * Tier 0 (Narrative/Flexible) state
   * Contains flexible, narrative-driven state (Memories, Relationships, Story Flags)
   */
  narrative_focus: z.record(z.unknown()).default({}),

  /**
   * Scene Registry (Tier 2/Spatial)
   * Tracks entity locations and scene graph states
   */
  scene_registry: z.record(z.unknown()).default({}),

  /**
   * Action Queue
   * Pending actions to be processed
   */
  action_queue: z.array(z.unknown()).default([]),

  /**
   * Compiled System Prompt
   * The large text blob of instructions.
   * NOTE: This should be excluded from summary views.
   */
  compiled_system_prompt: z.string().optional(),

  updated_at: z.string().optional(),
});

export type GameState = z.infer<typeof GameStateSchema>;

/**
 * GameStateSummary
 * A lighter version of GameState for list views, excluding the heavy system prompt
 */
export type GameStateSummary = Omit<GameState, 'compiled_system_prompt'>;


/**
 * GameTurn
 * Represents a single tick in the game history loop
 */
export const GameTurnSchema = z.object({
  id: z.string().uuid(),
  game_state_id: z.string().uuid(),
  turn_index: z.number().int(),
  player_input: z.string(),

  // Structured Pipeline Outputs
  director_intent: z.record(z.unknown()).nullable(),      // Unified Intent DTO from Director
  mechanical_delta: z.record(z.unknown()).nullable(), // Engine changes
  narrator_output: z.record(z.unknown()).nullable(),   // Final prose from Narrator

  created_at: z.string(),
});

export type GameTurn = z.infer<typeof GameTurnSchema>;


/**
 * AiAuditLog (Telemetry)
 * Tracks cost and debugging info, optionally linked to a turn
 */
export const AiAuditLogSchema = z.object({
  id: z.string().uuid(),
  turn_id: z.string().uuid().nullable().optional(),
  action_type: z.string(),
  model_used: z.string().optional(),
  prompt_tokens: z.number().optional(),
  completion_tokens: z.number().optional(),
  cost_stones: z.number().optional(), // Virtual currency cost
  raw_response: z.string().optional(),
  created_at: z.string(),
});

export type AiAuditLog = z.infer<typeof AiAuditLogSchema>;


/**
 * DirectorUnifiedIntent - The new unified DTO from Director
 * Replaces Mas1Intent with a richer structure including unseen_ripples and intent_queue
 */
export const DirectorUnifiedIntentSchema = z.object({
  turn_meta: z.object({
    resolution_mode: z.enum(['engine', 'narrative']),
    atmosphere_shift: z.string().optional(),
    time_jump_minutes: z.number().int().default(0),
    /**
     * Player-phrased next-action suggestions rendered as chips in the UI.
     * 3-5 short imperative phrases (e.g. "Question the bartender").
     */
    suggested_actions: z.array(z.string()).max(6).default([]),
  }),
  unseen_ripples: z.array(z.object({
    target_id: z.string().uuid(),
    type: z.enum(['relationship', 'emotional', 'status']),
    delta_tier: z.enum(['Minor', 'Moderate', 'Major', 'Severe']),
    property_path: z.string(),
    reason: z.string(),
  })).default([]),
  intent_queue: z.array(z.object({
    actor_id: z.string().uuid(),
    trigger_id: z.string(),
    intended_targets: z.array(z.string().uuid()),
    proximity_cluster: z.array(z.string().uuid()).default([]),
    parameters: z.object({
      verb: z.string(),
      impact_tier: z.enum(['Low', 'Moderate', 'High', 'Severe']).optional(),
      tactic_tag: z.string().optional(),
      skill_id: z.string().optional(),
    }),
  })).default([]),
});

export type DirectorUnifiedIntent = z.infer<typeof DirectorUnifiedIntentSchema>;

/**
 * Mas1Intent - Legacy schema (deprecated, use DirectorUnifiedIntent)
 * Kept for backward compatibility during migration
 * @deprecated Use DirectorUnifiedIntent instead
 */
export const Mas1IntentSchema = z.object({
  /**
   * Trigger ID matching ruleset trigger.keyword_id
   * Must match one of the valid trigger IDs from ruleset definitions
   */
  trigger_id: z.enum(['combat_action', 'social_action', 'rest_action', 'attempt_action', 'navigate']),
  
  /**
   * Target IDs - Array of UUIDs resolved from entity names
   * Supports multiple targets per action (e.g., "I attack the Goblin and the Orc")
   */
  target_ids: z.array(z.string().uuid()),
  
  /**
   * Action parameters extracted from user input
   */
  parameters: z.object({
    /**
     * Verb extracted from user input (e.g., "slash", "attack", "intimidate")
     */
    verb: z.string(),
    
    /**
     * Tactic tag indicating approach (e.g., "aggressive", "defensive", "trickery", "reckless")
     * Maps to ruleset action logic modifiers
     */
    tactic_tag: z.string().optional(),
    
    /**
     * Difficulty modifier for skill checks
     */
    difficulty_mod: z.number().optional(),
    
    /**
     * Skill ID to use for resolution (e.g., "root_force", "root_finesse", "root_awareness")
     */
    skill_id: z.string().optional(),
  }),
  
  /**
   * Duration tag indicating action scope
   */
  duration_tag: z.enum(['moment', 'scene', 'journey', 'rest']),
  
  /**
   * Situational tags for contextual modifiers
   * Extracted by Director from user input and game state
   * Maps to Situational Modifier Registry in Engine (see 03_Universal_Turn_Protocol)
   */
  situational_tags: z.array(z.string()).optional(),
  
  /**
   * Original user input text for reference
   */
  original_text: z.string(),
});

export type Mas1Intent = z.infer<typeof Mas1IntentSchema>;

/**
 * Mas1ResponseDto (Legacy/Compat - to be refactored into GameTurn.director_intent)
 * @deprecated Use DirectorUnifiedIntent instead
 */
export const Mas1ResponseDtoSchema = z.object({
  action_slug: z.string(),
  parameters: z.record(z.unknown()),
  sentiment: z.string(),
});
export type Mas1ResponseDto = z.infer<typeof Mas1ResponseDtoSchema>;

/**
 * EngineResultDto - Result from Engine processing
 * Includes target information for Narrator to distinguish intended vs actual targets
 */
export const EngineResultDtoSchema = z.object({
  success: z.boolean(),
  numeric_deltas: z.record(z.string(), z.number()).default({}),
  outcome_summary: z.string(),
  // Target information for proximity cascade handling
  target_results: z.array(z.object({
    intent_index: z.number().int(), // Index in intent_queue
    intended_targets: z.array(z.string().uuid()),
    actual_targets: z.array(z.string().uuid()), // May differ from intended on fumble
    resolution_summary: z.enum(['crit', 'success', 'fail', 'fumble']),
    roll: z.number().int().optional(),
  })).default([]),
  // Status tags applied to actors (e.g., [OFF_BALANCE])
  status_tags: z.record(z.string(), z.array(z.string())).default({}), // actor_id -> [tag1, tag2]
});
export type EngineResultDto = z.infer<typeof EngineResultDtoSchema>;

/**
 * NarratorOutputDto - The new Narrator output structure
 * Replaces Mas2ResponseDto with clearer naming
 */
export const NarratorOutputDtoSchema = z.object({
  narration: z.string(),
  hints: z.array(z.string()).default([]),
  tier0_mutations: z.record(z.string(), z.unknown()).default({}),
  thought_chain: z.string().optional(),
});

export type NarratorOutputDto = z.infer<typeof NarratorOutputDtoSchema>;

/**
 * Mas2ResponseDto (Legacy/Compat - to be refactored into GameTurn.narrator_output)
 * @deprecated Use NarratorOutputDto instead
 */
export const Mas2ResponseDtoSchema = z.object({
  ripple_narrative: z.string(),
  tier0_mutations: z.record(z.string(), z.unknown()).default({}),
  thought_chain: z.string().optional(),
  state_updates: z.object({
    entity_updates: z.array(z.object({
      id: z.string().uuid(),
      path: z.string(),
      value: z.union([z.number(), z.string(), z.boolean()]),
      description: z.string().optional(),
    })).default([]),
    world_updates: z.record(z.string(), z.unknown()).default({}),
  }).optional(),
});
export type Mas2ResponseDto = z.infer<typeof Mas2ResponseDtoSchema>;

