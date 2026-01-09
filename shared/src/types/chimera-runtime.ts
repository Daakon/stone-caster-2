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
  mas1_intent: z.record(z.unknown()).nullable(),      // Interpreter output
  mechanical_delta: z.record(z.unknown()).nullable(), // Engine changes
  mas2_narration: z.record(z.unknown()).nullable(),   // Final output

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
 * Mas1Intent - Robust Schema for Ruleset Engine
 * Matches ruleset trigger.keyword_id definitions and supports multiple targets
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
   * Original user input text for reference
   */
  original_text: z.string(),
});

export type Mas1Intent = z.infer<typeof Mas1IntentSchema>;

/**
 * Mas1ResponseDto (Legacy/Compat - to be refactored into GameTurn.mas1_intent)
 */
export const Mas1ResponseDtoSchema = z.object({
  action_slug: z.string(),
  parameters: z.record(z.unknown()),
  sentiment: z.string(),
});
export type Mas1ResponseDto = z.infer<typeof Mas1ResponseDtoSchema>;

/**
 * EngineResultDto (Legacy/Compat - to be refactored into GameTurn.mechanical_delta)
 */
export const EngineResultDtoSchema = z.object({
  success: z.boolean(),
  numeric_deltas: z.record(z.string(), z.number()).default({}),
  outcome_summary: z.string(),
});
export type EngineResultDto = z.infer<typeof EngineResultDtoSchema>;

/**
 * Mas2ResponseDto (Legacy/Compat - to be refactored into GameTurn.mas2_narration)
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

