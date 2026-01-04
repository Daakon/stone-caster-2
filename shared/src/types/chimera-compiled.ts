/**
 * Chimera Compiled Types
 * Defines the structure for compiled Story Dimensions ready for runtime execution
 */

import { z } from 'zod';

/**
 * CompiledStory
 * The output of the compiler - a fully resolved and executable Story Dimension
 */
export const CompiledStorySchema = z.object({
  /**
   * Database ID (optional for new compilations)
   */
  id: z.string().uuid().optional(),

  /**
   * The draft story identifier (key or UUID)
   */
  story_key: z.string().optional(),

  /**
   * Compilation version
   */
  version: z.number().int().default(1),

  /**
   * Core Engine Configuration (Rulesets, mechanics)
   */
  config_engine: z.record(z.unknown()).default({}),

  /**
   * Interpreter Prompts & Logic
   */
  prompt_interpreter_logic: z.string().optional(),

  /**
   * Narrator Style & Prompts
   */
  prompt_narrator_style: z.string().optional(),

  /**
   * Frozen World State
   */
  snapshot_world: z.record(z.unknown()).default({}),

  /**
   * Frozen Entities
   */
  snapshot_entities: z.union([z.record(z.unknown()), z.array(z.unknown())]).default({}),

  /**
   * Metadata about the compilation
   */
  meta: z.object({
    /**
     * Array of source IDs that contributed to this compiled story
     */
    source_ids: z.array(z.string()).optional(),
  }).optional().default({}),

  /**
   * Master schema defining valid game state and actions
   */
  master_schema: z.object({
    /**
     * Tier 1 (mechanical) field allowlist - strict state fields
     */
    tier1_allowlist: z.array(z.string()).default([]),

    /**
     * Tier 0 (narrative) field allowlist - flexible state fields
     */
    tier0_allowlist: z.array(z.string()).default([]),

    /**
     * Map of action slugs to their definitions
     */
    actions_map: z.record(z.string(), z.string()).default({}),
  }).optional().default({}),

  /**
   * Narrative index - references to lore fragments for narrative generation
   */
  narrative_index: z.array(z.object({
    /**
     * Lore fragment ID
     */
    id: z.string().uuid(),

    /**
     * Tags associated with this lore fragment
     */
    tags: z.array(z.string()),

    /**
     * Optional relevance score or metadata
     */
    relevance: z.number().optional(),
  })).default([]),

  /**
   * Initial game state - the starting state for new games
   */
  initial_state: z.record(z.unknown()).optional().default({}),
});

export type CompiledStory = z.infer<typeof CompiledStorySchema>;

