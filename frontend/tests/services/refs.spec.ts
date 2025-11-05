/**
 * Refs Service Tests
 * Test scope-filtered lookups for polymorphic pickers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchRefs, getRefById, getRefsByIds, getAllRefs, type RefScope } from '@/services/refs';

// Mock Supabase
const mockSupabase = {
  auth: {
    getSession: vi.fn()
  },
  from: vi.fn()
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

describe('Refs Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } }
    });
  });

  describe('searchRefs', () => {
    it('should search worlds by name and slug', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            { id: '1', name: 'Test World', slug: 'test-world' },
            { id: '2', name: 'Another World', slug: 'another-world' }
          ],
          error: null
        })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await searchRefs('world', 'test', 10);

      expect(mockSupabase.from).toHaveBeenCalledWith('worlds');
      expect(mockQuery.select).toHaveBeenCalledWith('id, name, slug');
      expect(mockQuery.or).toHaveBeenCalledWith('name.ilike.%test%,slug.ilike.%test%');
      expect(mockQuery.order).toHaveBeenCalledWith('name', { ascending: true });
      expect(mockQuery.limit).toHaveBeenCalledWith(10);

      expect(result).toEqual([
        { id: '1', name: 'Test World', slug: 'test-world' },
        { id: '2', name: 'Another World', slug: 'another-world' }
      ]);
    });

    it('should search rulesets by name and slug', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            { id: '1', name: 'D&D Rules', slug: 'dnd-rules' }
          ],
          error: null
        })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await searchRefs('ruleset', 'dnd', 5);

      expect(mockSupabase.from).toHaveBeenCalledWith('rulesets');
      expect(result).toEqual([
        { id: '1', name: 'D&D Rules', slug: 'dnd-rules' }
      ]);
    });

    it('should search NPCs with special field mapping', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            { id: '1', name: 'Test NPC', slug: '1' }
          ],
          error: null
        })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await searchRefs('npc', 'test', 10);

      expect(mockSupabase.from).toHaveBeenCalledWith('npcs');
      expect(mockQuery.select).toHaveBeenCalledWith('id, doc->npc->name as name, id as slug');
      expect(result).toEqual([
        { id: '1', name: 'Test NPC', slug: '1' }
      ]);
    });

    it('should handle search errors', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      await expect(searchRefs('world', 'test')).rejects.toThrow('Failed to search worlds: Database error');
    });

    it('should handle missing authentication', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null }
      });

      await expect(searchRefs('world', 'test')).rejects.toThrow('No authentication token available');
    });
  });

  describe('getRefById', () => {
    it('should get a world by ID', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: '1', name: 'Test World', slug: 'test-world' },
          error: null
        })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getRefById('world', '1');

      expect(mockSupabase.from).toHaveBeenCalledWith('worlds');
      expect(mockQuery.eq).toHaveBeenCalledWith('id', '1');
      expect(result).toEqual({ id: '1', name: 'Test World', slug: 'test-world' });
    });

    it('should return null for not found', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getRefById('world', '999');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      await expect(getRefById('world', '1')).rejects.toThrow('Failed to get world: Database error');
    });
  });

  describe('getRefsByIds', () => {
    it('should get multiple worlds by IDs', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            { id: '1', name: 'World 1', slug: 'world-1' },
            { id: '2', name: 'World 2', slug: 'world-2' }
          ],
          error: null
        })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getRefsByIds('world', ['1', '2']);

      expect(mockSupabase.from).toHaveBeenCalledWith('worlds');
      expect(mockQuery.in).toHaveBeenCalledWith('id', ['1', '2']);
      expect(result).toEqual([
        { id: '1', name: 'World 1', slug: 'world-1' },
        { id: '2', name: 'World 2', slug: 'world-2' }
      ]);
    });

    it('should return empty array for empty IDs', async () => {
      const result = await getRefsByIds('world', []);
      expect(result).toEqual([]);
    });
  });

  describe('getAllRefs', () => {
    it('should get all worlds without filters', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            { id: '1', name: 'World 1', slug: 'world-1' }
          ],
          error: null
        })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getAllRefs('world');

      expect(mockSupabase.from).toHaveBeenCalledWith('worlds');
      expect(mockQuery.order).toHaveBeenCalledWith('name', { ascending: true });
      expect(result).toEqual([
        { id: '1', name: 'World 1', slug: 'world-1' }
      ]);
    });

    it('should apply filters for rulesets', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      await getAllRefs('ruleset', { active: true });

      expect(mockSupabase.from).toHaveBeenCalledWith('rulesets');
      expect(mockQuery.eq).toHaveBeenCalledWith('active', true);
    });

    it('should apply world filter for NPCs', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      await getAllRefs('npc', { worldId: 'world-1' });

      expect(mockSupabase.from).toHaveBeenCalledWith('npcs');
      expect(mockQuery.eq).toHaveBeenCalledWith('doc->npc->world_id', 'world-1');
    });

    it('should apply status filter for entries', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      await getAllRefs('entry', { status: 'active' });

      expect(mockSupabase.from).toHaveBeenCalledWith('entry_points');
      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'active');
    });
  });

  describe('error handling', () => {
    it('should handle unsupported scope', async () => {
      await expect(searchRefs('invalid' as RefScope, 'test')).rejects.toThrow('Unsupported scope: invalid');
    });

    it('should provide fallback names for missing data', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            { id: '1', name: null, slug: null }
          ],
          error: null
        })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await searchRefs('world', 'test');

      expect(result).toEqual([
        { id: '1', name: 'Unnamed world', slug: '1' }
      ]);
    });
  });
});














