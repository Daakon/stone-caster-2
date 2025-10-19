/**
 * Unit tests for AWF Act Interpreter
 * Phase 4: Act Interpreter - Testing act application logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActInterpreter } from '../src/interpreters/awf-act-interpreter.js';
import { applyActs } from '../src/interpreters/apply-acts.js';
import { 
  AwfResponse, 
  GameState, 
  EpisodicMemory,
  ACT_TYPES 
} from '../src/types/awf-acts.js';

// Mock Supabase client
const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    update: vi.fn(() => Promise.resolve({ data: null, error: null })),
  })),
} as any;

// Mock repositories
const mockSession = {
  id: 'session-123',
  player_id: 'player-456',
  world_ref: 'world.mystika',
  adventure_ref: 'adv.whispercross',
  turn_id: 1,
  is_first_turn: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockGameState: GameState = {
  hot: {
    scene: 'town_square',
    time: { band: 'Dawn', ticks: 0 },
    relations: {},
    objectives: [],
    flags: {},
    resources: {}
  },
  warm: {
    episodic: [],
    pins: []
  },
  cold: {}
};

const mockInjectionMap = {
  id: 'default',
  doc: {
    build: {},
    acts: {
      'REL_CHANGE': '/game_state/hot/relations|merge_delta_by_npc',
      'OBJECTIVE_UPDATE': '/game_state/hot/objectives|upsert_by_id',
      'FLAG_SET': '/game_state/hot/flags|set_by_key',
      'RESOURCE_CHANGE': '/game_state/hot/resources|merge_delta_by_key',
      'SCENE_SET': '/game_state/hot/scene|set_value',
      'TIME_ADVANCE': '/game_state/hot/time|add_number',
      'MEMORY_ADD': '/game_state/warm/episodic|append_unique_by_key',
      'PIN_ADD': '/game_state/warm/pins|add_unique',
      'MEMORY_TAG': '/game_state/warm/episodic|tag_by_key',
      'MEMORY_REMOVE': '/game_state/warm/episodic|remove_by_key',
    }
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockWorld = {
  id: 'world.mystika',
  version: 'v1',
  doc: {
    name: 'Mystika World',
    time: {
      bands: [
        { name: 'Dawn', maxTicks: 60, next: 'Morning' },
        { name: 'Morning', maxTicks: 60, next: 'Afternoon' },
        { name: 'Afternoon', maxTicks: 60, next: 'Evening' },
        { name: 'Evening', maxTicks: 60, next: 'Dawn' }
      ],
      defaultBand: 'Dawn'
    }
  },
  hash: 'worldhash',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('AWF Act Interpreter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockSupabase.rpc
      .mockResolvedValueOnce({ data: null, error: null }) // begin_transaction
      .mockResolvedValueOnce({ data: null, error: null }) // commit_transaction
      .mockResolvedValue({ data: null, error: null }); // other RPC calls

    mockSupabase.from().select().eq().single
      .mockResolvedValueOnce({ data: mockSession, error: null }) // Session
      .mockResolvedValueOnce({ data: mockGameState, error: null }) // Game state
      .mockResolvedValueOnce({ data: mockInjectionMap, error: null }) // Injection map
      .mockResolvedValueOnce({ data: mockWorld, error: null }); // World
  });

  describe('Contract Rules Validation', () => {
    it('should reject TIME_ADVANCE on first turn', async () => {
      const awf: AwfResponse = {
        scn: 'test_scene',
        txt: 'Test text',
        acts: [
          { type: ACT_TYPES.TIME_ADVANCE, data: { ticks: 10 } }
        ]
      };

      const interpreter = new ActInterpreter(mockSupabase);
      
      await expect(interpreter.applyActs({
        sessionId: 'session-123',
        awf
      })).rejects.toThrow('TIME_ADVANCE acts are forbidden on first turn');
    });

    it('should require exactly one TIME_ADVANCE on subsequent turns', async () => {
      const secondTurnSession = { ...mockSession, turn_id: 2, is_first_turn: false };
      
      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({ data: secondTurnSession, error: null }) // Session
        .mockResolvedValueOnce({ data: mockGameState, error: null }) // Game state
        .mockResolvedValueOnce({ data: mockInjectionMap, error: null }) // Injection map
        .mockResolvedValueOnce({ data: mockWorld, error: null }); // World

      const awf: AwfResponse = {
        scn: 'test_scene',
        txt: 'Test text',
        acts: [
          { type: ACT_TYPES.SCENE_SET, data: { scn: 'new_scene' } }
          // No TIME_ADVANCE
        ]
      };

      const interpreter = new ActInterpreter(mockSupabase);
      
      await expect(interpreter.applyActs({
        sessionId: 'session-123',
        awf
      })).rejects.toThrow('Exactly one TIME_ADVANCE act required on subsequent turns, found 0');
    });

    it('should accept valid first turn acts', async () => {
      const awf: AwfResponse = {
        scn: 'test_scene',
        txt: 'Test text',
        acts: [
          { type: ACT_TYPES.SCENE_SET, data: { scn: 'new_scene' } },
          { type: ACT_TYPES.MEMORY_ADD, data: { k: 'memory1', note: 'Test memory', salience: 0.8 } }
        ]
      };

      const interpreter = new ActInterpreter(mockSupabase);
      
      const result = await interpreter.applyActs({
        sessionId: 'session-123',
        awf
      });

      expect(result).toBeDefined();
      expect(result.summary.scene).toBe('new_scene');
      expect(result.summary.memory.added).toBe(1);
    });
  });

  describe('Act Mode Application', () => {
    it('should apply merge_delta_by_npc for relation changes', async () => {
      const awf: AwfResponse = {
        scn: 'test_scene',
        txt: 'Test text',
        acts: [
          { type: ACT_TYPES.REL_CHANGE, data: { npc: 'gareth', delta: 10 } }
        ]
      };

      const interpreter = new ActInterpreter(mockSupabase);
      const result = await interpreter.applyActs({
        sessionId: 'session-123',
        awf
      });

      expect(result.summary.relChanges).toHaveLength(1);
      expect(result.summary.relChanges[0]).toEqual({
        npc: 'gareth',
        delta: 10,
        newVal: 60 // 50 baseline + 10 delta
      });
    });

    it('should apply upsert_by_id for objectives', async () => {
      const awf: AwfResponse = {
        scn: 'test_scene',
        txt: 'Test text',
        acts: [
          { type: ACT_TYPES.OBJECTIVE_UPDATE, data: { id: 'obj1', status: 'in_progress', progress: 50 } }
        ]
      };

      const interpreter = new ActInterpreter(mockSupabase);
      const result = await interpreter.applyActs({
        sessionId: 'session-123',
        awf
      });

      expect(result.summary.objectives).toHaveLength(1);
      expect(result.summary.objectives[0]).toEqual({
        id: 'obj1',
        prev: undefined,
        next: 'in_progress'
      });
    });

    it('should apply set_by_key for flags', async () => {
      const awf: AwfResponse = {
        scn: 'test_scene',
        txt: 'Test text',
        acts: [
          { type: ACT_TYPES.FLAG_SET, data: { key: 'quest_started', val: 'true' } }
        ]
      };

      const interpreter = new ActInterpreter(mockSupabase);
      const result = await interpreter.applyActs({
        sessionId: 'session-123',
        awf
      });

      expect(result.summary.flags).toContain('quest_started');
    });

    it('should apply merge_delta_by_key for resources', async () => {
      const awf: AwfResponse = {
        scn: 'test_scene',
        txt: 'Test text',
        acts: [
          { type: ACT_TYPES.RESOURCE_CHANGE, data: { key: 'hp', delta: -10 } }
        ]
      };

      const interpreter = new ActInterpreter(mockSupabase);
      const result = await interpreter.applyActs({
        sessionId: 'session-123',
        awf
      });

      expect(result.summary.resources).toHaveLength(1);
      expect(result.summary.resources[0]).toEqual({
        key: 'hp',
        delta: -10,
        newVal: -10 // 0 + (-10)
      });
    });

    it('should apply set_value for scene setting', async () => {
      const awf: AwfResponse = {
        scn: 'test_scene',
        txt: 'Test text',
        acts: [
          { type: ACT_TYPES.SCENE_SET, data: { scn: 'forest_clearing' } }
        ]
      };

      const interpreter = new ActInterpreter(mockSupabase);
      const result = await interpreter.applyActs({
        sessionId: 'session-123',
        awf
      });

      expect(result.summary.scene).toBe('forest_clearing');
    });

    it('should apply add_number for time advancement', async () => {
      const secondTurnSession = { ...mockSession, turn_id: 2, is_first_turn: false };
      
      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({ data: secondTurnSession, error: null }) // Session
        .mockResolvedValueOnce({ data: mockGameState, error: null }) // Game state
        .mockResolvedValueOnce({ data: mockInjectionMap, error: null }) // Injection map
        .mockResolvedValueOnce({ data: mockWorld, error: null }); // World

      const awf: AwfResponse = {
        scn: 'test_scene',
        txt: 'Test text',
        acts: [
          { type: ACT_TYPES.TIME_ADVANCE, data: { ticks: 30 } }
        ]
      };

      const interpreter = new ActInterpreter(mockSupabase);
      const result = await interpreter.applyActs({
        sessionId: 'session-123',
        awf
      });

      expect(result.summary.time).toBeDefined();
      expect(result.summary.time?.added).toBe(30);
    });

    it('should apply append_unique_by_key for episodic memory', async () => {
      const awf: AwfResponse = {
        scn: 'test_scene',
        txt: 'Test text',
        acts: [
          { type: ACT_TYPES.MEMORY_ADD, data: { k: 'memory1', note: 'Met the elder', salience: 0.8, tags: ['npc', 'elder'] } }
        ]
      };

      const interpreter = new ActInterpreter(mockSupabase);
      const result = await interpreter.applyActs({
        sessionId: 'session-123',
        awf
      });

      expect(result.summary.memory.added).toBe(1);
    });

    it('should apply add_unique for pins', async () => {
      const awf: AwfResponse = {
        scn: 'test_scene',
        txt: 'Test text',
        acts: [
          { type: ACT_TYPES.PIN_ADD, data: { key: 'important_location' } }
        ]
      };

      const interpreter = new ActInterpreter(mockSupabase);
      const result = await interpreter.applyActs({
        sessionId: 'session-123',
        awf
      });

      expect(result.summary.memory.pinned).toBe(1);
    });
  });

  describe('Time Band Rolling', () => {
    it('should roll time bands correctly', async () => {
      const secondTurnSession = { ...mockSession, turn_id: 2, is_first_turn: false };
      const gameStateWithTime = {
        ...mockGameState,
        hot: {
          ...mockGameState.hot,
          time: { band: 'Dawn', ticks: 50 }
        }
      };
      
      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({ data: secondTurnSession, error: null }) // Session
        .mockResolvedValueOnce({ data: gameStateWithTime, error: null }) // Game state
        .mockResolvedValueOnce({ data: mockInjectionMap, error: null }) // Injection map
        .mockResolvedValueOnce({ data: mockWorld, error: null }); // World

      const awf: AwfResponse = {
        scn: 'test_scene',
        txt: 'Test text',
        acts: [
          { type: ACT_TYPES.TIME_ADVANCE, data: { ticks: 20 } } // 50 + 20 = 70, should roll to Morning
        ]
      };

      const interpreter = new ActInterpreter(mockSupabase);
      const result = await interpreter.applyActs({
        sessionId: 'session-123',
        awf
      });

      expect(result.summary.time).toBeDefined();
      expect(result.summary.time?.prev.band).toBe('Dawn');
      expect(result.summary.time?.prev.ticks).toBe(50);
      expect(result.summary.time?.next.band).toBe('Morning');
      expect(result.summary.time?.next.ticks).toBe(10); // 70 - 60 = 10
    });
  });

  describe('Memory Hygiene', () => {
    it('should trim episodic memory when over capacity', async () => {
      // Create game state with many episodic memories
      const gameStateWithManyMemories = {
        ...mockGameState,
        warm: {
          episodic: Array.from({ length: 70 }, (_, i) => ({
            k: `memory${i}`,
            note: `Memory ${i}`,
            salience: Math.random(),
            t: i
          })) as EpisodicMemory[],
          pins: []
        }
      };

      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({ data: mockSession, error: null }) // Session
        .mockResolvedValueOnce({ data: gameStateWithManyMemories, error: null }) // Game state
        .mockResolvedValueOnce({ data: mockInjectionMap, error: null }) // Injection map
        .mockResolvedValueOnce({ data: mockWorld, error: null }); // World

      const awf: AwfResponse = {
        scn: 'test_scene',
        txt: 'Test text',
        acts: [
          { type: ACT_TYPES.MEMORY_ADD, data: { k: 'new_memory', note: 'New memory', salience: 0.9 } }
        ]
      };

      const interpreter = new ActInterpreter(mockSupabase);
      const result = await interpreter.applyActs({
        sessionId: 'session-123',
        awf
      });

      expect(result.summary.memory.trimmed).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown act types', async () => {
      const awf: AwfResponse = {
        scn: 'test_scene',
        txt: 'Test text',
        acts: [
          { type: 'UNKNOWN_ACT', data: { some: 'data' } }
        ]
      };

      const interpreter = new ActInterpreter(mockSupabase);
      const result = await interpreter.applyActs({
        sessionId: 'session-123',
        awf
      });

      expect(result.summary.violations).toContain('Unknown act type: UNKNOWN_ACT');
    });

    it('should handle invalid objective status', async () => {
      const awf: AwfResponse = {
        scn: 'test_scene',
        txt: 'Test text',
        acts: [
          { type: ACT_TYPES.OBJECTIVE_UPDATE, data: { id: 'obj1', status: 'invalid_status' } }
        ]
      };

      const interpreter = new ActInterpreter(mockSupabase);
      const result = await interpreter.applyActs({
        sessionId: 'session-123',
        awf
      });

      expect(result.summary.violations).toContain('Invalid objective status: invalid_status');
    });
  });

  describe('Idempotence', () => {
    it('should produce same result when applying same acts twice', async () => {
      const awf: AwfResponse = {
        scn: 'test_scene',
        txt: 'Test text',
        acts: [
          { type: ACT_TYPES.REL_CHANGE, data: { npc: 'gareth', delta: 10 } },
          { type: ACT_TYPES.MEMORY_ADD, data: { k: 'memory1', note: 'Test memory', salience: 0.8 } }
        ]
      };

      const interpreter = new ActInterpreter(mockSupabase);
      
      // Apply first time
      const result1 = await interpreter.applyActs({
        sessionId: 'session-123',
        awf
      });

      // Reset mocks for second application
      vi.clearAllMocks();
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: null, error: null }) // begin_transaction
        .mockResolvedValueOnce({ data: null, error: null }) // commit_transaction
        .mockResolvedValue({ data: null, error: null }); // other RPC calls

      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({ data: mockSession, error: null }) // Session
        .mockResolvedValueOnce({ data: mockGameState, error: null }) // Game state
        .mockResolvedValueOnce({ data: mockInjectionMap, error: null }) // Injection map
        .mockResolvedValueOnce({ data: mockWorld, error: null }); // World

      // Apply second time
      const result2 = await interpreter.applyActs({
        sessionId: 'session-123',
        awf
      });

      // Results should be identical
      expect(result1.summary.relChanges).toEqual(result2.summary.relChanges);
      expect(result1.summary.memory.added).toBe(result2.summary.memory.added);
    });
  });

  describe('Transaction Rollback', () => {
    it('should rollback on error', async () => {
      // Mock an error during session update
      mockSupabase.from().update.mockRejectedValueOnce(new Error('Database error'));

      const awf: AwfResponse = {
        scn: 'test_scene',
        txt: 'Test text',
        acts: [
          { type: ACT_TYPES.SCENE_SET, data: { scn: 'new_scene' } }
        ]
      };

      const interpreter = new ActInterpreter(mockSupabase);
      
      await expect(interpreter.applyActs({
        sessionId: 'session-123',
        awf
      })).rejects.toThrow('Database error');

      // Should have called rollback
      expect(mockSupabase.rpc).toHaveBeenCalledWith('rollback_transaction');
    });
  });
});


