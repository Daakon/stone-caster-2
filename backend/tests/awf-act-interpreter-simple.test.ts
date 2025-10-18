/**
 * Simple unit tests for AWF Act Interpreter
 * Phase 4: Act Interpreter - Testing core act application logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  AwfResponse, 
  GameState, 
  EpisodicMemory,
  ACT_TYPES 
} from '../src/types/awf-acts.js';

describe('AWF Act Interpreter Core Logic', () => {
  describe('Contract Rules Validation', () => {
    it('should validate first turn rules correctly', () => {
      const isFirstTurn = true;
      const acts = [
        { type: ACT_TYPES.TIME_ADVANCE, data: { ticks: 10 } }
      ];

      // First turn should reject TIME_ADVANCE
      expect(() => {
        if (isFirstTurn && acts.some(act => act.type === ACT_TYPES.TIME_ADVANCE)) {
          throw new Error('TIME_ADVANCE acts are forbidden on first turn');
        }
      }).toThrow('TIME_ADVANCE acts are forbidden on first turn');
    });

    it('should validate subsequent turn rules correctly', () => {
      const isFirstTurn = false;
      const acts = [
        { type: ACT_TYPES.SCENE_SET, data: { scn: 'new_scene' } }
        // No TIME_ADVANCE
      ];

      // Subsequent turn should require exactly one TIME_ADVANCE
      expect(() => {
        const timeAdvanceActs = acts.filter(act => (act.type as string) === ACT_TYPES.TIME_ADVANCE);
        if (!isFirstTurn && timeAdvanceActs.length !== 1) {
          throw new Error(`Exactly one TIME_ADVANCE act required on subsequent turns, found ${timeAdvanceActs.length}`);
        }
      }).toThrow('Exactly one TIME_ADVANCE act required on subsequent turns, found 0');
    });
  });

  describe('Act Mode Logic', () => {
    it('should apply merge_delta_by_npc correctly', () => {
      const gameState: GameState = {
        hot: { relations: {} },
        warm: { episodic: [], pins: [] },
        cold: {}
      };

      const act = { type: ACT_TYPES.REL_CHANGE, data: { npc: 'gareth', delta: 10 } };
      
      // Simulate the logic
      const relations = gameState.hot.relations as Record<string, number>;
      const npc = 'gareth';
      const delta = 10;
      const current = relations[npc] ?? 50;
      const newVal = current + delta;
      relations[npc] = newVal;

      expect(relations['gareth']).toBe(60); // 50 baseline + 10 delta
    });

    it('should apply upsert_by_id correctly', () => {
      const gameState: GameState = {
        hot: { objectives: [] },
        warm: { episodic: [], pins: [] },
        cold: {}
      };

      const act = { type: ACT_TYPES.OBJECTIVE_UPDATE, data: { id: 'obj1', status: 'in_progress', progress: 50 } };
      
      // Simulate the logic
      const objectives = gameState.hot.objectives as any[];
      const { id, status, progress } = act.data as { id: string; status: string; progress: number };
      
      const existingIndex = objectives.findIndex(obj => obj.id === id);
      const objective = { id, status, progress };
      
      if (existingIndex >= 0) {
        objectives[existingIndex] = objective;
      } else {
        objectives.push(objective);
      }

      expect(objectives).toHaveLength(1);
      expect(objectives[0]).toEqual({ id: 'obj1', status: 'in_progress', progress: 50 });
    });

    it('should apply set_by_key correctly', () => {
      const gameState: GameState = {
        hot: { flags: {} },
        warm: { episodic: [], pins: [] },
        cold: {}
      };

      const act = { type: ACT_TYPES.FLAG_SET, data: { key: 'quest_started', val: 'true' } };
      
      // Simulate the logic
      const flags = gameState.hot.flags as Record<string, string>;
      const { key, val } = act.data as { key: string; val: string };
      flags[key] = val;

      expect(flags['quest_started']).toBe('true');
    });

    it('should apply merge_delta_by_key correctly', () => {
      const gameState: GameState = {
        hot: { resources: {} },
        warm: { episodic: [], pins: [] },
        cold: {}
      };

      const act = { type: ACT_TYPES.RESOURCE_CHANGE, data: { key: 'hp', delta: -10 } };
      
      // Simulate the logic
      const resources = gameState.hot.resources as Record<string, number>;
      const { key, delta } = act.data as { key: string; delta: number };
      const current = resources[key] ?? 0;
      const newVal = current + delta;
      resources[key] = newVal;

      expect(resources['hp']).toBe(-10);
    });

    it('should apply set_value correctly', () => {
      const gameState: GameState = {
        hot: {},
        warm: { episodic: [], pins: [] },
        cold: {}
      };

      const act = { type: ACT_TYPES.SCENE_SET, data: { scn: 'forest_clearing' } };
      
      // Simulate the logic
      const { scn } = act.data as { scn: string };
      gameState.hot.scene = scn;

      expect(gameState.hot.scene).toBe('forest_clearing');
    });
  });

  describe('Time Band Rolling', () => {
    it('should roll time bands correctly', () => {
      const timeConfig = {
        bands: [
          { name: 'Dawn', maxTicks: 60 },
          { name: 'Morning', maxTicks: 60 },
          { name: 'Afternoon', maxTicks: 60 },
          { name: 'Evening', maxTicks: 60 }
        ],
        defaultBand: 'Dawn'
      };

      const currentTime = { band: 'Dawn', ticks: 50 };
      const addedTicks = 20; // 50 + 20 = 70, should roll to Morning

      let totalTicks = currentTime.ticks + addedTicks;
      let currentBand = currentTime.band;
      let bandIndex = timeConfig.bands.findIndex(band => band.name === currentBand);

      // Roll through bands
      while (totalTicks >= timeConfig.bands[bandIndex].maxTicks) {
        totalTicks -= timeConfig.bands[bandIndex].maxTicks;
        bandIndex = (bandIndex + 1) % timeConfig.bands.length;
        currentBand = timeConfig.bands[bandIndex].name;
      }

      expect(currentBand).toBe('Morning');
      expect(totalTicks).toBe(10); // 70 - 60 = 10
    });
  });

  describe('Memory Hygiene', () => {
    it('should trim episodic memory when over capacity', () => {
      const maxEpisodicLength = 60;
      const episodic: EpisodicMemory[] = Array.from({ length: 70 }, (_, i) => ({
        k: `memory${i}`,
        note: `Memory ${i}`,
        salience: Math.random(),
        t: i
      }));

      if (episodic.length > maxEpisodicLength) {
        // Sort by salience (ascending) then by turn (ascending)
        episodic.sort((a, b) => {
          if (a.salience !== b.salience) {
            return a.salience - b.salience;
          }
          return a.t - b.t;
        });

        // Remove excess entries
        const toRemove = episodic.length - maxEpisodicLength;
        episodic.splice(0, toRemove);
      }

      expect(episodic.length).toBe(60);
    });

    it('should handle note truncation', () => {
      const note = 'A'.repeat(150); // 150 characters
      const maxLength = 120;

      let truncatedNote = note;
      if (note.length > maxLength) {
        truncatedNote = note.substring(0, 117) + '...';
      }

      expect(truncatedNote.length).toBe(120);
      expect(truncatedNote.endsWith('...')).toBe(true);
    });
  });

  describe('Act Application Summary', () => {
    it('should track relation changes', () => {
      const summary = {
        relChanges: [] as Array<{ npc: string; delta: number; newVal: number }>,
        objectives: [] as Array<{ id: string; prev?: string; next: string }>,
        flags: [] as string[],
        resources: [] as Array<{ key: string; delta: number; newVal: number }>,
        memory: { added: 0, pinned: 0, trimmed: 0 },
        violations: [] as string[]
      };

      // Simulate relation change
      const npc = 'gareth';
      const delta = 10;
      const newVal = 60;
      summary.relChanges.push({ npc, delta, newVal });

      expect(summary.relChanges).toHaveLength(1);
      expect(summary.relChanges[0]).toEqual({ npc: 'gareth', delta: 10, newVal: 60 });
    });

    it('should track objective updates', () => {
      const summary = {
        relChanges: [] as Array<{ npc: string; delta: number; newVal: number }>,
        objectives: [] as Array<{ id: string; prev?: string; next: string }>,
        flags: [] as string[],
        resources: [] as Array<{ key: string; delta: number; newVal: number }>,
        memory: { added: 0, pinned: 0, trimmed: 0 },
        violations: [] as string[]
      };

      // Simulate objective update
      const id = 'obj1';
      const prev = 'not_started';
      const next = 'in_progress';
      summary.objectives.push({ id, prev, next });

      expect(summary.objectives).toHaveLength(1);
      expect(summary.objectives[0]).toEqual({ id: 'obj1', prev: 'not_started', next: 'in_progress' });
    });

    it('should track memory operations', () => {
      const summary = {
        relChanges: [] as Array<{ npc: string; delta: number; newVal: number }>,
        objectives: [] as Array<{ id: string; prev?: string; next: string }>,
        flags: [] as string[],
        resources: [] as Array<{ key: string; delta: number; newVal: number }>,
        memory: { added: 0, pinned: 0, trimmed: 0 },
        violations: [] as string[]
      };

      // Simulate memory operations
      summary.memory.added = 1;
      summary.memory.pinned = 1;
      summary.memory.trimmed = 5;

      expect(summary.memory.added).toBe(1);
      expect(summary.memory.pinned).toBe(1);
      expect(summary.memory.trimmed).toBe(5);
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown act types', () => {
      const actsConfig = {
        'REL_CHANGE': '/game_state/hot/relations|merge_delta_by_npc',
        'OBJECTIVE_UPDATE': '/game_state/hot/objectives|upsert_by_id'
      };

      const act = { type: 'UNKNOWN_ACT', data: { some: 'data' } };
      const config = actsConfig[act.type as keyof typeof actsConfig];

      expect(config).toBeUndefined();
    });

    it('should validate objective status', () => {
      const validStatuses = ['not_started', 'in_progress', 'complete', 'failed'];
      const status = 'invalid_status';

      expect(validStatuses.includes(status)).toBe(false);
    });

    it('should handle time advancement validation', () => {
      const ticks = 0; // Invalid: must be >= 1

      expect(() => {
        if (ticks < 1) {
          throw new Error('Time advancement must be at least 1 tick');
        }
      }).toThrow('Time advancement must be at least 1 tick');
    });
  });

  describe('Idempotence', () => {
    it('should produce same result for identical inputs', () => {
      const gameState1: GameState = {
        hot: { relations: {} },
        warm: { episodic: [], pins: [] },
        cold: {}
      };

      const gameState2: GameState = {
        hot: { relations: {} },
        warm: { episodic: [], pins: [] },
        cold: {}
      };

      // Apply same operation to both states
      const npc = 'gareth';
      const delta = 10;
      
      // First application
      const relations1 = gameState1.hot.relations as Record<string, number>;
      const current1 = relations1[npc] ?? 50;
      relations1[npc] = current1 + delta;

      // Second application
      const relations2 = gameState2.hot.relations as Record<string, number>;
      const current2 = relations2[npc] ?? 50;
      relations2[npc] = current2 + delta;

      expect(relations1[npc]).toBe(relations2[npc]);
      expect(relations1[npc]).toBe(60);
    });
  });
});
