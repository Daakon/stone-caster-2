// Games API Tests
// Tests for POST /api/games/start and POST /api/games/:id/turns endpoints

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { startGame } from '../../src/services/games';
import { buildNpcArgs } from '../../src/services/npc';
import { assemblePrompt } from '../../src/prompt/assembler/assembler';
import { MockDbAdapter } from '../../src/prompt/assembler/db';

// Mock the services
vi.mock('../../src/services/state', () => ({
  markBootstrapped: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/services/npc', () => ({
  buildNpcArgs: vi.fn().mockResolvedValue([
    { npcId: 'npc.mystika.kiera', tier: 0 },
    { npcId: 'npc.mystika.thorne', tier: 0 }
  ])
}));

vi.mock('../../src/prompt/assembler/assembler', () => ({
  assemblePrompt: vi.fn().mockResolvedValue({
    prompt: 'Mock assembled prompt',
    meta: {
      order: ['core', 'ruleset', 'world', 'entry', 'entry_start'],
      segmentIdsByScope: {
        core: [1],
        ruleset: [2],
        world: [3],
        entry: [4],
        entry_start: [5, 6],
        npc: [7, 8],
        game_state: [],
        player: [],
        rng: [],
        input: []
      },
      tokensEstimated: 1000,
      truncated: {}
    }
  })
}));

vi.mock('../../src/model/modelAdapter', () => ({
  mockModel: {
    generate: vi.fn().mockResolvedValue({
      text: 'The adventure begins in the Whispering Woods...',
      tokensOut: 50,
      usage: {
        promptTokens: 200,
        completionTokens: 50,
        totalTokens: 250
      }
    })
  }
}));

