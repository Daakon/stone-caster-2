/**
 * Scene Slice Policy
 * Phase 3: Bundle Assembler - Scene-based slice selection policy
 */

import { SceneSlicePolicy, DefaultSliceConfig } from '../types/awf-bundle.js';

/**
 * Scene to slices mapping for deterministic slice selection
 * Each scene can have specific slices that are relevant to that location/context
 */
export const sceneSlicePolicy: SceneSlicePolicy = {
  // Forest scenes
  'forest_clearing': ['timekeeping', 'whispercross_region', 'encounter_forest_edge'],
  'forest_deep': ['timekeeping', 'whispercross_region', 'encounter_forest_deep'],
  'forest_edge': ['timekeeping', 'whispercross_region', 'encounter_forest_edge'],
  
  // Town scenes
  'town_square': ['timekeeping', 'whispercross_region', 'encounter_town_square'],
  'town_tavern': ['timekeeping', 'whispercross_region', 'encounter_town_tavern'],
  'town_market': ['timekeeping', 'whispercross_region', 'encounter_town_market'],
  
  // Dungeon scenes
  'dungeon_entrance': ['timekeeping', 'whispercross_region', 'encounter_dungeon_entrance'],
  'dungeon_corridor': ['timekeeping', 'whispercross_region', 'encounter_dungeon_corridor'],
  'dungeon_chamber': ['timekeeping', 'whispercross_region', 'encounter_dungeon_chamber'],
  
  // Special scenes
  'boss_encounter': ['timekeeping', 'whispercross_region', 'encounter_boss'],
  'puzzle_room': ['timekeeping', 'whispercross_region', 'encounter_puzzle'],
  'dialogue_scene': ['timekeeping', 'whispercross_region', 'encounter_dialogue'],
  
  // Default fallback
  'default': ['timekeeping', 'whispercross_region', 'encounter_general'],
};

/**
 * Default slice configuration for worlds and adventures
 * Used when no specific scene slices are available
 */
export const defaultSliceConfig: DefaultSliceConfig = {
  world: ['timekeeping', 'whispercross_region', 'world_lore'],
  adventure: ['timekeeping', 'whispercross_region', 'adventure_progression'],
};

/**
 * Get slices for a specific scene
 * @param sceneId - Scene identifier
 * @returns Array of slice names for the scene
 */
export function getSlicesForScene(sceneId: string): string[] {
  return sceneSlicePolicy[sceneId] || sceneSlicePolicy.default;
}

/**
 * Get default slices for world
 * @returns Default world slices
 */
export function getDefaultWorldSlices(): string[] {
  return defaultSliceConfig.world;
}

/**
 * Get default slices for adventure
 * @returns Default adventure slices
 */
export function getDefaultAdventureSlices(): string[] {
  return defaultSliceConfig.adventure;
}

/**
 * Check if a scene has specific slice configuration
 * @param sceneId - Scene identifier
 * @returns True if scene has specific slices, false otherwise
 */
export function hasSceneSpecificSlices(sceneId: string): boolean {
  return sceneId in sceneSlicePolicy && sceneId !== 'default';
}

/**
 * Get all available scenes with slice configurations
 * @returns Array of scene IDs
 */
export function getAvailableScenes(): string[] {
  return Object.keys(sceneSlicePolicy).filter(scene => scene !== 'default');
}

/**
 * Get slice configuration summary for logging
 * @returns Object with scene counts and slice information
 */
export function getSlicePolicySummary(): {
  totalScenes: number;
  totalSlices: number;
  uniqueSlices: string[];
} {
  const scenes = getAvailableScenes();
  const allSlices = scenes.flatMap(scene => sceneSlicePolicy[scene]);
  const uniqueSlices = [...new Set(allSlices)];
  
  return {
    totalScenes: scenes.length,
    totalSlices: allSlices.length,
    uniqueSlices,
  };
}


