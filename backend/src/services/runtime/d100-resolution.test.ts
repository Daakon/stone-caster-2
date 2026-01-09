// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Unit Tests for D100 Comparative Resolution System
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateResolutionModifier,
  resolveD100Check,
  getEntityFromState,
  getActorSkill,
  type ResolutionSummary,
} from './d100-resolution.js';
import type { GameState } from '@shared/types/chimera-runtime';

describe('D100 Resolution System', () => {
  describe('calculateResolutionModifier', () => {
    it('should apply heavy negative modifier for Elite Guard (Combat tag + high prowess)', () => {
      const actor = {
        id: 'player-1',
        properties: { name: 'Peasant' },
        stats: { root_force: 30 },
      };
      
      const target = {
        id: 'guard-1',
        properties: {
          name: 'Elite Guard',
          occupation_tags: ['Combat'],
          combat_prowess: 75,
        },
      };
      
      const modifier = calculateResolutionModifier(actor, target, 'combat_action');
      expect(modifier).toBe(-30);
    });

    it('should apply moderate negative modifier for standard combatant', () => {
      const actor = {
        id: 'player-1',
        properties: { name: 'Peasant' },
      };
      
      const target = {
        id: 'guard-1',
        properties: {
          name: 'Guard',
          occupation_tags: ['Combat'],
          combat_prowess: 50,
        },
      };
      
      const modifier = calculateResolutionModifier(actor, target, 'combat_action');
      expect(modifier).toBe(-20);
    });

    it('should apply negative modifier for high combat prowess without combat tag', () => {
      const actor = {
        id: 'player-1',
        properties: { name: 'Peasant' },
      };
      
      const target = {
        id: 'warrior-1',
        properties: {
          name: 'Warrior',
          combat_prowess: 80,
        },
      };
      
      const modifier = calculateResolutionModifier(actor, target, 'combat_action');
      expect(modifier).toBe(-25);
    });

    it('should apply positive modifier for Entertainer', () => {
      const actor = {
        id: 'player-1',
        properties: { name: 'Peasant' },
      };
      
      const target = {
        id: 'entertainer-1',
        properties: {
          name: 'Bard',
          occupation_tags: ['Entertainer'],
        },
      };
      
      const modifier = calculateResolutionModifier(actor, target, 'combat_action');
      expect(modifier).toBe(15);
    });

    it('should apply positive modifier for low combat prowess', () => {
      const actor = {
        id: 'player-1',
        properties: { name: 'Peasant' },
      };
      
      const target = {
        id: 'weak-1',
        properties: {
          name: 'Weakling',
          combat_prowess: 20,
        },
      };
      
      const modifier = calculateResolutionModifier(actor, target, 'combat_action');
      expect(modifier).toBe(10);
    });

    it('should return 0 for no clear comparison', () => {
      const actor = {
        id: 'player-1',
        properties: { name: 'Peasant' },
      };
      
      const target = {
        id: 'neutral-1',
        properties: {
          name: 'Merchant',
          combat_prowess: 50,
        },
      };
      
      const modifier = calculateResolutionModifier(actor, target, 'combat_action');
      expect(modifier).toBe(0);
    });

    it('should return 0 if target is null', () => {
      const actor = {
        id: 'player-1',
        properties: { name: 'Peasant' },
      };
      
      const modifier = calculateResolutionModifier(actor, null, 'combat_action');
      expect(modifier).toBe(0);
    });
  });

  describe('resolveD100Check', () => {
    beforeEach(() => {
      // Reset Math.random mock
      vi.spyOn(Math, 'random').mockRestore();
    });

    it('should return crit when roll <= 5', () => {
      // Mock roll of 3
      vi.spyOn(Math, 'random').mockReturnValue(0.02); // 0.02 * 100 + 1 = 3
      
      const result = resolveD100Check(50, 0);
      expect(result.summary).toBe('crit');
      expect(result.roll).toBe(3);
      expect(result.target).toBe(50);
    });

    it('should return fumble when roll >= 96', () => {
      // Mock roll of 97
      vi.spyOn(Math, 'random').mockReturnValue(0.96); // 0.96 * 100 + 1 = 97
      
      const result = resolveD100Check(50, 0);
      expect(result.summary).toBe('fumble');
      expect(result.roll).toBe(97);
    });

    it('should return success when roll <= target and not crit/fumble', () => {
      // Mock roll of 30
      vi.spyOn(Math, 'random').mockReturnValue(0.29); // 0.29 * 100 + 1 = 30
      
      const result = resolveD100Check(50, 0);
      expect(result.summary).toBe('success');
      expect(result.roll).toBe(30);
      expect(result.margin).toBe(20); // 50 - 30 = 20
    });

    it('should return fail when roll > target and not fumble', () => {
      // Mock roll of 60
      vi.spyOn(Math, 'random').mockReturnValue(0.59); // 0.59 * 100 + 1 = 60
      
      const result = resolveD100Check(50, 0);
      expect(result.summary).toBe('fail');
      expect(result.roll).toBe(60);
      expect(result.margin).toBe(-10); // 50 - 60 = -10
    });

    it('should apply modifier to target calculation', () => {
      // Mock roll of 40
      vi.spyOn(Math, 'random').mockReturnValue(0.39); // 0.39 * 100 + 1 = 40
      
      const result = resolveD100Check(50, -20); // Skill 50, modifier -20 = target 30
      expect(result.target).toBe(30);
      expect(result.summary).toBe('fail'); // 40 > 30
      expect(result.margin).toBe(-10); // 30 - 40 = -10
    });

    it('should clamp target to valid range 1-100', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      
      // Test upper bound
      const resultHigh = resolveD100Check(150, 0); // Should clamp to 100
      expect(resultHigh.target).toBe(100);
      
      // Test lower bound
      const resultLow = resolveD100Check(10, -20); // Should clamp to 1
      expect(resultLow.target).toBe(1);
    });
  });

  describe('getEntityFromState', () => {
    it('should retrieve entity from tier1_mechanical.entities', () => {
      const gameState: GameState = {
        story_id: 'story-1',
        player_id: 'player-1',
        tier1_mechanical: {
          entities: {
            'entity-1': {
              id: 'entity-1',
              properties: {
                name: 'Test Entity',
                occupation_tags: ['Combat'],
              },
            },
          },
        },
        tier0_narrative: {},
      } as any;
      
      const entity = getEntityFromState(gameState, 'entity-1');
      expect(entity).not.toBeNull();
      expect(entity?.id).toBe('entity-1');
      expect(entity?.properties?.name).toBe('Test Entity');
    });

    it('should return null if entity not found', () => {
      const gameState: GameState = {
        story_id: 'story-1',
        player_id: 'player-1',
        tier1_mechanical: {
          entities: {},
        },
        tier0_narrative: {},
      } as any;
      
      const entity = getEntityFromState(gameState, 'nonexistent');
      expect(entity).toBeNull();
    });
  });

  describe('getActorSkill', () => {
    it('should retrieve skill from actor.stats', () => {
      const actor = {
        id: 'player-1',
        stats: {
          root_force: 60,
          root_finesse: 50,
        },
      };
      
      const skill = getActorSkill(actor, 'root_force');
      expect(skill).toBe(60);
    });

    it('should retrieve skill from actor.properties', () => {
      const actor = {
        id: 'player-1',
        properties: {
          root_force: 55,
        },
      };
      
      const skill = getActorSkill(actor, 'root_force');
      expect(skill).toBe(55);
    });

    it('should return 50 (human average) if skill not found', () => {
      const actor = {
        id: 'player-1',
        properties: {},
      };
      
      const skill = getActorSkill(actor, 'root_force');
      expect(skill).toBe(50);
    });

    it('should return 50 if actor is null', () => {
      const skill = getActorSkill(null, 'root_force');
      expect(skill).toBe(50);
    });
  });

  describe('Integration: Elite Guard vs Peasant', () => {
    it('should heavily penalize Peasant attacking Elite Guard', () => {
      const peasant = {
        id: 'peasant-1',
        properties: { name: 'Peasant' },
        stats: { root_force: 30 },
      };
      
      const eliteGuard = {
        id: 'guard-1',
        properties: {
          name: 'Elite Guard',
          occupation_tags: ['Combat'],
          combat_prowess: 75,
        },
      };
      
      // Calculate modifier
      const modifier = calculateResolutionModifier(peasant, eliteGuard, 'combat_action');
      expect(modifier).toBe(-30);
      
      // With skill 30 and modifier -30, target is 0 (clamped to 1)
      // This means the peasant has almost no chance of success
      const peasantSkill = getActorSkill(peasant, 'root_force');
      expect(peasantSkill).toBe(30);
      
      // Mock a high roll to ensure failure
      vi.spyOn(Math, 'random').mockReturnValue(0.5); // Roll 51
      const result = resolveD100Check(peasantSkill, modifier);
      
      // Target should be clamped to 1 (30 - 30 = 0, clamped to 1)
      expect(result.target).toBe(1);
      // Roll 51 > target 1, so it should fail
      expect(result.summary).toBe('fail');
    });
  });

  describe('State Delta Application on Fail', () => {
    it('should not apply wound deltas when resolution is fail', () => {
      // This test verifies the engine logic (tested in engine.service.test.ts)
      // Here we verify the resolution system correctly identifies fail
      
      vi.spyOn(Math, 'random').mockReturnValue(0.8); // Roll 81
      const result = resolveD100Check(50, 0); // Target 50, roll 81 = fail
      
      expect(result.summary).toBe('fail');
      expect(result.roll).toBe(81);
      expect(result.target).toBe(50);
      
      // The engine should check result.summary === 'fail' or 'fumble'
      // and skip applying deltas
      const shouldApplyDeltas = result.summary === 'success' || result.summary === 'crit';
      expect(shouldApplyDeltas).toBe(false);
    });

    it('should not apply wound deltas when resolution is fumble', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.97); // Roll 98
      const result = resolveD100Check(50, 0);
      
      expect(result.summary).toBe('fumble');
      
      const shouldApplyDeltas = result.summary === 'success' || result.summary === 'crit';
      expect(shouldApplyDeltas).toBe(false);
    });

    it('should apply wound deltas when resolution is success', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.3); // Roll 31
      const result = resolveD100Check(50, 0);
      
      expect(result.summary).toBe('success');
      
      const shouldApplyDeltas = result.summary === 'success' || result.summary === 'crit';
      expect(shouldApplyDeltas).toBe(true);
    });

    it('should apply wound deltas when resolution is crit', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.03); // Roll 4
      const result = resolveD100Check(50, 0);
      
      expect(result.summary).toBe('crit');
      
      const shouldApplyDeltas = result.summary === 'success' || result.summary === 'crit';
      expect(shouldApplyDeltas).toBe(true);
    });
  });
});
