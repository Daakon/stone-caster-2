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
   * Metadata about the compilation
   */
  meta: z.object({
    /**
     * Array of source IDs that contributed to this compiled story
     */
    source_ids: z.array(z.string()),
  }),

  /**
   * Master schema defining valid game state and actions
   */
  master_schema: z.object({
    /**
     * Tier 1 (mechanical) field allowlist - strict state fields
     */
    tier1_allowlist: z.array(z.string()),

    /**
     * Tier 0 (narrative) field allowlist - flexible state fields
     */
    tier0_allowlist: z.array(z.string()),

    /**
     * Map of action slugs to their definitions
     */
    actions_map: z.record(z.string(), z.string()),
  }),

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
  initial_state: z.record(z.unknown()),
});

export type CompiledStory = z.infer<typeof CompiledStorySchema>;

