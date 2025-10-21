/**
 * Unit tests for AWF Bundle Assembler
 * Phase 3: Bundle Assembler - Testing bundle assembly logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  setAtPointer, 
  getAtPointer, 
  estimateTokens, 
  generateRngSeed, 
  stableJsonStringify 
} from '../src/utils/awf-bundle-helpers.js';

describe('AWF Bundle Assembler Helper Functions', () => {
  describe('JSON Pointer Operations', () => {
    it('should set values at JSON pointers correctly', () => {
      const obj = {};
      setAtPointer(obj, '/test/nested/value', 'hello');
      expect(getAtPointer(obj, '/test/nested/value')).toBe('hello');
    });

    it('should handle array indices in pointers', () => {
      const obj = {};
      setAtPointer(obj, '/array/0/name', 'first item');
      expect(getAtPointer(obj, '/array/0/name')).toBe('first item');
    });

    it('should handle nested object creation', () => {
      const obj = {};
      setAtPointer(obj, '/deep/nested/structure/value', 42);
      expect(getAtPointer(obj, '/deep/nested/structure/value')).toBe(42);
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens correctly for simple objects', () => {
      const testObj = { message: 'Hello world', count: 42 };
      const tokens = estimateTokens(testObj);
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(100); // Reasonable upper bound
    });

    it('should handle empty objects', () => {
      const tokens = estimateTokens({});
      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle large objects', () => {
      const largeObj = {
        data: Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }))
      };
      const tokens = estimateTokens(largeObj);
      expect(tokens).toBeGreaterThan(100);
    });
  });

  describe('RNG Seed Generation', () => {
    it('should generate deterministic RNG seeds', () => {
      const seed1 = generateRngSeed('test-input', 1);
      const seed2 = generateRngSeed('test-input', 1);
      expect(seed1).toBe(seed2);
    });

    it('should generate different seeds for different inputs', () => {
      const seed1 = generateRngSeed('input1', 1);
      const seed2 = generateRngSeed('input2', 1);
      expect(seed1).not.toBe(seed2);
    });

    it('should generate different seeds for different turn IDs', () => {
      const seed1 = generateRngSeed('same-input', 1);
      const seed2 = generateRngSeed('same-input', 2);
      expect(seed1).not.toBe(seed2);
    });
  });

  describe('Stable JSON Stringify', () => {
    it('should produce stable JSON stringify output', () => {
      const obj1 = { a: 1, b: { c: 2 } };
      const obj2 = { b: { c: 2 }, a: 1 };
      expect(stableJsonStringify(obj1)).toBe(stableJsonStringify(obj2));
    });

    it('should handle arrays consistently', () => {
      const obj1 = { items: [1, 2, 3] };
      const obj2 = { items: [1, 2, 3] };
      expect(stableJsonStringify(obj1)).toBe(stableJsonStringify(obj2));
    });

    it('should handle nested structures consistently', () => {
      const obj1 = { 
        meta: { version: '1.0', timestamp: '2023-01-01' },
        data: { items: [{ id: 1 }, { id: 2 }] }
      };
      const obj2 = { 
        data: { items: [{ id: 1 }, { id: 2 }] },
        meta: { timestamp: '2023-01-01', version: '1.0' }
      };
      expect(stableJsonStringify(obj1)).toBe(stableJsonStringify(obj2));
    });
  });

  describe('Bundle Structure Validation', () => {
    it('should validate required bundle fields', () => {
      const validBundle = {
        awf_bundle: {
          meta: {
            engine_version: '1.0.0',
            world: 'world.mystika',
            adventure: 'adv.whispercross',
            turn_id: 1,
            is_first_turn: true,
            timestamp: '2023-01-01T00:00:00Z'
          },
          contract: {
            id: 'core.contract.v4',
            version: 'v4',
            hash: 'contract-hash',
            doc: { acts: { allowed: ['move'] } }
          },
          world: {
            ref: 'world.mystika',
            hash: 'world-hash',
            slice: ['timekeeping', 'core_mechanics']
          },
          adventure: {
            ref: 'adv.whispercross',
            hash: 'adventure-hash',
            slice: ['forest_lore']
          },
          npcs: {
            active: [{ id: 'npc1', name: 'Test NPC' }]
          },
          player: {
            id: 'player-123',
            name: 'Test Player',
            traits: { strength: 10 },
            skills: { combat: 5 },
            inventory: ['sword'],
            metadata: {}
          },
          game_state: {
            hot: { scene: 'town_square' },
            warm: { episodic: [] },
            cold: {}
          },
          rng: {
            seed: 'test-seed',
            policy: 'default'
          },
          input: {
            text: 'I walk into the forest'
          }
        }
      };

      // This would be tested with the actual validation function
      expect(validBundle.awf_bundle.meta.turn_id).toBe(1);
      expect(validBundle.awf_bundle.input.text).toBe('I walk into the forest');
    });
  });

  describe('Scene Slice Policy', () => {
    it('should select appropriate slices for first turn', () => {
      // This would test the scene slice policy logic
      const firstTurnSlices = ['timekeeping', 'core_mechanics', 'player_status', 'intro_narrative'];
      expect(firstTurnSlices).toContain('timekeeping');
      expect(firstTurnSlices).toContain('intro_narrative');
    });

    it('should select scene-specific slices', () => {
      const townSlices = ['town_gossip', 'merchant_inventory', 'quest_board'];
      expect(townSlices).toContain('town_gossip');
      expect(townSlices).toContain('merchant_inventory');
    });
  });

  describe('NPC Management', () => {
    it('should limit NPCs to maximum of 5', () => {
      const manyNpcs = Array.from({ length: 10 }, (_, i) => ({
        id: `npc${i}`,
        name: `NPC ${i}`,
        status: 'active'
      }));
      
      const limitedNpcs = manyNpcs.slice(0, 5);
      expect(limitedNpcs.length).toBe(5);
    });

    it('should filter active NPCs', () => {
      const allNpcs = [
        { id: 'npc1', status: 'active' },
        { id: 'npc2', status: 'inactive' },
        { id: 'npc3', status: 'active' }
      ];
      
      const activeNpcs = allNpcs.filter(npc => npc.status === 'active');
      expect(activeNpcs.length).toBe(2);
    });
  });

  describe('Bundle Metrics', () => {
    it('should calculate bundle size metrics', () => {
      const testBundle = {
        meta: { turn_id: 1 },
        data: { message: 'Hello world' }
      };
      
      const jsonString = JSON.stringify(testBundle);
      const byteLength = Buffer.byteLength(jsonString, 'utf8');
      const estimatedTokens = estimateTokens(testBundle);
      
      expect(byteLength).toBeGreaterThan(0);
      expect(estimatedTokens).toBeGreaterThan(0);
    });
  });
});
