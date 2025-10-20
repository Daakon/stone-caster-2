import { describe, it, expect } from 'vitest';
import { executeInjectionMap, createInjectionContext } from '../src/assemblers/injection-map-executor.js';
import { InjectionMapDocV1 } from '../src/types/awf-injection-map.js';

describe('Injection Map Executor', () => {
  const mockContext = {
    world: {
      id: 'world1',
      name: 'Mystika',
      description: 'A magical world of wonder'
    },
    adventure: {
      id: 'adv1',
      name: 'The Quest Begins',
      synopsis: 'An epic adventure awaits'
    },
    scenario: {
      name: 'Starting Point',
      start_scene: 'tavern.inn'
    },
    npcs: [
      { id: 'npc1', name: 'Gandalf' },
      { id: 'npc2', name: 'Aragorn' }
    ],
    contract: {
      id: 'contract1',
      name: 'Core Contract'
    },
    player: {
      id: 'player1',
      name: 'Hero'
    },
    game: {
      turn_count: 1
    },
    session: {
      id: 'session1'
    }
  };

  describe('executeInjectionMap', () => {
    it('should execute basic injection rules', () => {
      const injectionMap: InjectionMapDocV1 = {
        rules: [
          {
            from: '/world/name',
            to: '/bundle/world/name'
          },
          {
            from: '/adventure/name',
            to: '/bundle/adventure/name'
          }
        ]
      };

      const targetBundle = {};
      const result = executeInjectionMap(injectionMap, mockContext, targetBundle);

      expect(result.success).toBe(true);
      expect(result.appliedRules).toBe(2);
      expect(result.skippedRules).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(targetBundle).toEqual({
        bundle: {
          world: { name: 'Mystika' },
          adventure: { name: 'The Quest Begins' }
        }
      });
    });

    it('should handle skipIfEmpty option', () => {
      const injectionMap: InjectionMapDocV1 = {
        rules: [
          {
            from: '/world/missing_field',
            to: '/bundle/world/missing_field',
            skipIfEmpty: true
          },
          {
            from: '/world/name',
            to: '/bundle/world/name',
            skipIfEmpty: true
          }
        ]
      };

      const targetBundle = {};
      const result = executeInjectionMap(injectionMap, mockContext, targetBundle);

      expect(result.success).toBe(true);
      expect(result.appliedRules).toBe(1);
      expect(result.skippedRules).toBe(1);
      expect(targetBundle).toEqual({
        bundle: {
          world: { name: 'Mystika' }
        }
      });
    });

    it('should handle fallback values', () => {
      const injectionMap: InjectionMapDocV1 = {
        rules: [
          {
            from: '/world/missing_field',
            to: '/bundle/world/fallback_value',
            fallback: { ifMissing: 'Default World' }
          }
        ]
      };

      const targetBundle = {};
      const result = executeInjectionMap(injectionMap, mockContext, targetBundle);

      expect(result.success).toBe(true);
      expect(result.appliedRules).toBe(1);
      expect(result.skippedRules).toBe(0);
      expect(targetBundle).toEqual({
        bundle: {
          world: { fallback_value: 'Default World' }
        }
      });
    });

    it('should handle token limits', () => {
      const injectionMap: InjectionMapDocV1 = {
        rules: [
          {
            from: '/world/description',
            to: '/bundle/world/description',
            limit: { units: 'tokens', max: 2 } // Very low limit
          }
        ]
      };

      const targetBundle = {};
      const result = executeInjectionMap(injectionMap, mockContext, targetBundle);

      expect(result.success).toBe(true);
      expect(result.appliedRules).toBe(1);
      expect(result.skippedRules).toBe(0);
      // The description should be trimmed due to token limit
      expect(targetBundle).toEqual({
        bundle: {
          world: { description: 'A magica' } // Trimmed to fit token limit (2 tokens)
        }
      });
    });

    it('should handle count limits', () => {
      const injectionMap: InjectionMapDocV1 = {
        rules: [
          {
            from: '/npcs',
            to: '/bundle/npcs',
            limit: { units: 'count', max: 1 }
          }
        ]
      };

      const targetBundle = {};
      const result = executeInjectionMap(injectionMap, mockContext, targetBundle);

      expect(result.success).toBe(true);
      expect(result.appliedRules).toBe(1);
      expect(result.skippedRules).toBe(0);
      expect(targetBundle).toEqual({
        bundle: {
          npcs: [{ id: 'npc1', name: 'Gandalf' }] // Only first NPC due to count limit
        }
      });
    });

    it('should handle complex nested paths', () => {
      const injectionMap: InjectionMapDocV1 = {
        rules: [
          {
            from: '/world/name',
            to: '/bundle/awf_bundle/world/name'
          },
          {
            from: '/adventure/name',
            to: '/bundle/awf_bundle/adventure/name'
          }
        ]
      };

      const targetBundle = {};
      const result = executeInjectionMap(injectionMap, mockContext, targetBundle);

      expect(result.success).toBe(true);
      expect(result.appliedRules).toBe(2);
      expect(targetBundle).toEqual({
        bundle: {
          awf_bundle: {
            world: { name: 'Mystika' },
            adventure: { name: 'The Quest Begins' }
          }
        }
      });
    });

    it('should handle empty injection map', () => {
      const injectionMap: InjectionMapDocV1 = {
        rules: []
      };

      const targetBundle = {};
      const result = executeInjectionMap(injectionMap, mockContext, targetBundle);

      expect(result.success).toBe(true);
      expect(result.appliedRules).toBe(0);
      expect(result.skippedRules).toBe(0);
      expect(targetBundle).toEqual({});
    });

    it('should handle rule execution errors gracefully', () => {
      const injectionMap: InjectionMapDocV1 = {
        rules: [
          {
            from: '/world/name',
            to: '/bundle/world/name'
          },
          {
            from: '/invalid/path',
            to: '/bundle/invalid'
          }
        ]
      };

      const targetBundle = {};
      const result = executeInjectionMap(injectionMap, mockContext, targetBundle);

      expect(result.success).toBe(true);
      expect(result.appliedRules).toBe(1);
      expect(result.skippedRules).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle context object references', () => {
      const injectionMap: InjectionMapDocV1 = {
        rules: [
          {
            from: '/world/name',
            to: '/bundle/world/name'
          },
          {
            from: '/adventure/name',
            to: '/bundle/adventure/name'
          }
        ]
      };

      const targetBundle = {};
      const result = executeInjectionMap(injectionMap, mockContext, targetBundle);

      expect(result.success).toBe(true);
      expect(result.appliedRules).toBe(2);
      expect(targetBundle).toEqual({
        bundle: {
          world: { name: 'Mystika' },
          adventure: { name: 'The Quest Begins' }
        }
      });
    });
  });

  describe('createInjectionContext', () => {
    it('should create injection context from data', () => {
      const data = {
        world: { id: 'world1', name: 'Test World' },
        adventure: { id: 'adv1', name: 'Test Adventure' },
        scenario: { name: 'Test Scenario' },
        npcs: [{ id: 'npc1', name: 'Test NPC' }],
        contract: { id: 'contract1', name: 'Test Contract' },
        player: { id: 'player1', name: 'Test Player' },
        game: { turn_count: 1 },
        session: { id: 'session1' }
      };

      const context = createInjectionContext(data);

      expect(context).toEqual(data);
      expect(context.world).toEqual(data.world);
      expect(context.adventure).toEqual(data.adventure);
      expect(context.scenario).toEqual(data.scenario);
      expect(context.npcs).toEqual(data.npcs);
      expect(context.contract).toEqual(data.contract);
      expect(context.player).toEqual(data.player);
      expect(context.game).toEqual(data.game);
      expect(context.session).toEqual(data.session);
    });
  });
});
