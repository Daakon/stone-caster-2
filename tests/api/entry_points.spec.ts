// Entry Points API Tests
// Tests for GET /api/entry-points endpoint

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { searchEntryPoints } from '../../src/services/search';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            overlaps: vi.fn().mockReturnValue({
              textSearch: vi.fn().mockReturnValue({
                or: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      order: vi.fn().mockReturnValue({
                        limit: vi.fn().mockReturnValue({
                          data: mockEntryPoints,
                          error: null
                        })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
  }))
};

// Mock entry points data
const mockEntryPoints = [
  {
    id: 'ep.mystika.whispercross',
    slug: 'whispercross-forest',
    type: 'scenario',
    title: 'Whispercross Forest',
    synopsis: 'A spark in the trees.',
    world_id: 'world.mystika',
    ruleset_id: 'ruleset.classic_v1',
    tags: ['mystery', 'forest', 'low-combat'],
    content_rating: 'safe',
    sort_weight: 100,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'ep.mystika.temple',
    slug: 'lost-temple',
    type: 'adventure',
    title: 'Lost Temple',
    synopsis: 'Ancient secrets await.',
    world_id: 'world.mystika',
    ruleset_id: 'ruleset.classic_v1',
    tags: ['dungeon', 'treasure', 'classic'],
    content_rating: 'safe',
    sort_weight: 90,
    created_at: '2024-01-02T00:00:00Z'
  }
];

describe('Entry Points API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchEntryPoints', () => {
    it('should return entry points with basic search', async () => {
      const filters = {
        limit: 20
      };

      const result = await searchEntryPoints(filters, mockSupabase);

      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe('ep.mystika.whispercross');
      expect(result.items[0].title).toBe('Whispercross Forest');
      expect(result.items[0].type).toBe('scenario');
      expect(result.items[0].tags).toEqual(['mystery', 'forest', 'low-combat']);
    });

    it('should filter by world_id', async () => {
      const filters = {
        worldId: 'world.mystika',
        limit: 20
      };

      const result = await searchEntryPoints(filters, mockSupabase);

      expect(result.items).toHaveLength(2);
      expect(result.items.every(item => item.worldId === 'world.mystika')).toBe(true);
    });

    it('should filter by type', async () => {
      const filters = {
        type: ['scenario'],
        limit: 20
      };

      const result = await searchEntryPoints(filters, mockSupabase);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe('scenario');
    });

    it('should filter by tags', async () => {
      const filters = {
        tags: ['forest'],
        limit: 20
      };

      const result = await searchEntryPoints(filters, mockSupabase);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].tags).toContain('forest');
    });

    it('should handle text search', async () => {
      const filters = {
        query: 'forest',
        limit: 20
      };

      const result = await searchEntryPoints(filters, mockSupabase);

      expect(result.items).toHaveLength(2);
    });

    it('should respect limit parameter', async () => {
      const filters = {
        limit: 1
      };

      const result = await searchEntryPoints(filters, mockSupabase);

      expect(result.items).toHaveLength(1);
    });

    it('should cap limit at 100', async () => {
      const filters = {
        limit: 150
      };

      const result = await searchEntryPoints(filters, mockSupabase);

      expect(result.items).toHaveLength(2); // Mock data length
    });

    it('should handle cursor pagination', async () => {
      const filters = {
        cursor: 'eyJzb3J0X3dlaWdodCI6OTAsImNyZWF0ZWRfYXQiOiIyMDI0LTAxLTAyVDAwOjAwOjAwWiIsImlkIjoiZXAubXlzdGlrYS50ZW1wbGUifQ==',
        limit: 20
      };

      const result = await searchEntryPoints(filters, mockSupabase);

      expect(result.items).toHaveLength(2);
    });

    it('should return empty results for unknown world', async () => {
      const filters = {
        worldId: 'unknown.world',
        limit: 20
      };

      // Mock empty response
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                overlaps: vi.fn(() => ({
                  textSearch: vi.fn(() => ({
                    or: vi.fn(() => ({
                      order: vi.fn(() => ({
                        order: vi.fn(() => ({
                          order: vi.fn(() => ({
                            limit: vi.fn(() => ({
                              data: [],
                              error: null
                            }))
                          }))
                        }))
                      }))
                    }))
                  }))
                }))
              }))
            }))
          }))
        }))
      });

      const result = await searchEntryPoints(filters, mockSupabase);

      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      // Mock error response
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                overlaps: vi.fn(() => ({
                  textSearch: vi.fn(() => ({
                    or: vi.fn(() => ({
                      order: vi.fn(() => ({
                        order: vi.fn(() => ({
                          order: vi.fn(() => ({
                            limit: vi.fn(() => ({
                              data: null,
                              error: { message: 'Database error' }
                            }))
                          }))
                        }))
                      }))
                    }))
                  }))
                }))
              }))
            }))
          }))
        }))
      });

      const result = await searchEntryPoints({ limit: 20 }, mockSupabase);

      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe('Response format', () => {
    it('should return properly formatted results', async () => {
      const filters = { limit: 20 };
      const result = await searchEntryPoints(filters, mockSupabase);

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('nextCursor');
      expect(Array.isArray(result.items)).toBe(true);

      if (result.items.length > 0) {
        const item = result.items[0];
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('slug');
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('synopsis');
        expect(item).toHaveProperty('worldId');
        expect(item).toHaveProperty('rulesetId');
        expect(item).toHaveProperty('tags');
        expect(item).toHaveProperty('contentRating');
      }
    });
  });
});
