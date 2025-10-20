// Prompt Assembler Test Suite
// Comprehensive tests for the prompt assembly system

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assemblePrompt, validateAssembleArgs, createAssemblySummary } from '../../src/prompt/assembler/assembler';
import { MockDbAdapter, createMockDbAdapter } from '../../src/prompt/assembler/db';
import { buildNpcBlock } from '../../src/prompt/assembler/npc';
import { buildStateBlocks, createMockState } from '../../src/prompt/assembler/state';
import { estimateTokens, truncateText, compressGameState } from '../../src/prompt/assembler/budget';
import { block } from '../../src/prompt/assembler/markdown';
import type { AssembleArgs, SegmentRow, Scope } from '../../src/prompt/assembler/types';

describe('Prompt Assembler', () => {
  let mockDb: MockDbAdapter;

  beforeEach(() => {
    mockDb = createMockDbAdapter();
  });

  afterEach(() => {
    mockDb.clearSegments();
  });

  describe('Order Test', () => {
    it('should assemble blocks in the correct order', async () => {
      // Seed minimal segments
      const segments: SegmentRow[] = [
        {
          id: 1,
          scope: 'core',
          ref_id: null,
          version: '1.0.0',
          active: true,
          content: 'Core system prompt',
          metadata: {}
        },
        {
          id: 2,
          scope: 'ruleset',
          ref_id: 'ruleset.classic_v1',
          version: '1.0.0',
          active: true,
          content: 'Classic D&D rules',
          metadata: {}
        },
        {
          id: 3,
          scope: 'world',
          ref_id: 'world.mystika',
          version: '1.0.0',
          active: true,
          content: 'Mystika world description',
          metadata: {}
        },
        {
          id: 4,
          scope: 'entry',
          ref_id: 'ep.whispercross',
          version: '1.0.0',
          active: true,
          content: 'Whispercross adventure',
          metadata: {}
        }
      ];

      mockDb.addSegments(segments);

      const args: AssembleArgs = {
        entryPointId: 'ep.whispercross',
        worldId: 'world.mystika',
        rulesetId: 'ruleset.classic_v1'
      };

      const result = await assemblePrompt(args, mockDb);

      // Check that blocks appear in correct order
      const expectedOrder = [
        '=== CORE_BEGIN ===',
        '=== RULESET_BEGIN ===',
        '=== WORLD_BEGIN ===',
        '=== ENTRY_BEGIN ==='
      ];

      for (let i = 0; i < expectedOrder.length; i++) {
        const currentIndex = result.prompt.indexOf(expectedOrder[i]);
        const nextIndex = i < expectedOrder.length - 1 
          ? result.prompt.indexOf(expectedOrder[i + 1])
          : result.prompt.length;

        expect(currentIndex).toBeLessThan(nextIndex);
      }
    });
  });

  describe('Entry Start One-Time', () => {
    it('should include entry_start when isFirstTurn is true', async () => {
      const segments: SegmentRow[] = [
        {
          id: 1,
          scope: 'core',
          ref_id: null,
          version: '1.0.0',
          active: true,
          content: 'Core prompt',
          metadata: {}
        },
        {
          id: 2,
          scope: 'entry_start',
          ref_id: 'ep.whispercross',
          version: '1.0.0',
          active: true,
          content: 'First turn welcome',
          metadata: {}
        }
      ];

      mockDb.addSegments(segments);

      const args: AssembleArgs = {
        entryPointId: 'ep.whispercross',
        worldId: 'world.mystika',
        rulesetId: 'ruleset.classic_v1',
        isFirstTurn: true
      };

      const result = await assemblePrompt(args, mockDb);

      expect(result.prompt).toContain('=== ENTRY_START_BEGIN ===');
      expect(result.prompt).toContain('First turn welcome');
    });

    it('should omit entry_start when isFirstTurn is false', async () => {
      const segments: SegmentRow[] = [
        {
          id: 1,
          scope: 'core',
          ref_id: null,
          version: '1.0.0',
          active: true,
          content: 'Core prompt',
          metadata: {}
        },
        {
          id: 2,
          scope: 'entry_start',
          ref_id: 'ep.whispercross',
          version: '1.0.0',
          active: true,
          content: 'First turn welcome',
          metadata: {}
        }
      ];

      mockDb.addSegments(segments);

      const args: AssembleArgs = {
        entryPointId: 'ep.whispercross',
        worldId: 'world.mystika',
        rulesetId: 'ruleset.classic_v1',
        isFirstTurn: false
      };

      const result = await assemblePrompt(args, mockDb);

      expect(result.prompt).not.toContain('=== ENTRY_START_BEGIN ===');
      expect(result.prompt).not.toContain('First turn welcome');
    });
  });

  describe('NPC Tier Reveal', () => {
    it('should include only segments up to specified tier', async () => {
      const segments: SegmentRow[] = [
        {
          id: 1,
          scope: 'npc',
          ref_id: 'npc.innkeeper',
          version: '1.0.0',
          active: true,
          content: 'Basic innkeeper description',
          metadata: { tier: 0 }
        },
        {
          id: 2,
          scope: 'npc',
          ref_id: 'npc.innkeeper',
          version: '1.0.0',
          active: true,
          content: 'Innkeeper knows local secrets',
          metadata: { tier: 1 }
        },
        {
          id: 3,
          scope: 'npc',
          ref_id: 'npc.innkeeper',
          version: '1.0.0',
          active: true,
          content: 'Innkeeper has hidden magical items',
          metadata: { tier: 2 }
        }
      ];

      mockDb.addSegments(segments);

      const npcs = [{ npcId: 'npc.innkeeper', tier: 1 }];
      const result = await buildNpcBlock(npcs, 1000, mockDb);

      expect(result.body).toContain('Basic innkeeper description');
      expect(result.body).toContain('Innkeeper knows local secrets');
      expect(result.body).not.toContain('Innkeeper has hidden magical items');
    });

    it('should maintain stable order for segments at same tier', async () => {
      const segments: SegmentRow[] = [
        {
          id: 1,
          scope: 'npc',
          ref_id: 'npc.innkeeper',
          version: '1.0.0',
          active: true,
          content: 'First segment',
          metadata: { tier: 0 }
        },
        {
          id: 2,
          scope: 'npc',
          ref_id: 'npc.innkeeper',
          version: '1.0.0',
          active: true,
          content: 'Second segment',
          metadata: { tier: 0 }
        }
      ];

      mockDb.addSegments(segments);

      const npcs = [{ npcId: 'npc.innkeeper', tier: 0 }];
      const result1 = await buildNpcBlock(npcs, 1000, mockDb);
      const result2 = await buildNpcBlock(npcs, 1000, mockDb);

      expect(result1.body).toBe(result2.body);
    });
  });

  describe('NPC Budget', () => {
    it('should drop higher tiers when over budget', async () => {
      const segments: SegmentRow[] = [
        {
          id: 1,
          scope: 'npc',
          ref_id: 'npc.innkeeper',
          version: '1.0.0',
          active: true,
          content: 'Basic description',
          metadata: { tier: 0 }
        },
        {
          id: 2,
          scope: 'npc',
          ref_id: 'npc.innkeeper',
          version: '1.0.0',
          active: true,
          content: 'Detailed behavior and secrets that make this content very long to exceed the token budget',
          metadata: { tier: 1 }
        }
      ];

      mockDb.addSegments(segments);

      const npcs = [{ npcId: 'npc.innkeeper', tier: 1 }];
      const result = await buildNpcBlock(npcs, 50, mockDb); // Very low budget

      expect(result.dropped).toBeDefined();
      expect(result.dropped?.length).toBeGreaterThan(0);
    });

    it('should summarize when still over budget after tier reduction', async () => {
      const segments: SegmentRow[] = [
        {
          id: 1,
          scope: 'npc',
          ref_id: 'npc.innkeeper',
          version: '1.0.0',
          active: true,
          content: 'Very long description that exceeds budget even at tier 0',
          metadata: { tier: 0 }
        }
      ];

      mockDb.addSegments(segments);

      const npcs = [{ npcId: 'npc.innkeeper', tier: 0 }];
      const result = await buildNpcBlock(npcs, 10, mockDb); // Extremely low budget

      expect(result.body).toContain('NPC npc.innkeeper: [Behavior cue');
    });
  });

  describe('Global Budget - Trim Input', () => {
    it('should truncate input when over budget', async () => {
      const segments: SegmentRow[] = [
        {
          id: 1,
          scope: 'core',
          ref_id: null,
          version: '1.0.0',
          active: true,
          content: 'Core prompt',
          metadata: {}
        }
      ];

      mockDb.addSegments(segments);

      const longInput = 'This is a very long user input that should be truncated when the token budget is exceeded. '.repeat(100);
      
      const args: AssembleArgs = {
        entryPointId: 'ep.whispercross',
        worldId: 'world.mystika',
        rulesetId: 'ruleset.classic_v1',
        inputText: longInput,
        tokenBudget: 100 // Very low budget
      };

      const result = await assemblePrompt(args, mockDb);

      expect(result.meta.truncated?.inputTrimmed).toBeDefined();
      expect(result.meta.truncated?.inputTrimmed?.fromChars).toBeGreaterThan(
        result.meta.truncated?.inputTrimmed?.toChars || 0
      );
    });
  });

  describe('Global Budget - Compress Game State', () => {
    it('should compress game state when over budget', async () => {
      const segments: SegmentRow[] = [
        {
          id: 1,
          scope: 'core',
          ref_id: null,
          version: '1.0.0',
          active: true,
          content: 'Core prompt',
          metadata: {}
        }
      ];

      mockDb.addSegments(segments);

      const longGameState = 'Very detailed game state information. '.repeat(200);
      
      const args: AssembleArgs = {
        entryPointId: 'ep.whispercross',
        worldId: 'world.mystika',
        rulesetId: 'ruleset.classic_v1',
        gameStateText: longGameState,
        tokenBudget: 100 // Very low budget
      };

      const result = await assemblePrompt(args, mockDb);

      expect(result.meta.truncated?.gameStateCompressed).toBe(true);
    });
  });

  describe('Never Drop Core/Ruleset', () => {
    it('should preserve core and ruleset even with draconian budget', async () => {
      const segments: SegmentRow[] = [
        {
          id: 1,
          scope: 'core',
          ref_id: null,
          version: '1.0.0',
          active: true,
          content: 'Core system prompt',
          metadata: {}
        },
        {
          id: 2,
          scope: 'ruleset',
          ref_id: 'ruleset.classic_v1',
          version: '1.0.0',
          active: true,
          content: 'Classic rules',
          metadata: {}
        }
      ];

      mockDb.addSegments(segments);

      const args: AssembleArgs = {
        entryPointId: 'ep.whispercross',
        worldId: 'world.mystika',
        rulesetId: 'ruleset.classic_v1',
        tokenBudget: 10 // Extremely low budget
      };

      const result = await assemblePrompt(args, mockDb);

      expect(result.prompt).toContain('=== CORE_BEGIN ===');
      expect(result.prompt).toContain('=== RULESET_BEGIN ===');
      expect(result.meta.truncated?.droppedScopes).not.toContain('core');
      expect(result.meta.truncated?.droppedScopes).not.toContain('ruleset');
    });
  });

  describe('Meta IDs', () => {
    it('should track segment IDs by scope', async () => {
      const segments: SegmentRow[] = [
        {
          id: 1,
          scope: 'core',
          ref_id: null,
          version: '1.0.0',
          active: true,
          content: 'Core prompt',
          metadata: {}
        },
        {
          id: 2,
          scope: 'entry',
          ref_id: 'ep.whispercross',
          version: '1.0.0',
          active: true,
          content: 'Entry prompt',
          metadata: {}
        }
      ];

      mockDb.addSegments(segments);

      const args: AssembleArgs = {
        entryPointId: 'ep.whispercross',
        worldId: 'world.mystika',
        rulesetId: 'ruleset.classic_v1'
      };

      const result = await assemblePrompt(args, mockDb);

      expect(result.meta.segmentIdsByScope.core).toContain(1);
      expect(result.meta.segmentIdsByScope.entry).toContain(2);
    });
  });

  describe('State Blocks', () => {
    it('should build state blocks correctly', () => {
      const args: AssembleArgs = {
        entryPointId: 'ep.whispercross',
        worldId: 'world.mystika',
        rulesetId: 'ruleset.classic_v1',
        gameStateText: 'Current game state',
        playerText: 'Player character info',
        rngText: 'RNG configuration',
        inputText: 'User input'
      };

      const blocks = buildStateBlocks(args);

      expect(blocks).toHaveLength(4);
      expect(blocks[0]).toContain('=== GAME_STATE_BEGIN ===');
      expect(blocks[1]).toContain('=== PLAYER_BEGIN ===');
      expect(blocks[2]).toContain('=== RNG_BEGIN ===');
      expect(blocks[3]).toContain('=== INPUT_BEGIN ===');
    });
  });

  describe('Budget Functions', () => {
    it('should estimate tokens correctly', () => {
      expect(estimateTokens('Hello world')).toBe(3); // 12 chars / 4 = 3
      expect(estimateTokens('')).toBe(0);
    });

    it('should truncate text while preserving sentence boundaries', () => {
      const longText = 'This is a sentence. This is another sentence. This is a third sentence.';
      const result = truncateText(longText, 30);

      expect(result.truncated).toBe(true);
      expect(result.text.length).toBeLessThanOrEqual(30);
      expect(result.text).toContain('sentence.');
    });

    it('should compress game state to summary', () => {
      const longGameState = 'Very detailed game state. '.repeat(50);
      const result = compressGameState(longGameState, 50);

      expect(result.compressed).toBe(true);
      expect(result.text).toContain('(Game state compressed');
    });
  });

  describe('Markdown Formatting', () => {
    it('should create properly formatted blocks', () => {
      const content = 'Test content';
      const formatted = block('core', content);

      expect(formatted).toContain('=== CORE_BEGIN ===');
      expect(formatted).toContain('=== CORE_END ===');
      expect(formatted).toContain(content);
    });
  });

  describe('Argument Validation', () => {
    it('should validate required fields', () => {
      const invalidArgs: AssembleArgs = {
        entryPointId: '',
        worldId: '',
        rulesetId: ''
      };

      const result = validateAssembleArgs(invalidArgs);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate token budgets', () => {
      const invalidArgs: AssembleArgs = {
        entryPointId: 'ep.test',
        worldId: 'world.test',
        rulesetId: 'ruleset.test',
        tokenBudget: 50, // Too low
        npcTokenBudget: 10 // Too low
      };

      const result = validateAssembleArgs(invalidArgs);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('tokenBudget must be at least 100');
      expect(result.errors).toContain('npcTokenBudget must be at least 50');
    });
  });

  describe('NPC Integration', () => {
    it('should include NPC segments based on tier', async () => {
      // Add NPC segments to mock data
      mockDb.addSegments([{
        id: 20,
        scope: 'npc',
        ref_id: 'npc.mystika.kiera',
        version: '1.0.0',
        active: true,
        content: 'NPC: Kiera — calm, alert, protective.',
        metadata: { tier: 0, kind: 'baseline' }
      }]);

      mockDb.addSegments([{
        id: 21,
        scope: 'npc',
        ref_id: 'npc.mystika.kiera',
        version: '1.0.0',
        active: true,
        content: 'Reveal: owes life-debt to a drygar.',
        metadata: { tier: 1, kind: 'secret' }
      });

      const args: AssembleArgs = {
        entryPointId: 'ep.whispercross',
        worldId: 'world.mystika',
        rulesetId: 'ruleset.classic_v1',
        npcs: [{ npcId: 'npc.mystika.kiera', tier: 1 }]
      };

      const result = await assemblePrompt(args, mockDb);
      
      expect(result.prompt).toContain('NPC: Kiera — calm, alert, protective.');
      expect(result.prompt).toContain('Reveal: owes life-debt to a drygar.');
      expect(result.meta.segmentIdsByScope.npc).toEqual([20, 21]);
    });

    it('should respect NPC tier filtering', async () => {
      // Add NPC segments with different tiers
      mockDb.addSegments([{
        id: 22,
        scope: 'npc',
        ref_id: 'npc.mystika.kiera',
        version: '1.0.0',
        active: true,
        content: 'NPC: Kiera — calm, alert, protective.',
        metadata: { tier: 0, kind: 'baseline' }
      }]);

      mockDb.addSegments([{
        id: 23,
        scope: 'npc',
        ref_id: 'npc.mystika.kiera',
        version: '1.0.0',
        active: true,
        content: 'Deep Reveal: carries cracked focus stone.',
        metadata: { tier: 2, kind: 'secret' }
      });

      const args: AssembleArgs = {
        entryPointId: 'ep.whispercross',
        worldId: 'world.mystika',
        rulesetId: 'ruleset.classic_v1',
        npcs: [{ npcId: 'npc.mystika.kiera', tier: 1 }] // Only tier 0 and 1 should be included
      };

      const result = await assemblePrompt(args, mockDb);
      
      expect(result.prompt).toContain('NPC: Kiera — calm, alert, protective.');
      expect(result.prompt).not.toContain('Deep Reveal: carries cracked focus stone.');
      expect(result.meta.segmentIdsByScope.npc).toEqual([22]);
    });

    it('should handle multiple NPCs', async () => {
      // Add segments for multiple NPCs
      mockDb.addSegments([{
        id: 24,
        scope: 'npc',
        ref_id: 'npc.mystika.kiera',
        version: '1.0.0',
        active: true,
        content: 'NPC: Kiera — calm, alert, protective.',
        metadata: { tier: 0, kind: 'baseline' }
      }]);

      mockDb.addSegments([{
        id: 25,
        scope: 'npc',
        ref_id: 'npc.mystika.thorne',
        version: '1.0.0',
        active: true,
        content: 'NPC: Thorne — scholarly, absent-minded.',
        metadata: { tier: 0, kind: 'baseline' }
      }]);

      const args: AssembleArgs = {
        entryPointId: 'ep.whispercross',
        worldId: 'world.mystika',
        rulesetId: 'ruleset.classic_v1',
        npcs: [
          { npcId: 'npc.mystika.kiera', tier: 0 },
          { npcId: 'npc.mystika.thorne', tier: 0 }
        ]
      };

      const result = await assemblePrompt(args, mockDb);
      
      expect(result.prompt).toContain('NPC: Kiera — calm, alert, protective.');
      expect(result.prompt).toContain('NPC: Thorne — scholarly, absent-minded.');
      expect(result.meta.segmentIdsByScope.npc).toEqual([24, 25]);
    });

    it('should handle NPC budget constraints', async () => {
      // Add many NPC segments to test budget
      for (let i = 0; i < 10; i++) {
        mockDb.addSegments([{
          id: 30 + i,
          scope: 'npc',
          ref_id: 'npc.mystika.kiera',
          version: '1.0.0',
          active: true,
          content: `NPC segment ${i} with lots of content to test budget constraints. This is a long segment that should be truncated when the budget is exceeded.`,
          metadata: { tier: 0, kind: 'baseline' }
        });
      }

      const args: AssembleArgs = {
        entryPointId: 'ep.whispercross',
        worldId: 'world.mystika',
        rulesetId: 'ruleset.classic_v1',
        npcs: [{ npcId: 'npc.mystika.kiera', tier: 0 }],
        npcTokenBudget: 100 // Very small budget
      };

      const result = await assemblePrompt(args, mockDb);
      
      // Should have some NPC content but may be truncated
      expect(result.prompt).toContain('NPC:');
      expect(result.meta.segmentIdsByScope.npc.length).toBeGreaterThan(0);
    });
  });

  describe('Assembly Summary', () => {
    it('should create informative summary', () => {
      const result = {
        prompt: 'Test prompt',
        meta: {
          order: ['core', 'ruleset'] as Scope[],
          segmentIdsByScope: { 
            core: [1], 
            ruleset: [2],
            world: [],
            entry: [],
            entry_start: [],
            npc: [],
            game_state: [],
            player: [],
            rng: [],
            input: []
          },
          tokensEstimated: 100,
          truncated: {
            inputTrimmed: { fromChars: 200, toChars: 100 }
          }
        }
      };

      const summary = createAssemblySummary(result);
      expect(summary).toContain('Prompt length: 11 chars');
      expect(summary).toContain('Estimated tokens: 100');
      expect(summary).toContain('Segments used: 2');
    });
  });

  describe('Mock State Creation', () => {
    it('should create valid mock state', () => {
      const mockState = createMockState();
      
      expect(mockState.entryPointId).toBe('ep.whispercross');
      expect(mockState.worldId).toBe('world.mystika');
      expect(mockState.rulesetId).toBe('ruleset.classic_v1');
      expect(mockState.gameStateText).toContain('Game State:');
      expect(mockState.playerText).toContain('Character:');
      expect(mockState.npcs).toHaveLength(2);
    });

    it('should allow overrides in mock state', () => {
      const mockState = createMockState({
        isFirstTurn: true,
        tokenBudget: 5000
      });
      
      expect(mockState.isFirstTurn).toBe(true);
      expect(mockState.tokenBudget).toBe(5000);
    });
  });

  describe('Integration Test', () => {
    it('should assemble complete prompt with all components', async () => {
      const segments: SegmentRow[] = [
        {
          id: 1,
          scope: 'core',
          ref_id: null,
          version: '1.0.0',
          active: true,
          content: 'You are a helpful AI game master.',
          metadata: {}
        },
        {
          id: 2,
          scope: 'ruleset',
          ref_id: 'ruleset.classic_v1',
          version: '1.0.0',
          active: true,
          content: 'Use classic D&D rules.',
          metadata: {}
        },
        {
          id: 3,
          scope: 'world',
          ref_id: 'world.mystika',
          version: '1.0.0',
          active: true,
          content: 'The world of Mystika is magical.',
          metadata: {}
        },
        {
          id: 4,
          scope: 'entry',
          ref_id: 'ep.whispercross',
          version: '1.0.0',
          active: true,
          content: 'You are at the Whispercross Inn.',
          metadata: {}
        },
        {
          id: 5,
          scope: 'entry_start',
          ref_id: 'ep.whispercross',
          version: '1.0.0',
          active: true,
          content: 'Welcome to your adventure!',
          metadata: {}
        },
        {
          id: 6,
          scope: 'npc',
          ref_id: 'npc.innkeeper',
          version: '1.0.0',
          active: true,
          content: 'The innkeeper is friendly.',
          metadata: { tier: 0 }
        }
      ];

      mockDb.addSegments(segments);

      const args: AssembleArgs = {
        entryPointId: 'ep.whispercross',
        worldId: 'world.mystika',
        rulesetId: 'ruleset.classic_v1',
        isFirstTurn: true,
        gameStateText: 'Current game state',
        playerText: 'Player character',
        inputText: 'User input',
        npcs: [{ npcId: 'npc.innkeeper', tier: 0 }]
      };

      const result = await assemblePrompt(args, mockDb);

      // Verify all expected blocks are present
      expect(result.prompt).toContain('=== CORE_BEGIN ===');
      expect(result.prompt).toContain('=== RULESET_BEGIN ===');
      expect(result.prompt).toContain('=== WORLD_BEGIN ===');
      expect(result.prompt).toContain('=== ENTRY_BEGIN ===');
      expect(result.prompt).toContain('=== ENTRY_START_BEGIN ===');
      expect(result.prompt).toContain('=== NPC_BEGIN ===');
      expect(result.prompt).toContain('=== GAME_STATE_BEGIN ===');
      expect(result.prompt).toContain('=== PLAYER_BEGIN ===');
      expect(result.prompt).toContain('=== INPUT_BEGIN ===');

      // Verify content is present
      expect(result.prompt).toContain('You are a helpful AI game master.');
      expect(result.prompt).toContain('Use classic D&D rules.');
      expect(result.prompt).toContain('The world of Mystika is magical.');
      expect(result.prompt).toContain('You are at the Whispercross Inn.');
      expect(result.prompt).toContain('Welcome to your adventure!');
      expect(result.prompt).toContain('The innkeeper is friendly.');

      // Verify metadata
      expect(result.meta.segmentIdsByScope.core).toContain(1);
      expect(result.meta.segmentIdsByScope.ruleset).toContain(2);
      expect(result.meta.segmentIdsByScope.world).toContain(3);
      expect(result.meta.segmentIdsByScope.entry).toContain(4);
      expect(result.meta.segmentIdsByScope.entry_start).toContain(5);
      expect(result.meta.segmentIdsByScope.npc).toContain(6);
    });
  });
});
