/**
 * Assembler Multi-Ruleset Tests
 * Test ordered ruleset assembly in prompt generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { assemblePrompt } from '../../src/prompt/assembler/assembler';
import { MockDbAdapter } from '../../src/prompt/assembler/db';
import type { AssembleArgs } from '../../src/prompt/assembler/types';

describe('Assembler Multi-Ruleset Support', () => {
  let mockDb: MockDbAdapter;

  beforeEach(() => {
    mockDb = new MockDbAdapter();
  });

  describe('ordered ruleset assembly', () => {
    it('should assemble multiple rulesets in correct order', async () => {
      // Setup test data
      mockDb.addSegments([
        {
          id: 1,
          scope: 'core',
          ref_id: null,
          version: '1.0.0',
          active: true,
          content: 'You are a helpful AI game master.',
          metadata: { type: 'system' }
        },
        {
          id: 2,
          scope: 'ruleset',
          ref_id: 'ruleset-1',
          version: '1.0.0',
          active: true,
          content: 'Use D&D 5e rules for combat.',
          metadata: { type: 'combat_rules' }
        },
        {
          id: 3,
          scope: 'ruleset',
          ref_id: 'ruleset-2',
          version: '1.0.0',
          active: true,
          content: 'Use Pathfinder rules for skills.',
          metadata: { type: 'skill_rules' }
        },
        {
          id: 4,
          scope: 'world',
          ref_id: 'world-1',
          version: '1.0.0',
          active: true,
          content: 'The world of Mystika is magical.',
          metadata: { type: 'world_description' }
        },
        {
          id: 5,
          scope: 'entry',
          ref_id: 'entry-1',
          version: '1.0.0',
          active: true,
          content: 'You find yourself at the inn.',
          metadata: { type: 'adventure_setup' }
        }
      ]);

      // Mock the getRulesetsForEntry method
      const originalGetRulesetsForEntry = mockDb.getRulesetsForEntry;
      mockDb.getRulesetsForEntry = async (entryId: string) => {
        if (entryId === 'entry-1') {
          return [
            { id: 'ruleset-1', name: 'D&D Combat', sort_order: 0 },
            { id: 'ruleset-2', name: 'Pathfinder Skills', sort_order: 1 }
          ];
        }
        return [];
      };

      const args: AssembleArgs = {
        entryPointId: 'entry-1',
        worldId: 'world-1'
      };

      const result = await assemblePrompt(args, mockDb);

      // Verify the prompt contains rulesets in order
      expect(result.prompt).toContain('You are a helpful AI game master.');
      expect(result.prompt).toContain('Use D&D 5e rules for combat.');
      expect(result.prompt).toContain('Use Pathfinder rules for skills.');
      expect(result.prompt).toContain('The world of Mystika is magical.');
      expect(result.prompt).toContain('You find yourself at the inn.');

      // Verify ruleset segments are included
      expect(result.meta.segmentIdsByScope.ruleset).toEqual([2, 3]);
    });

    it('should handle empty rulesets gracefully', async () => {
      mockDb.addSegments([
        {
          id: 1,
          scope: 'core',
          ref_id: null,
          version: '1.0.0',
          active: true,
          content: 'You are a helpful AI game master.',
          metadata: {}
        }
      ]);

      // Mock empty rulesets
      const originalGetRulesetsForEntry = mockDb.getRulesetsForEntry;
      mockDb.getRulesetsForEntry = async () => [];

      const args: AssembleArgs = {
        entryPointId: 'entry-1',
        worldId: 'world-1'
      };

      const result = await assemblePrompt(args, mockDb);

      expect(result.prompt).toContain('You are a helpful AI game master.');
      expect(result.meta.segmentIdsByScope.ruleset).toEqual([]);
    });

    it('should handle rulesets with no segments', async () => {
      mockDb.addSegments([
        {
          id: 1,
          scope: 'core',
          ref_id: null,
          version: '1.0.0',
          active: true,
          content: 'You are a helpful AI game master.',
          metadata: {}
        }
      ]);

      // Mock rulesets that exist but have no segments
      const originalGetRulesetsForEntry = mockDb.getRulesetsForEntry;
      mockDb.getRulesetsForEntry = async (entryId: string) => {
        if (entryId === 'entry-1') {
          return [
            { id: 'ruleset-1', name: 'Empty Ruleset', sort_order: 0 }
          ];
        }
        return [];
      };

      const args: AssembleArgs = {
        entryPointId: 'entry-1',
        worldId: 'world-1'
      };

      const result = await assemblePrompt(args, mockDb);

      expect(result.prompt).toContain('You are a helpful AI game master.');
      expect(result.meta.segmentIdsByScope.ruleset).toEqual([]);
    });

    it('should maintain ruleset order even with mixed segment availability', async () => {
      // Add segments for only one ruleset
      mockDb.addSegments([
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
          ref_id: 'ruleset-2', // Only ruleset-2 has segments
          version: '1.0.0',
          active: true,
          content: 'Use Pathfinder rules for skills.',
          metadata: {}
        }
      ]);

      // Mock multiple rulesets, but only one has segments
      const originalGetRulesetsForEntry = mockDb.getRulesetsForEntry;
      mockDb.getRulesetsForEntry = async (entryId: string) => {
        if (entryId === 'entry-1') {
          return [
            { id: 'ruleset-1', name: 'D&D Combat', sort_order: 0 },
            { id: 'ruleset-2', name: 'Pathfinder Skills', sort_order: 1 }
          ];
        }
        return [];
      };

      const args: AssembleArgs = {
        entryPointId: 'entry-1',
        worldId: 'world-1'
      };

      const result = await assemblePrompt(args, mockDb);

      expect(result.prompt).toContain('Use Pathfinder rules for skills.');
      expect(result.meta.segmentIdsByScope.ruleset).toEqual([2]);
    });

    it('should handle ruleset assembly errors gracefully', async () => {
      mockDb.addSegments([
        {
          id: 1,
          scope: 'core',
          ref_id: null,
          version: '1.0.0',
          active: true,
          content: 'You are a helpful AI game master.',
          metadata: {}
        }
      ]);

      // Mock rulesets that cause errors
      const originalGetRulesetsForEntry = mockDb.getRulesetsForEntry;
      mockDb.getRulesetsForEntry = async () => {
        throw new Error('Database connection failed');
      };

      const args: AssembleArgs = {
        entryPointId: 'entry-1',
        worldId: 'world-1'
      };

      await expect(assemblePrompt(args, mockDb)).rejects.toThrow('Database connection failed');
    });
  });

  describe('ruleset block formatting', () => {
    it('should format multiple ruleset segments in a single block', async () => {
      mockDb.addSegments([
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
          ref_id: 'ruleset-1',
          version: '1.0.0',
          active: true,
          content: 'Combat uses d20 rolls.',
          metadata: {}
        },
        {
          id: 3,
          scope: 'ruleset',
          ref_id: 'ruleset-2',
          version: '1.0.0',
          active: true,
          content: 'Skills use d100 rolls.',
          metadata: {}
        }
      ]);

      const originalGetRulesetsForEntry = mockDb.getRulesetsForEntry;
      mockDb.getRulesetsForEntry = async (entryId: string) => {
        if (entryId === 'entry-1') {
          return [
            { id: 'ruleset-1', name: 'D&D Combat', sort_order: 0 },
            { id: 'ruleset-2', name: 'Pathfinder Skills', sort_order: 1 }
          ];
        }
        return [];
      };

      const args: AssembleArgs = {
        entryPointId: 'entry-1',
        worldId: 'world-1'
      };

      const result = await assemblePrompt(args, mockDb);

      // Check that ruleset content is in a single block
      const rulesetBlockMatch = result.prompt.match(/## Ruleset\n\n([\s\S]*?)(?=##|$)/);
      expect(rulesetBlockMatch).toBeTruthy();
      
      const rulesetContent = rulesetBlockMatch![1];
      expect(rulesetContent).toContain('Combat uses d20 rolls.');
      expect(rulesetContent).toContain('Skills use d100 rolls.');
    });
  });

  describe('performance with many rulesets', () => {
    it('should handle large numbers of rulesets efficiently', async () => {
      const rulesetCount = 10;
      const segments = [
        {
          id: 1,
          scope: 'core',
          ref_id: null,
          version: '1.0.0',
          active: true,
          content: 'You are a helpful AI game master.',
          metadata: {}
        }
      ];

      // Add segments for many rulesets
      for (let i = 1; i <= rulesetCount; i++) {
        segments.push({
          id: i + 1,
          scope: 'ruleset',
          ref_id: `ruleset-${i}`,
          version: '1.0.0',
          active: true,
          content: `Ruleset ${i} content.`,
          metadata: {}
        });
      }

      mockDb.addSegments(segments);

      const originalGetRulesetsForEntry = mockDb.getRulesetsForEntry;
      mockDb.getRulesetsForEntry = async (entryId: string) => {
        if (entryId === 'entry-1') {
          return Array.from({ length: rulesetCount }, (_, i) => ({
            id: `ruleset-${i + 1}`,
            name: `Ruleset ${i + 1}`,
            sort_order: i
          }));
        }
        return [];
      };

      const args: AssembleArgs = {
        entryPointId: 'entry-1',
        worldId: 'world-1'
      };

      const startTime = Date.now();
      const result = await assemblePrompt(args, mockDb);
      const endTime = Date.now();

      expect(result.meta.segmentIdsByScope.ruleset).toHaveLength(rulesetCount);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});











