/**
 * Game Configuration Service
 * 
 * Loads actual game configuration from JSON files instead of using hardcoded values.
 * This ensures the system uses real data from adventure and world files.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { 
  SCENE_IDS, 
  ADVENTURE_IDS, 
  WORLD_IDS, 
  DEFAULT_VALUES,
  type SceneId,
  type AdventureId,
  type WorldId
} from '../constants/game-constants.js';

export interface AdventureConfig {
  id: string;
  title: string;
  start: {
    scene: string;
    policy: string;
    hints?: string[];
  };
  scenes: Array<{
    id: string;
    description?: string;
  }>;
}

export interface WorldConfig {
  id: string;
  name: string;
  setting: string;
  genre: string;
  themes: string[];
}

export class GameConfigService {
  private static instance: GameConfigService;
  private adventureCache = new Map<string, AdventureConfig>();
  private worldCache = new Map<string, WorldConfig>();

  static getInstance(): GameConfigService {
    if (!GameConfigService.instance) {
      GameConfigService.instance = new GameConfigService();
    }
    return GameConfigService.instance;
  }

  /**
   * Load adventure configuration from JSON files
   */
  async loadAdventureConfig(worldId: WorldId, adventureId: string): Promise<AdventureConfig | null> {
    const cacheKey = `${worldId}:${adventureId}`;
    
    if (this.adventureCache.has(cacheKey)) {
      return this.adventureCache.get(cacheKey)!;
    }

    try {
      // Handle different adventure ID formats
      let adventurePath = adventureId;
      if (adventureId === ADVENTURE_IDS.WHISPERCROSS) {
        adventurePath = 'whispercross'; // Map to actual directory name
      }
      
      const possiblePaths = [
        join(process.cwd(), 'AI API Prompts', 'worlds', worldId, 'adventures', adventurePath, 'adventure.start.prompt.json'),
        join(process.cwd(), 'AI API Prompts', 'worlds', worldId, 'adventures', adventurePath, 'adventure.prompt.json'),
        join(process.cwd(), 'backend', 'AI API Prompts', 'worlds', worldId, 'adventures', adventurePath, 'adventure.start.prompt.json'),
        join(process.cwd(), 'backend', 'AI API Prompts', 'worlds', worldId, 'adventures', adventurePath, 'adventure.prompt.json'),
      ];

      for (const path of possiblePaths) {
        try {
          const content = readFileSync(path, 'utf-8');
          const adventureData = JSON.parse(content);
          
          // Validate and normalize the adventure data
          const config: AdventureConfig = {
            id: adventureData.id || adventureId,
            title: adventureData.title || adventureId,
            start: adventureData.start || {
              scene: SCENE_IDS.DEFAULT_START,
              policy: 'ai_first',
              hints: []
            },
            scenes: adventureData.scenes || []
          };

          this.adventureCache.set(cacheKey, config);
          return config;
        } catch (error) {
          // Try next path
          continue;
        }
      }

      console.warn(`[GAME_CONFIG] Could not load adventure config for ${worldId}:${adventureId}`);
      return null;
    } catch (error) {
      console.error(`[GAME_CONFIG] Error loading adventure config:`, error);
      return null;
    }
  }

  /**
   * Load world configuration from JSON files
   */
  async loadWorldConfig(worldId: WorldId): Promise<WorldConfig | null> {
    if (this.worldCache.has(worldId)) {
      return this.worldCache.get(worldId)!;
    }

    try {
      const possiblePaths = [
        join(process.cwd(), 'AI API Prompts', 'worlds', worldId, 'world.prompt.json'),
        join(process.cwd(), 'backend', 'AI API Prompts', 'worlds', worldId, 'world.prompt.json'),
        join(process.cwd(), 'AI API Prompts', 'worlds', worldId, 'world-codex.mystika-logic.json'),
        join(process.cwd(), 'backend', 'AI API Prompts', 'worlds', worldId, 'world-codex.mystika-logic.json'),
      ];

      for (const path of possiblePaths) {
        try {
          const content = readFileSync(path, 'utf-8');
          const worldData = JSON.parse(content);
          
          const config: WorldConfig = {
            id: worldData.id || worldId,
            name: worldData.name || worldId,
            setting: worldData.setting || 'A world of magic and adventure',
            genre: worldData.genre || 'fantasy',
            themes: worldData.themes || ['magic', 'adventure', 'mystery']
          };

          this.worldCache.set(worldId, config);
          return config;
        } catch (error) {
          continue;
        }
      }

      console.warn(`[GAME_CONFIG] Could not load world config for ${worldId}`);
      return null;
    } catch (error) {
      console.error(`[GAME_CONFIG] Error loading world config:`, error);
      return null;
    }
  }

  /**
   * Get the starting scene for an adventure (from actual data, not hardcoded)
   */
  async getAdventureStartScene(worldId: WorldId, adventureId: string): Promise<SceneId> {
    const config = await this.loadAdventureConfig(worldId, adventureId);
    return (config?.start?.scene as SceneId) || SCENE_IDS.DEFAULT_START;
  }

  /**
   * Get the adventure ID for a scene (from actual data, not hardcoded mapping)
   */
  async getAdventureForScene(worldId: WorldId, sceneId: string): Promise<AdventureId | null> {
    // This should be loaded from a scene-to-adventure mapping in the world config
    // For now, we'll use a more dynamic approach
    try {
      const worldConfig = await this.loadWorldConfig(worldId);
      if (!worldConfig) return null;

      // Look for adventures that contain this scene
      const possibleAdventures = [
        ADVENTURE_IDS.WHISPERCROSS,
        // Add more as they're discovered
      ];

      for (const adventureId of possibleAdventures) {
        const adventureConfig = await this.loadAdventureConfig(worldId, adventureId);
        if (adventureConfig?.scenes?.some(scene => scene.id === sceneId)) {
          return adventureId as AdventureId;
        }
      }

      return null;
    } catch (error) {
      console.error(`[GAME_CONFIG] Error finding adventure for scene:`, error);
      return null;
    }
  }

  /**
   * Get default values with fallbacks
   */
  getDefaults() {
    return {
      scene: SCENE_IDS.DEFAULT_START,
      adventure: ADVENTURE_IDS.WHISPERCROSS,
      world: WORLD_IDS.MYSTIKA,
    };
  }
}
