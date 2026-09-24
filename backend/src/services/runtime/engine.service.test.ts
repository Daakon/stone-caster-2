// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Unit Tests for EngineService D100 Resolution Integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EngineService } from './engine.service.js';
import type { GameState, Mas1Intent } from '@shared/types/chimera-runtime';

describe('EngineService D100 Resolution Integration', () => {
  let engineService: EngineService;
  
  beforeEach(() => {
    engineService = new EngineService();
    vi.spyOn(Math, 'random').mockRestore();
  });

  describe('D100 Resolution for Combat Actions', () => {
    it('should use D100 resolution for combat_action with targets', async () => {
      const gameState: GameState = {
        story_id: 'story-1',
        player_id: 'player-1',
        tier1_mechanical: {
          entities: {
            'player-1': {
              id: 'player-1',
              properties: { name: 'Peasant' },
              stats: { root_force: 30 },
            },
            'guard-1': {
              id: 'guard-1',
              properties: {
                name: 'Elite Guard',
                occupation_tags: ['Combat'],
                combat_prowess: 75,
                hp: 100,
              },
            },
          },
        },
        tier0_narrative: {},
      } as any;

      const intent: Mas1Intent = {
        trigger_id: 'combat_action',
        target_ids: ['guard-1'],
        parameters: {
          verb: 'attack',
          skill_id: 'root_force',
        },
        duration_tag: 'moment',
        original_text: 'I attack the guard',
      };

      const actionsMap = {
        resolve_clash: {
          damage: 10,
        },
      };

      // Mock a fail roll (high roll)
      vi.spyOn(Math, 'random').mockReturnValue(0.8); // Roll 81
      
      const result = await engineService.execute(intent, gameState, actionsMap);
      
      // Should fail due to high roll
      expect(result.success).toBe(false);
      expect(result.outcome_summary).toContain('fail');
      
      // CRITICAL: No deltas should be applied on fail
      expect(Object.keys(result.numeric_deltas)).toHaveLength(0);
    });

    it('should apply damage deltas only on success or crit', async () => {
      const gameState: GameState = {
        story_id: 'story-1',
        player_id: 'player-1',
        tier1_mechanical: {
          entities: {
            'player-1': {
              id: 'player-1',
              properties: { name: 'Warrior' },
              stats: { root_force: 70 },
            },
            'guard-1': {
              id: 'guard-1',
              properties: {
                name: 'Weak Guard',
                combat_prowess: 20,
                hp: 100,
              },
            },
          },
        },
        tier0_narrative: {},
      } as any;

      const intent: Mas1Intent = {
        trigger_id: 'combat_action',
        target_ids: ['guard-1'],
        parameters: {
          verb: 'attack',
          skill_id: 'root_force',
        },
        duration_tag: 'moment',
        original_text: 'I attack the guard',
      };

      const actionsMap = {
        resolve_clash: {
          damage: 15,
        },
      };

      // Mock a success roll (low roll)
      vi.spyOn(Math, 'random').mockReturnValue(0.2); // Roll 21
      
      const result = await engineService.execute(intent, gameState, actionsMap);
      
      // Should succeed
      expect(result.success).toBe(true);
      expect(result.outcome_summary).toContain('success');
      
      // Deltas should be applied on success
      expect(Object.keys(result.numeric_deltas).length).toBeGreaterThan(0);
      const damagePath = Object.keys(result.numeric_deltas).find(path => 
        path.includes('guard-1') && path.includes('hp')
      );
      expect(damagePath).toBeDefined();
      if (damagePath) {
        expect(result.numeric_deltas[damagePath]).toBe(-15); // Negative for damage
      }
    });

    it('should apply damage deltas on crit', async () => {
      const gameState: GameState = {
        story_id: 'story-1',
        player_id: 'player-1',
        tier1_mechanical: {
          entities: {
            'player-1': {
              id: 'player-1',
              properties: { name: 'Warrior' },
              stats: { root_force: 70 },
            },
            'guard-1': {
              id: 'guard-1',
              properties: {
                name: 'Guard',
                hp: 100,
              },
            },
          },
        },
        tier0_narrative: {},
      } as any;

      const intent: Mas1Intent = {
        trigger_id: 'combat_action',
        target_ids: ['guard-1'],
        parameters: {
          verb: 'attack',
          skill_id: 'root_force',
        },
        duration_tag: 'moment',
        original_text: 'I attack the guard',
      };

      const actionsMap = {
        resolve_clash: {
          damage: 20,
        },
      };

      // Mock a crit roll (very low roll)
      vi.spyOn(Math, 'random').mockReturnValue(0.03); // Roll 4
      
      const result = await engineService.execute(intent, gameState, actionsMap);
      
      // Should succeed (crit is a success)
      expect(result.success).toBe(true);
      expect(result.outcome_summary).toContain('crit');
      
      // Deltas should be applied on crit
      expect(Object.keys(result.numeric_deltas).length).toBeGreaterThan(0);
    });

    it('should not apply damage deltas on fumble', async () => {
      const gameState: GameState = {
        story_id: 'story-1',
        player_id: 'player-1',
        tier1_mechanical: {
          entities: {
            'player-1': {
              id: 'player-1',
              properties: { name: 'Warrior' },
              stats: { root_force: 70 },
            },
            'guard-1': {
              id: 'guard-1',
              properties: {
                name: 'Guard',
                hp: 100,
              },
            },
          },
        },
        tier0_narrative: {},
      } as any;

      const intent: Mas1Intent = {
        trigger_id: 'combat_action',
        target_ids: ['guard-1'],
        parameters: {
          verb: 'attack',
          skill_id: 'root_force',
        },
        duration_tag: 'moment',
        original_text: 'I attack the guard',
      };

      const actionsMap = {
        resolve_clash: {
          damage: 20,
        },
      };

      // Mock a fumble roll (very high roll)
      vi.spyOn(Math, 'random').mockReturnValue(0.97); // Roll 98
      
      const result = await engineService.execute(intent, gameState, actionsMap);
      
      // Should fail (fumble is a failure)
      expect(result.success).toBe(false);
      expect(result.outcome_summary).toContain('fumble');
      
      // CRITICAL: No deltas should be applied on fumble
      expect(Object.keys(result.numeric_deltas)).toHaveLength(0);
    });
  });

  describe('Resolution Ladder Integration', () => {
    it('should apply full 4-tier ladder for test_drunk_combat', async () => {
      const gameState: GameState = {
        story_id: 'story-1',
        player_id: 'player-1',
        tier1_mechanical: {
          entities: {
            'player-1': {
              id: 'player-1',
              properties: { name: 'Player', hp: 100, stamina: 100 },
              stats: { root_force: 50 },
            },
            'guard-1': {
              id: 'guard-1',
              properties: {
                name: 'Guard',
                combat_prowess: 50,
                hp: 100,
              },
            },
          },
        },
        tier0_narrative: {},
      } as any;

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

      const actionsMap = {
        resolve_clash: {
          damage: 10,
        },
      };

      // Mock a success roll (low roll to ensure success despite INTOXICATED penalty)
      vi.spyOn(Math, 'random').mockReturnValue(0.2); // Roll 21
      
      const result = await engineService.execute(intent, gameState, actionsMap);
      
      // Should succeed (roll 21 <= target ~35 with INTOXICATED penalty)
      // Note: Target will be 50 (skill) - 15 (INTOXICATED) = 35
      expect(result.success).toBe(true);
      // Verify the breakdown is in the summary
      expect(result.outcome_summary).toContain('T2:-15'); // Tier 2 situational modifier
      
      // Verify damage reduction hook would apply if counter-attack occurred
      // (This is tested in resolution-ladder.test.ts)
    });

    it('should apply PROTECTING_ALLY bonus for test_protective_combat', async () => {
      const gameState: GameState = {
        story_id: 'story-1',
        player_id: 'player-1',
        tier1_mechanical: {
          entities: {
            'player-1': {
              id: 'player-1',
              properties: { name: 'Player' },
              stats: { root_force: 50 },
            },
            'guard-1': {
              id: 'guard-1',
              properties: {
                name: 'Guard',
                combat_prowess: 50,
                hp: 100,
              },
            },
          },
        },
        tier0_narrative: {},
      } as any;

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

      const actionsMap = {
        resolve_clash: {
          damage: 10,
        },
      };

      // Mock a moderate roll
      vi.spyOn(Math, 'random').mockReturnValue(0.5); // Roll 51
      
      const result = await engineService.execute(intent, gameState, actionsMap);
      
      // With PROTECTING_ALLY +10 and defensive -5, target should be ~55
      // Roll 51 should succeed
      expect(result.success).toBe(true);
      // Verify the breakdown is in the summary
      expect(result.outcome_summary).toContain('T2:10'); // Tier 2 situational modifier (+10)
      expect(result.outcome_summary).toContain('T4:-5'); // Tier 4 tactic modifier (-5)
    });
  });

  describe('Elite Guard vs Peasant Scenario', () => {
    it('should heavily penalize Peasant attacking Elite Guard', async () => {
      const gameState: GameState = {
        story_id: 'story-1',
        player_id: 'peasant-1',
        tier1_mechanical: {
          entities: {
            'peasant-1': {
              id: 'peasant-1',
              properties: { name: 'Peasant' },
              stats: { root_force: 30 },
            },
            'guard-1': {
              id: 'guard-1',
              properties: {
                name: 'Elite Guard',
                occupation_tags: ['Combat'],
                combat_prowess: 75,
                hp: 100,
              },
            },
          },
        },
        tier0_narrative: {},
      } as any;

      const intent: Mas1Intent = {
        trigger_id: 'combat_action',
        target_ids: ['guard-1'],
        parameters: {
          verb: 'attack',
          skill_id: 'root_force',
        },
        duration_tag: 'moment',
        original_text: 'I attack the elite guard',
      };

      const actionsMap = {
        resolve_clash: {
          damage: 10,
        },
      };

      // Mock a moderate roll (should still fail due to heavy penalty)
      vi.spyOn(Math, 'random').mockReturnValue(0.5); // Roll 51
      
      const result = await engineService.execute(intent, gameState, actionsMap);
      
      // With skill 30 and modifier -30, target is 0 (clamped to 1)
      // Roll 51 > target 1, so it should fail
      expect(result.success).toBe(false);
      expect(result.outcome_summary).toContain('Elite Guard');
      expect(result.outcome_summary).toContain('fail');
      
      // No deltas should be applied
      expect(Object.keys(result.numeric_deltas)).toHaveLength(0);
    });
  });
});
