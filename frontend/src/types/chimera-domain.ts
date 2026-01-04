/**
 * Chimera Domain Types
 * Strict source of truth for the new Domain Model
 * 
 * These types define the canonical structure for:
 * - Tier 0: WorldDefinition (Worlds)
 * - Tier 1: EntityTemplate (Entities)
 * - Draft Workspace: StoryDraft (Story Creation State)
 * 
 * Reference: @docs/chimera-full-schemas.json
 */

// ============================================================================
// TIER 0: WORLD DEFINITION
// ============================================================================

/**
 * WorldDefinition
 * Complete definition of a game world (Tier 0)
 * Stored in chimera_worlds.definition (JSONB)
 */
export interface WorldDefinition {
  /**
   * Unique identifier (UUID)
   * Matches chimera_worlds.id
   */
  world_id?: string;

  /**
   * World title/name
   */
  title: string;

  /**
   * Short summary/description
   */
  summary: string;

  /**
   * Genre classification tags
   */
  genre_tags: string[];

  /**
   * Content safety filters
   */
  safety_filters: ('pg' | 'pg13' | 'rlite')[];

  /**
   * Array of ruleset keys (e.g., ["d100-5-pillars"])
   * References rulesets by their key (string identifier)
   */
  ruleset_keys: string[];

  /**
   * Selected world preset ID (if using preset)
   */
  world_preset_id?: string;

  /**
   * Cover image URL
   * Matches chimera_stories.image_url
   */
  image_url?: string;
}

// ============================================================================
// TIER 1: ENTITY TEMPLATE
// ============================================================================

/**
 * EntityTemplate
 * Template for creating game entities (Tier 1)
 * Stored in chimera_entities.entity_json (JSONB)
 * 
 * Stats use the new domain model:
 * - root_force
 * - root_finesse
 * - root_awareness
 * - root_insight
 * - root_influence
 */
export interface EntityTemplate {
  /**
   * Unique identifier (UUID)
   * Matches chimera_entities.id
   */
  entity_id?: string;

  /**
   * World this entity belongs to (optional)
   * Matches chimera_entities.world_id
   */
  world_id?: string;

  /**
   * Entity name
   */
  name: string;

  /**
   * Entity Kind/Type
   */
  kind: 'npc' | 'item' | 'location' | 'faction';

  /**
   * Descriptive tags for filtering
   */
  tags: string[];

  /**
   * Whether this entity is a player character
   */
  is_player: boolean;

  /**
   * Dynamic stats based on ruleset
   * Uses new domain model: root_force, root_finesse, root_awareness, root_insight, root_influence
   */
  stats: Record<string, number>;

  /**
   * Personality traits and characteristics
   */
  personality: {
    /**
     * Core personality traits
     */
    core_traits: string[];

    /**
     * Core values and beliefs
     */
    core_values: string[];

    /**
     * Quirks and mannerisms
     */
    quirks: string[];
  };

  // Note: Additional fields may exist in entity_json but are typed here for frontend use
}

// ============================================================================
// DRAFT WORKSPACE STATE
// ============================================================================

/**
 * StoryDraft
 * State for the Story Creation (Draft Workspace)
 * Manages the multi-step wizard state and staged content
 */
export interface StoryDraft {
  /**
   * Unique identifier for this draft
   * Usually matches world_id when creating a new story
   */
  draft_id: string;

  /**
   * Current step in the creation wizard (0-4)
   * 0: Intent/Genre selection
   * 1: World selection/creation
   * 2: Ruleset selection
   * 3: Entity staging
   * 4: Review and finalize
   */
  current_step: number;

  /**
   * Timestamp of last modification (Unix epoch in milliseconds)
   */
  last_modified: number;

  /**
   * World metadata for this draft
   */
  metadata: WorldDefinition;

  /**
   * Array of entity IDs that are staged/linked to this draft
   */
  staged_entity_ids: string[];

  /**
   * Array of lore fragment IDs that are staged/linked to this draft
   */
  staged_lore_ids: string[];

  /**
   * Whether a save operation is currently in progress
   */
  is_saving: boolean;

  /**
   * Whether the draft has unsaved changes
   */
  /**
   * Whether the draft has unsaved changes
   */
  is_dirty: boolean;

  /**
   * Genesis Configuration for the Director's Slate
   */
  genesis_config?: GenesisConfig;
}

export interface CastExtra {
  id: string; // uuidv4 or random string for keying
  name: string;          // Hidden Identity (e.g. "Garrick")
  visual_alias: string;  // First Impression (e.g. "A Slumped Guard")
  archetype: string;     // Behavior (e.g. "Guard")

  // The Visual Tokens
  race: string;          // e.g. "Human", "Drow", "Construct"
  attire: string;        // e.g. "Rusted Chainmail", "Velvet Doublet"
  quirk: string;         // e.g. "Smells of gin", "Twitching eye"
}

export interface GenesisConfig {
  // Narrator Controls (The Lens)
  pacing: 'concise' | 'balanced' | 'descriptive';
  narrator_tone: string; // e.g. 'Gritty', 'High Fantasy', 'Mystery'
  perspective: 'second_person' | 'third_person'; // "You do" vs "Kael does"

  // Scene Setup (The Stage)
  set_design: string;
  opening_action: string;

  // The Cast (The Actors)
  cast_members: string[];       // IDs of existing "Star" NPCs
  cast_extras: CastExtra[];     // List of defined "Extras"
}
