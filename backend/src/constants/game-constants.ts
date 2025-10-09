/**
 * Game Constants and Enums
 * 
 * Centralized constants to avoid hardcoded strings throughout the codebase.
 * All game-specific values should reference actual data from JSON files.
 */

// Scene Constants
export const SCENE_IDS = {
  // Default starting scenes (should be loaded from adventure data)
  DEFAULT_START: 'forest_meet',
  LEGACY_OPENING: 'opening', // Deprecated - use DEFAULT_START
} as const;

// Adventure Constants  
export const ADVENTURE_IDS = {
  // These should be loaded from actual adventure files, not hardcoded
  WHISPERCROSS: 'adv.whispercross.start.v3',
  WHISPERCROSS_LEGACY: 'adventure_whispercross_hook', // Deprecated
} as const;

// World Constants
export const WORLD_IDS = {
  // These should be loaded from actual world files, not hardcoded
  MYSTIKA: 'mystika',
  VERYA: 'verya',
} as const;

// Game State Constants
export const GAME_STATE_KEYS = {
  CURRENT_SCENE: 'currentScene',
  TURN_INDEX: 'turn_index',
  SCENES_VISITED: 'game.scenes_visited',
  ACTIONS_TAKEN: 'game.actions_taken',
  TURNS: 'game.turns',
  INITIALIZED: 'game.initialized',
  WORLD: 'game.world',
  STARTING_SCENE: 'game.starting_scene',
} as const;

// Adventure Start Constants
export const ADVENTURE_START_KEYS = {
  SCENE: 'scene',
  POLICY: 'policy',
  HINTS: 'hints',
} as const;

// Adventure Start Policies
export const ADVENTURE_POLICIES = {
  AI_FIRST: 'ai_first',
  SCRIPTED: 'scripted',
} as const;

// Scene Mapping Constants (should be loaded from config, not hardcoded)
export const SCENE_TO_ADVENTURE_MAPPING = {
  [WORLD_IDS.MYSTIKA]: {
    [SCENE_IDS.DEFAULT_START]: ADVENTURE_IDS.WHISPERCROSS,
    'whispercross': ADVENTURE_IDS.WHISPERCROSS,
    'outer_paths_meet_kiera_01': ADVENTURE_IDS.WHISPERCROSS,
  },
} as const;

// Default Values (fallbacks when data is missing)
export const DEFAULT_VALUES = {
  SCENE: SCENE_IDS.DEFAULT_START,
  ADVENTURE: ADVENTURE_IDS.WHISPERCROSS,
  WORLD: WORLD_IDS.MYSTIKA,
  POLICY: ADVENTURE_POLICIES.AI_FIRST,
} as const;

// Legacy Support (deprecated values)
export const LEGACY_VALUES = {
  OPENING_SCENE: SCENE_IDS.LEGACY_OPENING,
  ADVENTURE_OPENING: 'adventure_opening',
} as const;

// Type definitions for better type safety
export type SceneId = typeof SCENE_IDS[keyof typeof SCENE_IDS];
export type AdventureId = typeof ADVENTURE_IDS[keyof typeof ADVENTURE_IDS];
export type WorldId = typeof WORLD_IDS[keyof typeof WORLD_IDS];
export type AdventurePolicy = typeof ADVENTURE_POLICIES[keyof typeof ADVENTURE_POLICIES];
