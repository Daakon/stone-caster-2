// Games Start Service Tests
// Tests for entry_start bootstrap functionality

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { startGame, getGame } from '../../src/services/games';
import { MockDbAdapter } from '../../src/prompt/assembler/db';
import type { AssembleArgs } from '../../src/prompt/assembler/types';

// Mock the state service
vi.mock('../../src/services/state', () => ({
  markBootstrapped: vi.fn().mockResolvedValue(undefined)
}));

// Mock the model adapter
const mockModelAdapter = {
  generate: vi.fn().mockResolvedValue({
    content: '[Narrator] The adventure begins in the Whispering Woods...',
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150
    }
  })
};

describe('Games Start Service', () => {
  let mockDb: MockDbAdapter;

  beforeEach(() => {
    mockDb = new MockDbAdapter();
    
    // Seed mock data for entry_start segments
    mockDb.addSegments([{
      id: 1,
      scope: 'core',
      ref_id: null,
      version: '1.0.0',
      active: true,
      content: 'You are a helpful game master.',
      metadata: {}
    }]);

    mockDb.addSegments([{
      id: 2,
      scope: 'ruleset',
      ref_id: 'ruleset.classic_v1',
      version: '1.0.0',
      active: true,
      content: 'Classic fantasy rules.',
      metadata: {}
    }]);

    mockDb.addSegments([{
      id: 3,
      scope: 'world',
      ref_id: 'world.mystika',
      version: '1.0.0',
      active: true,
      content: 'Mystika is a magical realm.',
      metadata: {}
    }]);

    mockDb.addSegments([{
      id: 4,
      scope: 'entry',
      ref_id: 'ep.whispercross',
      version: '1.0.0',
      active: true,
      content: 'Welcome to Whispercross.',
      metadata: {}
    }]);

    // Entry start segment - only appears on first turn
    mockDb.addSegments([{
      id: 5,
      scope: 'entry_start',
      ref_id: 'ep.whispercross',
      version: '1.0.0',
      active: true,
      content: 'This is the opening scene. The ancient forest whispers secrets.',
      metadata: { kind: 'opening' }
    }]);

    // Additional entry start segment
    mockDb.addSegments([{
      id: 6,
      scope: 'entry_start',
      ref_id: 'ep.whispercross',
      version: '1.0.0',
      active: true,
      content: 'The path ahead is shrouded in mist.',
      metadata: { kind: 'atmosphere' }
    }]);
  });

  describe('startGame', () => {
    it('should include entry_start segments on first turn', async () => {
      const result = await startGame({
        entryPointId: 'ep.whispercross',
        ownerUserId: 'user-123',
        locale: 'en'
      });

      expect(result.gameId).toBeDefined();
      expect(result.firstTurnId).toBe(1);
      expect(result.prompt).toContain('entry_start');
      expect(result.prompt).toContain('The ancient forest whispers secrets');
      expect(result.prompt).toContain('The path ahead is shrouded in mist');
      
      // Verify entry_start segments are included in metadata
      expect(result.meta.segmentIdsByScope.entry_start).toContain(5);
      expect(result.meta.segmentIdsByScope.entry_start).toContain(6);
      expect(result.meta.segmentIdsByScope.entry_start.length).toBe(2);
    });

    it('should assemble prompt in correct order', async () => {
      const result = await startGame({
        entryPointId: 'ep.whispercross',
        ownerUserId: 'user-123'
      });

      const prompt = result.prompt;
      
      // Verify order: core → ruleset → world → entry → entry_start
      const coreIndex = prompt.indexOf('CORE_BEGIN');
      const rulesetIndex = prompt.indexOf('RULESET_BEGIN');
      const worldIndex = prompt.indexOf('WORLD_BEGIN');
      const entryIndex = prompt.indexOf('ENTRY_BEGIN');
      const entryStartIndex = prompt.indexOf('ENTRY_START_BEGIN');

      expect(coreIndex).toBeLessThan(rulesetIndex);
      expect(rulesetIndex).toBeLessThan(worldIndex);
      expect(worldIndex).toBeLessThan(entryIndex);
      expect(entryIndex).toBeLessThan(entryStartIndex);
    });

    it('should include all required metadata', async () => {
      const result = await startGame({
        entryPointId: 'ep.whispercross',
        ownerUserId: 'user-123'
      });

      expect(result.meta.order).toEqual([
        'core', 'ruleset', 'world', 'entry', 'entry_start',
        'npc', 'game_state', 'player', 'rng', 'input'
      ]);
      
      expect(result.meta.segmentIdsByScope.core).toEqual([1]);
      expect(result.meta.segmentIdsByScope.ruleset).toEqual([2]);
      expect(result.meta.segmentIdsByScope.world).toEqual([3]);
      expect(result.meta.segmentIdsByScope.entry).toEqual([4]);
      expect(result.meta.segmentIdsByScope.entry_start).toEqual([5, 6]);
      
      expect(result.meta.tokensEstimated).toBeGreaterThan(0);
    });

    it('should mark game as bootstrapped after first turn', async () => {
      const { markBootstrapped } = await import('../../src/services/state');
      
      await startGame({
        entryPointId: 'ep.whispercross',
        ownerUserId: 'user-123'
      });

      expect(markBootstrapped).toHaveBeenCalled();
    });
  });

  describe('getGame', () => {
    it('should return game with bootstrapped flag set', async () => {
      const game = await getGame('game-123');
      
      expect(game).toBeDefined();
      expect(game.state.cold.flags.entry_bootstrapped).toBe(true);
      expect(game.turn_count).toBe(1);
    });
  });

  describe('Entry Start Behavior', () => {
    it('should only include entry_start on first turn', async () => {
      // First turn - should include entry_start
      const firstTurnResult = await startGame({
        entryPointId: 'ep.whispercross',
        ownerUserId: 'user-123'
      });

      expect(firstTurnResult.prompt).toContain('ENTRY_START_BEGIN');
      expect(firstTurnResult.meta.segmentIdsByScope.entry_start.length).toBeGreaterThan(0);

      // Simulate subsequent turn (isFirstTurn=false)
      // In a real scenario, this would be handled by the turn service
      const subsequentTurnArgs: AssembleArgs = {
        entryPointId: 'ep.whispercross',
        worldId: 'world.mystika',
        rulesetId: 'ruleset.classic_v1',
        isFirstTurn: false // Key difference
      };

      // Mock assembler call for subsequent turn
      const { assemblePrompt } = await import('../../src/prompt/assembler/assembler');
      const subsequentResult = await assemblePrompt(subsequentTurnArgs, mockDb);

      expect(subsequentResult.prompt).not.toContain('ENTRY_START_BEGIN');
      expect(subsequentResult.meta.segmentIdsByScope.entry_start).toEqual([]);
    });
  });
});
