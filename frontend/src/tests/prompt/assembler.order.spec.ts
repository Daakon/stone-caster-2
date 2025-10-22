/**
 * Assembler Order Tests
 * Tests for prompt assembly order and dynamic layer handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assemblePrompt } from '@/prompt/assembler/assembler';
import type { AssembleArgs, DbAdapter } from '@/prompt/assembler/types';

// Mock database adapter
const mockDbAdapter: DbAdapter = {
  getSegments: vi.fn(),
  getRulesetsForEntry: vi.fn(),
  getWorldForEntry: vi.fn(),
  getNpcsForEntry: vi.fn()
};

// Mock state builder
vi.mock('@/prompt/assembler/state', () => ({
  buildStateBlocks: vi.fn(() => [
    '## Game State\nCurrent game state information',
    '## Player\nPlayer information',
    '## RNG\nRandom number generation',
    '## Input\nInput processing'
  ])
}));

// Mock NPC builder
vi.mock('@/prompt/assembler/npc', () => ({
  buildNpcBlock: vi.fn(() => ({
    body: '## NPCs\nNPC information',
    segmentIds: [101, 102]
  }))
}));

// Mock budget functions
vi.mock('@/prompt/assembler/budget', () => ({
  estimateTokens: vi.fn(() => 1000),
  applyTruncationPolicy: vi.fn((prompt, config, meta) => ({
    prompt,
    meta: { ...meta, truncated: {} }
  })),
  createBudgetConfig: vi.fn(() => ({}))
}));

describe('Assembler Order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock database responses
    mockDbAdapter.getSegments.mockImplementation((scope: string) => {
      const mockSegments = {
        core: [{ id: 1, content: 'Core system prompt' }],
        ruleset: [{ id: 2, content: 'Ruleset prompt' }],
        world: [{ id: 3, content: 'World prompt' }],
        entry: [{ id: 4, content: 'Entry prompt' }],
        entry_start: [{ id: 5, content: 'Entry start prompt' }],
        npc: [{ id: 6, content: 'NPC prompt' }]
      };
      return Promise.resolve(mockSegments[scope as keyof typeof mockSegments] || []);
    });

    mockDbAdapter.getRulesetsForEntry.mockResolvedValue([
      { id: 'ruleset-1', name: 'D&D 5e', sort_order: 1 },
      { id: 'ruleset-2', name: 'Pathfinder', sort_order: 2 }
    ]);

    mockDbAdapter.getWorldForEntry.mockResolvedValue({
      id: 'world-1',
      name: 'Fantasy Realm'
    });

    mockDbAdapter.getNpcsForEntry.mockResolvedValue([
      { id: 'npc-1', name: 'Gandalf' },
      { id: 'npc-2', name: 'Aragorn' }
    ]);
  });

  it('should assemble static layers in correct order', async () => {
    const args: AssembleArgs = {
      entryPointId: 'entry-1',
      worldId: 'world-1',
      isFirstTurn: true,
      tokenBudget: 4000,
      npcs: [
        { id: 'npc-1', name: 'Gandalf' },
        { id: 'npc-2', name: 'Aragorn' }
      ]
    };

    const result = await assemblePrompt(args, mockDbAdapter);

    // Check that static layers are fetched in correct order
    expect(mockDbAdapter.getSegments).toHaveBeenCalledWith('core');
    expect(mockDbAdapter.getSegments).toHaveBeenCalledWith('ruleset', 'ruleset-1');
    expect(mockDbAdapter.getSegments).toHaveBeenCalledWith('ruleset', 'ruleset-2');
    expect(mockDbAdapter.getSegments).toHaveBeenCalledWith('world', 'world-1');
    expect(mockDbAdapter.getSegments).toHaveBeenCalledWith('entry', 'entry-1');
    expect(mockDbAdapter.getSegments).toHaveBeenCalledWith('entry_start', 'entry-1');

    // Check that dynamic layers are not fetched from database
    expect(mockDbAdapter.getSegments).not.toHaveBeenCalledWith('game_state');
    expect(mockDbAdapter.getSegments).not.toHaveBeenCalledWith('player');
    expect(mockDbAdapter.getSegments).not.toHaveBeenCalledWith('rng');
    expect(mockDbAdapter.getSegments).not.toHaveBeenCalledWith('input');
  });

  it('should include entry_start only on first turn', async () => {
    const args: AssembleArgs = {
      entryPointId: 'entry-1',
      worldId: 'world-1',
      isFirstTurn: false, // Not first turn
      tokenBudget: 4000
    };

    await assemblePrompt(args, mockDbAdapter);

    // Should not fetch entry_start segments
    expect(mockDbAdapter.getSegments).not.toHaveBeenCalledWith('entry_start', 'entry-1');
  });

  it('should append dynamic layers after static layers', async () => {
    const args: AssembleArgs = {
      entryPointId: 'entry-1',
      worldId: 'world-1',
      isFirstTurn: true,
      tokenBudget: 4000
    };

    const result = await assemblePrompt(args, mockDbAdapter);

    // Check that dynamic layers are appended
    expect(result.prompt).toContain('## Game State');
    expect(result.prompt).toContain('## Player');
    expect(result.prompt).toContain('## RNG');
    expect(result.prompt).toContain('## Input');
  });

  it('should track segment IDs correctly', async () => {
    const args: AssembleArgs = {
      entryPointId: 'entry-1',
      worldId: 'world-1',
      isFirstTurn: true,
      tokenBudget: 4000,
      npcs: [{ id: 'npc-1', name: 'Gandalf' }]
    };

    const result = await assemblePrompt(args, mockDbAdapter);

    // Check that segment IDs are tracked
    expect(result.meta.segmentIdsByScope.core).toEqual([1]);
    expect(result.meta.segmentIdsByScope.ruleset).toEqual([2]);
    expect(result.meta.segmentIdsByScope.world).toEqual([3]);
    expect(result.meta.segmentIdsByScope.entry).toEqual([4]);
    expect(result.meta.segmentIdsByScope.entry_start).toEqual([5]);
    expect(result.meta.segmentIdsByScope.npc).toEqual([101, 102]);
  });

  it('should maintain correct assembly order in metadata', async () => {
    const args: AssembleArgs = {
      entryPointId: 'entry-1',
      worldId: 'world-1',
      isFirstTurn: true,
      tokenBudget: 4000
    };

    const result = await assemblePrompt(args, mockDbAdapter);

    // Check that order is correct: static first, then dynamic
    const expectedOrder = [
      'core',
      'ruleset',
      'world',
      'entry',
      'entry_start',
      'npc',
      'game_state',
      'player',
      'rng',
      'input'
    ];

    expect(result.meta.order).toEqual(expectedOrder);
  });

  it('should handle multiple rulesets in order', async () => {
    const args: AssembleArgs = {
      entryPointId: 'entry-1',
      worldId: 'world-1',
      isFirstTurn: true,
      tokenBudget: 4000
    };

    await assemblePrompt(args, mockDbAdapter);

    // Should fetch rulesets in order
    expect(mockDbAdapter.getSegments).toHaveBeenCalledWith('ruleset', 'ruleset-1');
    expect(mockDbAdapter.getSegments).toHaveBeenCalledWith('ruleset', 'ruleset-2');
  });
});
