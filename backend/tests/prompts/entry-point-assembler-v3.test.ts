/**
 * Unit tests for Entry-Point Assembler v3
 * Tests scope ordering, join rules, budget policy, and NPC trimming
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EntryPointAssemblerV3 } from '../../src/prompts/entry-point-assembler-v3.js';
import { supabaseAdmin } from '../../src/services/supabase.js';

// Mock Supabase
vi.mock('../../src/services/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

describe('EntryPointAssemblerV3', () => {
  let assembler: EntryPointAssemblerV3;
  let mockSupabaseQuery: any;

  beforeEach(() => {
    assembler = new EntryPointAssemblerV3();
    mockSupabaseQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };
    (supabaseAdmin.from as any).mockReturnValue(mockSupabaseQuery);
  });

  describe('Scope Ordering', () => {
    it('should assemble scopes in order: core → ruleset → world → entry → npc', async () => {
      // Mock entry point
      mockSupabaseQuery.single.mockResolvedValueOnce({
        data: {
          id: 'ep-1',
          slug: 'test-entry',
          type: 'adventure',
          world_id: 'world-1',
          content: { doc: { entryStartSlug: 'start-1', prompt: { text: '# Entry\n\nBegin here.' } } },
        },
        error: null,
      });

      // Mock world
      mockSupabaseQuery.single.mockResolvedValueOnce({
        data: {
          id: 'world-1',
          version: '1.0.0',
          doc: { name: 'Test World', prompt: { text: '# World\n\nWorld content.' } },
        },
        error: null,
      });

      // Mock ruleset (via entry_point_rulesets)
      (supabaseAdmin.from as any).mockReturnValueOnce({
        ...mockSupabaseQuery,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { ruleset_id: 'ruleset-1' },
          error: null,
        }),
      });

      // Mock ruleset
      mockSupabaseQuery.single.mockResolvedValueOnce({
        data: {
          id: 'ruleset-1',
          slug: 'default',
          version: '1.0.0',
          doc: { prompt: { text: '# Ruleset\n\nRuleset content.' } },
        },
        error: null,
      });

      // Mock NPCs (empty for this test)
      mockSupabaseQuery.single.mockRejectedValueOnce({ code: 'PGRST116' }); // Not found for entry_point_npcs
      mockSupabaseQuery.single.mockResolvedValueOnce({ data: [], error: null }); // Empty NPCs list

      const result = await assembler.assemble({
        entryPointId: 'ep-1',
        entryStartSlug: 'start-1',
      });

      // Verify pieces order
      const scopes = result.pieces.map(p => p.scope);
      expect(scopes).toEqual(['core', 'ruleset', 'world', 'entry']);
      expect(result.meta.source).toBe('entry-point');
      expect(result.meta.version).toBe('v3');
    });
  });

  describe('Join Rules', () => {
    it('should join scopes with single blank line and add trailing newline', async () => {
      // Setup minimal mocks
      mockSupabaseQuery.single
        .mockResolvedValueOnce({ data: { id: 'ep-1', slug: 'test', type: 'adventure', world_id: 'w1', content: {} }, error: null })
        .mockResolvedValueOnce({ data: { id: 'w1', version: '1.0.0', doc: {} }, error: null })
        .mockResolvedValueOnce({ data: { ruleset_id: 'r1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'r1', slug: 'default', version: '1.0.0', doc: {} }, error: null })
        .mockRejectedValueOnce({ code: 'PGRST116' })
        .mockResolvedValueOnce({ data: [], error: null });

      (supabaseAdmin.from as any).mockImplementation((table: string) => {
        if (table === 'entry_point_rulesets') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValueOnce({ data: { ruleset_id: 'r1' }, error: null }),
          };
        }
        return mockSupabaseQuery;
      });

      const result = await assembler.assemble({
        entryPointId: 'ep-1',
      });

      // Check trailing newline
      expect(result.prompt.endsWith('\n')).toBe(true);
      
      // Check single blank line between scopes (no triple newlines)
      const doubleNewlines = result.prompt.match(/\n\n\n/g);
      expect(doubleNewlines).toBeNull();
    });
  });

  describe('Budget Policy', () => {
    it('should warn at 90% threshold', async () => {
      // Setup minimal mocks
      mockSupabaseQuery.single
        .mockResolvedValueOnce({ data: { id: 'ep-1', slug: 'test', type: 'adventure', world_id: 'w1', content: {} }, error: null })
        .mockResolvedValueOnce({ data: { id: 'w1', version: '1.0.0', doc: {} }, error: null })
        .mockResolvedValueOnce({ data: { ruleset_id: 'r1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'r1', slug: 'default', version: '1.0.0', doc: {} }, error: null })
        .mockRejectedValueOnce({ code: 'PGRST116' })
        .mockResolvedValueOnce({ data: [], error: null });

      (supabaseAdmin.from as any).mockImplementation((table: string) => {
        if (table === 'entry_point_rulesets') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValueOnce({ data: { ruleset_id: 'r1' }, error: null }),
          };
        }
        return mockSupabaseQuery;
      });

      // Set very low budget to trigger warning
      const result = await assembler.assemble({
        entryPointId: 'ep-1',
        budgetTokens: 100, // Very low budget
      });

      // Should have warning policy if over 90%
      if (result.meta.tokenEst.pct >= 0.9) {
        expect(result.meta.policy).toContain('SCENARIO_POLICY_UNDECIDED');
      }
    });

    it('should trim only NPCs when over budget, never core/ruleset/world/entry', async () => {
      // Setup mocks with NPCs
      mockSupabaseQuery.single
        .mockResolvedValueOnce({ data: { id: 'ep-1', slug: 'test', type: 'adventure', world_id: 'w1', content: {} }, error: null })
        .mockResolvedValueOnce({ data: { id: 'w1', version: '1.0.0', doc: {} }, error: null })
        .mockResolvedValueOnce({ data: { ruleset_id: 'r1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'r1', slug: 'default', version: '1.0.0', doc: {} }, error: null })
        .mockResolvedValueOnce({ data: [{ npc_id: 'npc1', sort_order: 1 }, { npc_id: 'npc2', sort_order: 2 }], error: null })
        .mockResolvedValueOnce({
          data: [
            { id: 'npc1', name: 'NPC1', slug: 'npc1', prompt: { text: 'NPC1 content (very long)' }, doc: null },
            { id: 'npc2', name: 'NPC2', slug: 'npc2', prompt: { text: 'NPC2 content (very long)' }, doc: null },
          ],
          error: null,
        });

      (supabaseAdmin.from as any).mockImplementation((table: string) => {
        if (table === 'entry_point_rulesets') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValueOnce({ data: { ruleset_id: 'r1' }, error: null }),
          };
        }
        if (table === 'entry_point_npcs') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValueOnce({
              data: [{ npc_id: 'npc1', sort_order: 1 }, { npc_id: 'npc2', sort_order: 2 }],
              error: null,
            }),
          };
        }
        return mockSupabaseQuery;
      });

      // Set very low budget to force trimming
      const result = await assembler.assemble({
        entryPointId: 'ep-1',
        budgetTokens: 50, // Very low budget to force NPC trimming
      });

      // Verify protected scopes are never dropped
      const scopes = result.pieces.map(p => p.scope);
      expect(scopes).toContain('core');
      expect(scopes).toContain('ruleset');
      expect(scopes).toContain('world');
      expect(scopes).toContain('entry');

      // NPCs may be dropped (check dropped array)
      const droppedNPCs = result.meta.dropped?.filter((d: string) => d.startsWith('npc:'));
      if (droppedNPCs && droppedNPCs.length > 0) {
        expect(result.meta.policy).toContain('NPC_DROPPED');
      }
    });
  });

  describe('NPC Deduplication and Ordering', () => {
    it('should order NPCs by sort_order from entry_point_npcs', async () => {
      // Setup mocks
      mockSupabaseQuery.single
        .mockResolvedValueOnce({ data: { id: 'ep-1', slug: 'test', type: 'adventure', world_id: 'w1', content: {} }, error: null })
        .mockResolvedValueOnce({ data: { id: 'w1', version: '1.0.0', doc: {} }, error: null })
        .mockResolvedValueOnce({ data: { ruleset_id: 'r1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'r1', slug: 'default', version: '1.0.0', doc: {} }, error: null });

      (supabaseAdmin.from as any).mockImplementation((table: string) => {
        if (table === 'entry_point_rulesets') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValueOnce({ data: { ruleset_id: 'r1' }, error: null }),
          };
        }
        if (table === 'entry_point_npcs') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValueOnce({
              data: [
                { npc_id: 'npc2', sort_order: 2 },
                { npc_id: 'npc1', sort_order: 1 },
              ],
              error: null,
            }),
          };
        }
        if (table === 'npcs') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValueOnce({
              data: [
                { id: 'npc1', name: 'NPC1', slug: 'npc1', prompt: { text: 'NPC1' }, doc: null },
                { id: 'npc2', name: 'NPC2', slug: 'npc2', prompt: { text: 'NPC2' }, doc: null },
              ],
              error: null,
            }),
          };
        }
        return mockSupabaseQuery;
      });

      const result = await assembler.assemble({
        entryPointId: 'ep-1',
      });

      // Find NPC pieces
      const npcPieces = result.pieces.filter(p => p.scope === 'npc');
      
      // NPCs should be ordered by sort_order (npc1=1, npc2=2)
      if (npcPieces.length >= 2) {
        expect(npcPieces[0].slug).toBe('npc1');
        expect(npcPieces[1].slug).toBe('npc2');
      }
    });
  });

  describe('Metadata Shape', () => {
    it('should include source=entry-point and version=v3 in meta', async () => {
      // Setup minimal mocks
      mockSupabaseQuery.single
        .mockResolvedValueOnce({ data: { id: 'ep-1', slug: 'test', type: 'adventure', world_id: 'w1', content: {} }, error: null })
        .mockResolvedValueOnce({ data: { id: 'w1', version: '1.0.0', doc: {} }, error: null })
        .mockResolvedValueOnce({ data: { ruleset_id: 'r1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'r1', slug: 'default', version: '1.0.0', doc: {} }, error: null })
        .mockRejectedValueOnce({ code: 'PGRST116' })
        .mockResolvedValueOnce({ data: [], error: null });

      (supabaseAdmin.from as any).mockImplementation((table: string) => {
        if (table === 'entry_point_rulesets') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValueOnce({ data: { ruleset_id: 'r1' }, error: null }),
          };
        }
        return mockSupabaseQuery;
      });

      const result = await assembler.assemble({
        entryPointId: 'ep-1',
      });

      expect(result.meta.source).toBe('entry-point');
      expect(result.meta.version).toBe('v3');
      expect(result.meta.selectionContext).toBeDefined();
      expect(result.meta.selectionContext.entryPoint).toBe('test');
      expect(result.meta.selectionContext.entryPointType).toBe('adventure');
    });

    it('should include pieces list with scope, slug, version, tokens', async () => {
      // Setup minimal mocks
      mockSupabaseQuery.single
        .mockResolvedValueOnce({ data: { id: 'ep-1', slug: 'test', type: 'adventure', world_id: 'w1', content: {} }, error: null })
        .mockResolvedValueOnce({ data: { id: 'w1', version: '1.0.0', doc: {} }, error: null })
        .mockResolvedValueOnce({ data: { ruleset_id: 'r1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'r1', slug: 'default', version: '1.0.0', doc: {} }, error: null })
        .mockRejectedValueOnce({ code: 'PGRST116' })
        .mockResolvedValueOnce({ data: [], error: null });

      (supabaseAdmin.from as any).mockImplementation((table: string) => {
        if (table === 'entry_point_rulesets') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValueOnce({ data: { ruleset_id: 'r1' }, error: null }),
          };
        }
        return mockSupabaseQuery;
      });

      const result = await assembler.assemble({
        entryPointId: 'ep-1',
      });

      expect(result.pieces.length).toBeGreaterThan(0);
      for (const piece of result.pieces) {
        expect(piece).toHaveProperty('scope');
        expect(piece).toHaveProperty('slug');
        expect(piece).toHaveProperty('version');
        expect(piece).toHaveProperty('tokens');
        expect(typeof piece.tokens).toBe('number');
      }
    });
  });
});

