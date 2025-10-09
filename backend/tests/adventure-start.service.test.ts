/**
 * Tests for Adventure Start Service
 * 
 * Covers all acceptance criteria for the Universal Adventure Start system.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { adventureStartService, type StartData, type AdventureWithStart } from '../src/services/adventure-start.service.js';

describe('Adventure Start Service', () => {
  let mockAdventure: AdventureWithStart;

  beforeEach(() => {
    mockAdventure = {
      scenes: [
        { id: 'forest_meet', description: 'A wounded shifter approaches' },
        { id: 'camp_scene', description: 'A small camp ahead' }
      ]
    };
  });

  describe('Adventure Validation', () => {
    it('should validate adventure with proper start structure', () => {
      const validAdventure = {
        start: {
          scene: 'forest_meet',
          policy: 'ai_first',
          hints: ['wounded shifter', 'small camp ahead']
        },
        scenes: [
          { id: 'forest_meet', description: 'A wounded shifter approaches' },
          { id: 'camp_scene', description: 'A small camp ahead' }
        ]
      };

      const validated = adventureStartService.validateAdventure(validAdventure);

      expect(validated.start.scene).toBe('forest_meet');
      expect(validated.start.policy).toBe('ai_first');
      expect(validated.start.hints).toEqual(['wounded shifter', 'small camp ahead']);
    });

    it('should throw error for missing start', () => {
      const invalidAdventure = {
        scenes: [
          { id: 'forest_meet', description: 'A wounded shifter approaches' }
        ]
      };

      expect(() => adventureStartService.validateAdventure(invalidAdventure)).toThrow();
    });

    it('should throw error for start scene not in scenes', () => {
      const invalidAdventure = {
        start: {
          scene: 'nonexistent_scene',
          policy: 'ai_first'
        },
        scenes: [
          { id: 'forest_meet', description: 'A wounded shifter approaches' }
        ]
      };

      expect(() => adventureStartService.validateAdventure(invalidAdventure)).toThrow('Start scene "nonexistent_scene" not found in adventure scenes');
    });
  });

  describe('Start Resolver', () => {
    it('should resolve explicit scene override', () => {
      const adventureWithStart = {
        start: {
          scene: 'forest_meet',
          policy: 'ai_first' as const,
          hints: ['wounded shifter', 'small camp ahead']
        },
        scenes: [
          { id: 'forest_meet', description: 'A wounded shifter approaches' },
          { id: 'camp_scene', description: 'A small camp ahead' }
        ]
      };

      const result = adventureStartService.resolveAdventureStart(
        adventureWithStart,
        'camp_scene'
      );

      expect('sceneId' in result).toBe(true);
      if ('sceneId' in result) {
        expect(result.sceneId).toBe('camp_scene');
        expect(result.startData.scene).toBe('camp_scene');
        expect(result.startData.policy).toBe('ai_first');
        expect(result.startData.hints).toEqual(['wounded shifter', 'small camp ahead']);
      }
    });

    it('should resolve from start.scene when no explicit scene', () => {
      const adventureWithStart = {
        start: {
          scene: 'forest_meet',
          policy: 'ai_first' as const,
          hints: ['wounded shifter', 'small camp ahead']
        },
        scenes: [
          { id: 'forest_meet', description: 'A wounded shifter approaches' },
          { id: 'camp_scene', description: 'A small camp ahead' }
        ]
      };

      const result = adventureStartService.resolveAdventureStart(adventureWithStart);

      expect('sceneId' in result).toBe(true);
      if ('sceneId' in result) {
        expect(result.sceneId).toBe('forest_meet');
        expect(result.startData.hints).toEqual(['wounded shifter', 'small camp ahead']);
      }
    });

    it('should error when explicit scene not found', () => {
      const adventureWithStart = {
        start: {
          scene: 'forest_meet',
          policy: 'ai_first' as const
        },
        scenes: [
          { id: 'forest_meet', description: 'A wounded shifter approaches' }
        ]
      };

      const result = adventureStartService.resolveAdventureStart(
        adventureWithStart,
        'nonexistent_scene'
      );

      expect('code' in result).toBe(true);
      if ('code' in result) {
        expect(result.code).toBe('INVALID_SCENE');
      }
    });
  });

  describe('First Turn AWF Generation', () => {
    it('should generate AWF with required structure', () => {
      const startData: StartData = {
        scene: 'forest_meet',
        policy: 'ai_first',
        hints: ['wounded shifter', 'small camp ahead']
      };

      const sceneData = {
        id: 'forest_meet',
        description: 'A wounded shifter approaches',
        type: 'encounter',
        affordances: ['approach', 'observe', 'withdraw']
      };

      const worldContext = {
        name: 'Whispercross',
        description: 'A mystical forest realm',
        tone: 'mystical'
      };

      const playerContext = {
        name: 'Adventurer',
        background: 'Wanderer',
        stats: { courage: 60, wisdom: 70 }
      };

      const timeData = { band: 'dawn_to_mid_day', ticks: 15 };

      const awf = adventureStartService.generateFirstTurnAWF(
        'forest_meet',
        startData,
        sceneData,
        worldContext,
        playerContext,
        timeData
      );

      expect(awf).toHaveProperty('scn');
      expect(awf.scn).toEqual({ id: 'forest_meet', ph: 'scene_body' });
      expect(awf).toHaveProperty('txt');
      expect(awf).toHaveProperty('choices');
      expect(awf).toHaveProperty('acts');
      expect(awf).toHaveProperty('val');

      // Should have exactly one TIME_ADVANCE act
      const timeActs = awf.acts.filter((act: any) => act.t === 'TIME_ADVANCE');
      expect(timeActs).toHaveLength(1);
      expect(timeActs[0].payload.ticks).toBeGreaterThanOrEqual(1);
    });

    it('should derive choices from scene affordances', () => {
      const startData: StartData = { scene: 'forest_meet', policy: 'ai_first' };
      const sceneData = {
        id: 'forest_meet',
        choices: [
          { id: 'approach', text: 'Approach the shifter' },
          { id: 'observe', text: 'Observe from a distance' },
          { id: 'withdraw', text: 'Withdraw quietly' }
        ]
      };

      const awf = adventureStartService.generateFirstTurnAWF(
        'forest_meet',
        startData,
        sceneData,
        {},
        {},
        { band: 'dawn_to_mid_day', ticks: 15 }
      );

      expect(awf.choices).toHaveLength(3);
      expect(awf.choices[0]).toEqual({ id: 'approach', label: 'Approach the shifter' });
    });

    it('should derive generic choices when no scene choices', () => {
      const startData: StartData = { scene: 'forest_meet', policy: 'ai_first' };
      const sceneData = { id: 'forest_meet', type: 'general' };

      const awf = adventureStartService.generateFirstTurnAWF(
        'forest_meet',
        startData,
        sceneData,
        {},
        {},
        { band: 'dawn_to_mid_day', ticks: 15 }
      );

      expect(awf.choices).toHaveLength(3);
      expect(awf.choices.map((c: any) => c.id)).toContain('explore');
      expect(awf.choices.map((c: any) => c.id)).toContain('observe');
    });
  });
});