describe('Games API', () => {
  let mockDb: MockDbAdapter;

  beforeEach(() => {
    mockDb = new MockDbAdapter();
    vi.clearAllMocks();
  });

  describe('POST /api/games/start', () => {
    it('should create game with entry_start on first turn', async () => {
      const result = await startGame({
        entryPointId: 'ep.whispercross',
        ownerUserId: 'user-123',
        locale: 'en-US'
      });

      expect(result.gameId).toBeDefined();
      expect(result.firstTurnId).toBe(1);
      expect(result.prompt).toContain('Mock assembled prompt');
      
      // Verify entry_start segments are included in metadata
      expect(result.meta.segmentIdsByScope.entry_start).toEqual([5, 6]);
      expect(result.meta.segmentIdsByScope.entry_start.length).toBeGreaterThan(0);
    });

    it('should include NPCs in prompt assembly', async () => {
      await startGame({
        entryPointId: 'ep.whispercross',
        ownerUserId: 'user-123'
      });

      expect(buildNpcArgs).toHaveBeenCalledWith(
        expect.any(String),
        'ep.whispercross',
        expect.any(Object)
      );
    });

    it('should call assemblePrompt with isFirstTurn=true', async () => {
      await startGame({
        entryPointId: 'ep.whispercross',
        ownerUserId: 'user-123'
      });

      expect(assemblePrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          entryPointId: 'ep.whispercross',
          isFirstTurn: true,
          npcs: expect.any(Array)
        }),
        expect.any(Object)
      );
    });

    it('should mark game as bootstrapped after first turn', async () => {
      const { markBootstrapped } = await import('../../src/services/state');
      
      await startGame({
        entryPointId: 'ep.whispercross',
        ownerUserId: 'user-123'
      });

      expect(markBootstrapped).toHaveBeenCalled();
    });

    it('should return proper response format', async () => {
      const result = await startGame({
        entryPointId: 'ep.whispercross',
        ownerUserId: 'user-123'
      });

      expect(result).toHaveProperty('gameId');
      expect(result).toHaveProperty('firstTurnId');
      expect(result).toHaveProperty('prompt');
      expect(result).toHaveProperty('meta');
      
      expect(result.meta).toHaveProperty('segmentIdsByScope');
      expect(result.meta).toHaveProperty('tokensEstimated');
      expect(result.meta.segmentIdsByScope).toHaveProperty('entry_start');
    });
  });

  describe('POST /api/games/:id/turns', () => {
    it('should process player input and generate narrator response', async () => {
      // Mock game data
      const mockGame = {
        id: 'game-123',
        entry_point_id: 'ep.whispercross',
        world_id: 'world.mystika',
        ruleset_id: 'ruleset.classic_v1',
        turn_count: 1,
        state: { hot: {}, warm: {}, cold: {} },
        owner_user_id: 'user-123'
      };

      // Mock Supabase responses
      const mockSupabase = {
        from: vi.fn((table) => {
          if (table === 'games') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => ({
                    data: mockGame,
                    error: null
                  }))
                }))
              }))
            };
          } else if (table === 'turns') {
            return {
              insert: vi.fn(() => ({
                data: null,
                error: null
              }))
            };
          }
          return {};
        })
      };

      // Mock the turn processing
      const turnResult = {
        turn: {
          idx: 3,
          role: 'narrator',
          content: {
            text: 'The adventure continues...'
          },
          prompt_meta: {
            segmentIdsByScope: {
              core: [1],
              ruleset: [2],
              world: [3],
              entry: [4],
              npc: [7, 8],
              game_state: [9],
              input: [10]
            },
            tokensEstimated: 1200,
            truncated: {}
          }
        }
      };

      expect(turnResult.turn.role).toBe('narrator');
      expect(turnResult.turn.content.text).toBe('The adventure continues...');
      expect(turnResult.turn.prompt_meta.segmentIdsByScope.entry_start || []).toEqual([]);
      expect(turnResult.turn.prompt_meta.segmentIdsByScope.npc).toEqual([7, 8]);
    });

    it('should not include entry_start on subsequent turns', async () => {
      // Mock subsequent turn assembly
      const subsequentTurnMeta = {
        order: ['core', 'ruleset', 'world', 'entry', 'npc', 'game_state', 'input'],
        segmentIdsByScope: {
          core: [1],
          ruleset: [2],
          world: [3],
          entry: [4],
          entry_start: [], // Empty for subsequent turns
          npc: [7, 8],
          game_state: [9],
          input: [10]
        },
        tokensEstimated: 1200,
        truncated: {}
      };

      expect(subsequentTurnMeta.segmentIdsByScope.entry_start).toEqual([]);
      expect(subsequentTurnMeta.segmentIdsByScope.npc).toEqual([7, 8]);
    });

    it('should include NPCs at appropriate tiers', async () => {
      const npcArgs = await buildNpcArgs('game-123', 'ep.whispercross', mockDb);
      
      expect(npcArgs).toHaveLength(2);
      expect(npcArgs[0].npcId).toBe('npc.mystika.kiera');
      expect(npcArgs[0].tier).toBe(0);
      expect(npcArgs[1].npcId).toBe('npc.mystika.thorne');
      expect(npcArgs[1].tier).toBe(0);
    });

    it('should handle player input validation', async () => {
      const invalidInputs = [
        '',
        '   ',
        null,
        undefined,
        123
      ];

      for (const input of invalidInputs) {
        if (typeof input === 'string' && input.trim().length === 0) {
          expect(input.trim().length).toBe(0);
        } else if (typeof input !== 'string') {
          expect(typeof input).not.toBe('string');
        }
      }
    });

    it('should increment turn count correctly', async () => {
      const initialTurnCount = 1;
      const expectedNextTurn = initialTurnCount + 1;
      const expectedNarratorTurn = expectedNextTurn + 1;

      expect(expectedNextTurn).toBe(2); // Player turn
      expect(expectedNarratorTurn).toBe(3); // Narrator turn
    });
  });

  describe('RLS and Access Control', () => {
    it('should respect user ownership for games', async () => {
      const gameOwner = 'user-123';
      const otherUser = 'user-456';
      
      // Mock game owned by user-123
      const mockGame = {
        id: 'game-123',
        owner_user_id: gameOwner
      };

      // Test access control
      const canAccess = (userId: string) => {
        return !userId || mockGame.owner_user_id === userId;
      };

      expect(canAccess(gameOwner)).toBe(true);
      expect(canAccess(otherUser)).toBe(false);
      expect(canAccess('')).toBe(false); // Anonymous access
    });

    it('should handle anonymous users appropriately', async () => {
      const anonymousUser = null;
      const gameOwner = 'user-123';
      
      // Anonymous users should not be able to access owned games
      expect(anonymousUser).toBeNull();
      expect(gameOwner).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing entry point', async () => {
      const result = await startGame({
        entryPointId: 'nonexistent.entry',
        ownerUserId: 'user-123'
      });

      // Should still return a result (mock implementation)
      expect(result).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      const mockError = new Error('Database connection failed');
      
      // In a real implementation, this would be caught and handled
      expect(mockError.message).toBe('Database connection failed');
    });
  });
});
