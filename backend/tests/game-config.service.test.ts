import { describe, it, expect, beforeEach } from 'vitest';
import { GameConfigService } from '../src/services/game-config.service.js';
import { SCENE_IDS, ADVENTURE_IDS, WORLD_IDS } from '../src/constants/game-constants.js';

describe('GameConfigService', () => {
  let gameConfigService: GameConfigService;

  beforeEach(() => {
    gameConfigService = GameConfigService.getInstance();
  });

  describe('Adventure Configuration Loading', () => {
    it('should load adventure configuration from JSON files', async () => {
      const config = await gameConfigService.loadAdventureConfig(WORLD_IDS.MYSTIKA, ADVENTURE_IDS.WHISPERCROSS);
      
      expect(config).toBeDefined();
      expect(config?.id).toBe(ADVENTURE_IDS.WHISPERCROSS);
      expect(config?.start).toBeDefined();
      expect(config?.start.scene).toBe(SCENE_IDS.DEFAULT_START);
      expect(config?.start.policy).toBe('ai_first');
      expect(config?.scenes).toBeDefined();
      expect(config?.scenes.length).toBeGreaterThan(0);
    });

    it('should return null for non-existent adventure', async () => {
      const config = await gameConfigService.loadAdventureConfig(WORLD_IDS.MYSTIKA, 'non-existent-adventure');
      
      expect(config).toBeNull();
    });
  });

  describe('World Configuration Loading', () => {
    it('should load world configuration from JSON files', async () => {
      const config = await gameConfigService.loadWorldConfig(WORLD_IDS.MYSTIKA);
      
      expect(config).toBeDefined();
      expect(config?.id).toBe('world.mystika.prompt.v3');
      expect(config?.name).toBeDefined();
      expect(config?.setting).toBeDefined();
      expect(config?.genre).toBeDefined();
      expect(config?.themes).toBeDefined();
    });

    it('should return null for non-existent world', async () => {
      const config = await gameConfigService.loadWorldConfig('non-existent-world' as any);
      
      expect(config).toBeNull();
    });
  });

  describe('Scene to Adventure Mapping', () => {
    it('should find adventure for scene using actual data', async () => {
      const adventureId = await gameConfigService.getAdventureForScene(WORLD_IDS.MYSTIKA, SCENE_IDS.DEFAULT_START);
      
      expect(adventureId).toBeDefined();
      expect(adventureId).toBe(ADVENTURE_IDS.WHISPERCROSS);
    });

    it('should return null for non-existent scene', async () => {
      const adventureId = await gameConfigService.getAdventureForScene(WORLD_IDS.MYSTIKA, 'non-existent-scene');
      
      expect(adventureId).toBeNull();
    });
  });

  describe('Adventure Start Scene Resolution', () => {
    it('should get starting scene from adventure data', async () => {
      const startScene = await gameConfigService.getAdventureStartScene(WORLD_IDS.MYSTIKA, ADVENTURE_IDS.WHISPERCROSS);
      
      expect(startScene).toBe(SCENE_IDS.DEFAULT_START);
    });

    it('should fallback to default for non-existent adventure', async () => {
      const startScene = await gameConfigService.getAdventureStartScene(WORLD_IDS.MYSTIKA, 'non-existent-adventure');
      
      expect(startScene).toBe(SCENE_IDS.DEFAULT_START);
    });
  });

  describe('Default Values', () => {
    it('should provide correct default values', () => {
      const defaults = gameConfigService.getDefaults();
      
      expect(defaults.scene).toBe(SCENE_IDS.DEFAULT_START);
      expect(defaults.adventure).toBe(ADVENTURE_IDS.WHISPERCROSS);
      expect(defaults.world).toBe(WORLD_IDS.MYSTIKA);
    });
  });

  describe('Caching', () => {
    it('should cache loaded configurations', async () => {
      // Load first time
      const config1 = await gameConfigService.loadAdventureConfig(WORLD_IDS.MYSTIKA, ADVENTURE_IDS.WHISPERCROSS);
      
      // Load second time (should be cached)
      const config2 = await gameConfigService.loadAdventureConfig(WORLD_IDS.MYSTIKA, ADVENTURE_IDS.WHISPERCROSS);
      
      expect(config1).toBe(config2); // Same object reference due to caching
    });
  });
});
