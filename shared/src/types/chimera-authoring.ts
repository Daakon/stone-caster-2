/**
 * Chimera Authoring Types
 * Defines the structure for authoring-time data: characters, worlds, rulesets, entities, and lore
 */

import { z } from 'zod';
import { ChimeraAssetRefSchema } from './chimera-assets';

/**
 * BaseCharacter
 * The root template for character creation (identity, stats, inventory)
 */
export const BaseCharacterSchema = z.object({
  /**
   * Unique identifier for the character template
   */
  id: z.string().uuid(),

  /**
   * Character name
   */
  name: z.string().min(1),

  /**
   * Character identity/background information
   */
  identity: z.record(z.unknown()),

  /**
   * Character statistics (attributes, skills, etc.)
   */
  stats: z.record(z.unknown()),

  /**
   * Starting inventory items
   */
  inventory: z.array(z.record(z.unknown())).default([]),
});

export type BaseCharacter = z.infer<typeof BaseCharacterSchema>;

/**
 * WorldDefinition
 * Complete definition of a game world including its structure, extensions, and lore
 */
export const WorldDefinitionSchema = z.object({
  /**
   * Unique identifier for the world
   */
  id: z.string().uuid(),

  /**
   * World name
   */
  name: z.string().min(1),

  /**
   * World description
   */
  description: z.string(),

  /**
   * Array of image references for the world
   */
  images: z.array(ChimeraAssetRefSchema).default([]),

  /**
   * Character schema extensions specific to this world
   * Allows worlds to define custom character properties
   */
  character_schema_extensions: z.record(z.unknown()).default({}),

  /**
   * Array of lore fragments associated with this world
   */
  lore_fragments: z.array(z.string().uuid()).default([]),
});

export type WorldDefinition = z.infer<typeof WorldDefinitionSchema>;

/**
 * RulesetDefinition
 * Canonical schema for ruleset definitions matching the database structure
 */
export const RulesetDefinitionSchema = z.object({
  /**
   * Unique identifier for the ruleset
   */
  id: z.string(),

  /**
   * Human-readable name of the ruleset
   */
  name: z.string().min(1),

  /**
   * UI category classification
   */
  ui_category: z.enum(['foundation', 'expansion', 'flavor']),

  /**
   * Exclusion group identifier - rulesets in the same group are mutually exclusive
   * null if the ruleset has no exclusion constraints
   */
  exclusion_group: z.string().nullable(),

  /**
   * Array of ruleset IDs that this ruleset depends on
   */
  dependencies: z.array(z.string()).default([]),

  /**
   * Array of tags that this ruleset provides
   */
  provides_tags: z.array(z.string()).default([]),

  /**
   * State contributions - defines what state fields this ruleset contributes
   * Critical for the Compiler to merge state schemas
   */
  state_contributions: z.record(z.unknown()).default({}),

  /**
   * Actions - definitions of moves/actions that this ruleset provides
   */
  actions: z.record(z.unknown()).default({}),

  /**
   * AI instructions - guidance for AI systems on how to use this ruleset
   */
  ai_instructions: z.record(z.unknown()).default({}),

  /**
   * Character schema extensions specific to this ruleset
   * Allows rulesets to define default character properties (e.g., mana pool, health)
   * These are deep merged onto the base character schema during compilation
   */
  character_schema_extensions: z.record(z.unknown()).optional(),
});

export type RulesetDefinition = z.infer<typeof RulesetDefinitionSchema>;

/**
 * EntityTemplate
 * Template for creating game entities (NPCs, items, locations)
 */
export const EntityTemplateSchema = z.object({
  /**
   * Unique identifier for the entity template
   */
  id: z.string().uuid(),

  /**
   * Kind of entity
   */
  kind: z.enum(['npc', 'item', 'location']),

  /**
   * Raw entity data as JSON
   */
  raw_data: z.record(z.unknown()),
});

export type EntityTemplate = z.infer<typeof EntityTemplateSchema>;

/**
 * LoreFragment
 * A piece of narrative knowledge or story content
 */
export const LoreFragmentSchema = z.object({
  /**
   * Unique identifier for the lore fragment
   */
  id: z.string().uuid(),

  /**
   * Content of the lore fragment (text, narrative, etc.)
   */
  content: z.string().min(1),

  /**
   * Tags for categorizing and searching the lore fragment
   */
  tags: z.array(z.string()).default([]),

  /**
   * Optional embedding vector for semantic search
   */
  embedding: z.array(z.number()).optional(),
});

export type LoreFragment = z.infer<typeof LoreFragmentSchema>;

