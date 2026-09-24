// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Unit Tests for Resolution Ladder & Situational Modifier Engine
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateResolutionLadder,
  applyDamageReductionHook,
} from './resolution-ladder.js';
import type { Mas1Intent } from '@shared/types/chimera-runtime';
import type { GameState } from '@shared/types/chimera-runtime';

describe('Resolution Ladder System', () => {
  const mockGameState: GameState = {
    story_id: 'story-1',
    player_id: 'player-1',
    tier1_mechanical: {},
    tier0_narrative: {},
  } as any;

  describe('calculateResolutionLadder', () => {
    it('should calculate all 4 tiers correctly', () => {
      const actor = {
        id: 'player-1',
        stats: { root_force: 50 },
      };

      const target = {
        id: 'guard-1',
        properties: {
          name: 'Elite Guard',
          occupation_tags: ['Combat'],
          combat_prowess: 75,
        },
      };

      const intent: Mas1Intent = {
        trigger_id: 'combat_action',
        target_ids: ['guard-1'],
        parameters: {
          verb: 'attack',
          skill_id: 'root_force',
          difficulty_mod: -10,
          tactic_tag: 'aggressive',
        },
        duration_tag: 'moment',
        situational_tags: ['PROTECTING_ALLY'],
        original_text: 'I attack the guard',
      };

      const ladder = calculateResolutionLadder(actor, target, intent, mockGameState, 'root_force');

      // Tier 1: Elite Guard with Combat tag = -30
      expect(ladder.tier1_comparative).toBe(-30);
      
      // Tier 2: PROTECTING_ALLY = +10
      expect(ladder.tier2_situational).toBe(10);
      expect(ladder.situationalTags).toContain('PROTECTING_ALLY');
      
      // Tier 3: difficulty_mod = -10
      expect(ladder.tier3_difficulty).toBe(-10);
      
      // Tier 4: aggressive = +5
      expect(ladder.tier4_tactic).toBe(5);
      
      // Total: 50 + (-30) + 10 + (-10) + 5 = 25
      expect(ladder.totalModifier).toBe(-25);
      expect(ladder.finalTarget).toBe(25); // 50 - 25 = 25
    });

    it('should apply INTOXICATED penalty correctly', () => {
      const actor = {
        id: 'player-1',
        stats: { root_force: 50 },
      };

      const target = {
        id: 'guard-1',
        properties: {
          name: 'Guard',
          combat_prowess: 50,
        },
      };

      const intent: Mas1Intent = {
        trigger_id: 'combat_action',
        target_ids: ['guard-1'],
        parameters: {
          verb: 'attack',
          skill_id: 'root_force',
        },
        duration_tag: 'moment',
        situational_tags: ['INTOXICATED'],
        original_text: 'I attack while drunk',
      };

      const ladder = calculateResolutionLadder(actor, target, intent, mockGameState, 'root_force');

      // Tier 2: INTOXICATED = -15
      expect(ladder.tier2_situational).toBe(-15);
      expect(ladder.hasIntoxicated).toBe(true);
      expect(ladder.situationalTags).toContain('INTOXICATED');
      
      // Total: 50 + 0 + (-15) + 0 + 0 = 35
      expect(ladder.finalTarget).toBe(35);
    });

    it('should use archetype fallback when target stats missing', () => {
      const actor = {
        id: 'player-1',
        stats: { root_force: 50 },
      };

      const target = {
        id: 'guard-1',
        properties: {
          name: 'Guard Captain', // Archetype name
          // No combat_prowess or occupation_tags
        },
      };

      const intent: Mas1Intent = {
        trigger_id: 'combat_action',
        target_ids: ['guard-1'],
        parameters: {
          verb: 'attack',
          skill_id: 'root_force',
        },
        duration_tag: 'moment',
        original_text: 'I attack the guard captain',
      };

      const ladder = calculateResolutionLadder(actor, target, intent, mockGameState, 'root_force');

      // Tier 1: Should use archetype fallback for "Guard Captain" = -20
      expect(ladder.tier1_comparative).toBe(-20);
    });
  });

  describe('applyDamageReductionHook', () => {
    it('should reduce actor damage by 20% when INTOXICATED', () => {
      const actorId = 'player-1';
      const deltas: Record<string, number> = {
        'entities.player-1.properties.hp': -20,
        'entities.player-1.properties.stamina': -15,
        'entities.guard-1.properties.hp': -10, // Should not be reduced
      };

      const reduced = applyDamageReductionHook(deltas, actorId, true);

      // Actor's HP damage: -20 * 0.8 = -16
      expect(reduced['entities.player-1.properties.hp']).toBe(-16);
      
      // Actor's Stamina damage: -15 * 0.8 = -12
      expect(reduced['entities.player-1.properties.stamina']).toBe(-12);
      
      // Target's damage should not be reduced
      expect(reduced['entities.guard-1.properties.hp']).toBe(-10);
    });

    it('should not reduce damage when not INTOXICATED', () => {
      const actorId = 'player-1';
      const deltas: Record<string, number> = {
        'entities.player-1.properties.hp': -20,
        'entities.player-1.properties.stamina': -15,
      };

      const reduced = applyDamageReductionHook(deltas, actorId, false);

      // No reduction should occur
      expect(reduced['entities.player-1.properties.hp']).toBe(-20);
      expect(reduced['entities.player-1.properties.stamina']).toBe(-15);
    });

    it('should not reduce positive deltas (healing)', () => {
      const actorId = 'player-1';
      const deltas: Record<string, number> = {
        'entities.player-1.properties.hp': 10, // Healing
        'entities.player-1.properties.stamina': 5, // Recovery
      };

      const reduced = applyDamageReductionHook(deltas, actorId, true);

      // Positive deltas should not be reduced
      expect(reduced['entities.player-1.properties.hp']).toBe(10);
      expect(reduced['entities.player-1.properties.stamina']).toBe(5);
    });
  });

  describe('test_drunk_combat scenario', () => {
    it('should apply INTOXICATED penalty and reduce incoming damage', () => {
      const actor = {
        id: 'player-1',
        stats: { root_force: 50 },
        properties: { hp: 100, stamina: 100 },
      };

      const target = {
        id: 'guard-1',
        properties: {
          name: 'Guard',
          combat_prowess: 50,
        },
      };

      const intent: Mas1Intent = {
        trigger_id: 'combat_action',
        target_ids: ['guard-1'],
        parameters: {
          verb: 'attack',
          skill_id: 'root_force',
        },
        duration_tag: 'moment',
        situational_tags: ['INTOXICATED'],
        original_text: 'test_drunk_combat',
      };

      const ladder = calculateResolutionLadder(actor, target, intent, mockGameState, 'root_force');

      // Verify INTOXICATED penalty applied
      expect(ladder.hasIntoxicated).toBe(true);
      expect(ladder.tier2_situational).toBe(-15);
      
      // Final target should be lower (50 - 15 = 35)
      expect(ladder.finalTarget).toBe(35);

      // Simulate counter-attack damage
      const counterAttackDeltas: Record<string, number> = {
        'entities.player-1.properties.stamina': -20,
      };

      const reduced = applyDamageReductionHook(counterAttackDeltas, 'player-1', true);
      
      // Damage should be reduced by 20%: -20 * 0.8 = -16
      expect(reduced['entities.player-1.properties.stamina']).toBe(-16);
    });
  });

  describe('test_protective_combat scenario', () => {
    it('should apply PROTECTING_ALLY bonus', () => {
      const actor = {
        id: 'player-1',
        stats: { root_force: 50 },
      };

      const target = {
        id: 'guard-1',
        properties: {
          name: 'Guard',
          combat_prowess: 50,
        },
      };

      const intent: Mas1Intent = {
        trigger_id: 'combat_action',
        target_ids: ['guard-1'],
        parameters: {
          verb: 'defend',
          skill_id: 'root_force',
          tactic_tag: 'defensive',
        },
        duration_tag: 'moment',
        situational_tags: ['PROTECTING_ALLY'],
        original_text: 'test_protective_combat',
      };

      const ladder = calculateResolutionLadder(actor, target, intent, mockGameState, 'root_force');

      // Verify PROTECTING_ALLY bonus applied
      expect(ladder.tier2_situational).toBe(10);
      expect(ladder.situationalTags).toContain('PROTECTING_ALLY');
      
      // Tier 4: defensive = -5
      expect(ladder.tier4_tactic).toBe(-5);
      
      // Total: 50 + 0 + 10 + 0 + (-5) = 55
      expect(ladder.finalTarget).toBe(55);
    });
  });

  describe('Tier 1 Archetype Fallback (Hardening)', () => {
    it('should use archetype when combat_prowess is missing', () => {
      const actor = {
        id: 'player-1',
        stats: { root_force: 50 },
      };

      const target = {
        id: 'guard-1',
        properties: {
          name: 'Guard',
          archetype: 'Guard', // archetype present, combat_prowess missing
          // combat_prowess is undefined
        },
      };

      const intent: Mas1Intent = {
        trigger_id: 'combat_action',
        target_ids: ['guard-1'],
        parameters: {
          verb: 'attack',
          skill_id: 'root_force',
        },
        duration_tag: 'moment',
        original_text: 'test_combat',
      };

      const ladder = calculateResolutionLadder(actor, target, intent, mockGameState, 'root_force');

      // Guard archetype should give -30 modifier
      expect(ladder.tier1_comparative).toBe(-30);
      expect(ladder.finalTarget).toBe(20); // 50 - 30 = 20
    });

    it('should use Guard Captain archetype for -50 modifier', () => {
      const actor = {
        id: 'player-1',
        stats: { root_force: 50 },
      };

      const target = {
        id: 'guard-captain-1',
        properties: {
          name: 'Guard Captain',
          archetype: 'Guard Captain',
        },
      };

      const intent: Mas1Intent = {
        trigger_id: 'combat_action',
        target_ids: ['guard-captain-1'],
        parameters: {
          verb: 'attack',
          skill_id: 'root_force',
        },
        duration_tag: 'moment',
        original_text: 'test_combat',
      };

      const ladder = calculateResolutionLadder(actor, target, intent, mockGameState, 'root_force');

      // Guard Captain archetype should give -50 modifier
      expect(ladder.tier1_comparative).toBe(-50);
      expect(ladder.finalTarget).toBe(0); // Clamped to minimum 1
    });

    it('should use Bartender/Entertainer archetype for -10 modifier', () => {
      const actor = {
        id: 'player-1',
        stats: { root_force: 50 },
      };

      const target = {
        id: 'bartender-1',
        properties: {
          name: 'Bartender',
          archetype: 'Bartender',
        },
      };

      const intent: Mas1Intent = {
        trigger_id: 'combat_action',
        target_ids: ['bartender-1'],
        parameters: {
          verb: 'attack',
          skill_id: 'root_force',
        },
        duration_tag: 'moment',
        original_text: 'test_combat',
      };

      const ladder = calculateResolutionLadder(actor, target, intent, mockGameState, 'root_force');

      // Bartender archetype should give -10 modifier
      expect(ladder.tier1_comparative).toBe(-10);
      expect(ladder.finalTarget).toBe(40); // 50 - 10 = 40
    });
  });

  describe('INTOXICATED Damage Reduction (Hardening)', () => {
    it('should apply 0.8x multiplier to ALL incoming HP/Stamina deltas for actor', () => {
      const actorId = 'player-1';
      const deltas: Record<string, number> = {
        [`entities.${actorId}.properties.hp`]: -10, // Incoming damage
        [`entities.${actorId}.properties.stamina`]: -5, // Incoming stamina loss
        [`entities.enemy-1.properties.hp`]: -15, // Enemy damage (should NOT be reduced)
      };

      const reduced = applyDamageReductionHook(deltas, actorId, true);

      // Actor's HP damage: -10 * 0.8 = -8 (floored)
      expect(reduced[`entities.${actorId}.properties.hp`]).toBe(-8);
      
      // Actor's stamina loss: -5 * 0.8 = -4 (floored)
      expect(reduced[`entities.${actorId}.properties.stamina`]).toBe(-4);
      
      // Enemy damage should NOT be reduced
      expect(reduced[`entities.enemy-1.properties.hp`]).toBe(-15);
    });

    it('should apply 0.8x to positive deltas (healing) as well', () => {
      const actorId = 'player-1';
      const deltas: Record<string, number> = {
        [`entities.${actorId}.properties.hp`]: 10, // Incoming healing
        [`entities.${actorId}.properties.stamina`]: 5, // Incoming stamina gain
      };

      const reduced = applyDamageReductionHook(deltas, actorId, true);

      // Healing should also be reduced: 10 * 0.8 = 8
      expect(reduced[`entities.${actorId}.properties.hp`]).toBe(8);
      
      // Stamina gain: 5 * 0.8 = 4
      expect(reduced[`entities.${actorId}.properties.stamina`]).toBe(4);
    });

    it('should NOT reduce damage if INTOXICATED tag is not present', () => {
      const actorId = 'player-1';
      const deltas: Record<string, number> = {
        [`entities.${actorId}.properties.hp`]: -10,
        [`entities.${actorId}.properties.stamina`]: -5,
      };

      const reduced = applyDamageReductionHook(deltas, actorId, false);

      // Should return unchanged
      expect(reduced).toEqual(deltas);
    });
  });
});
