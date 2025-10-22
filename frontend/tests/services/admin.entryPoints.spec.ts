/**
 * Entry Points Service Tests
 * Phase 3: Tests for the entry points service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { entryPointsService } from '@/services/admin.entryPoints';

// Mock Supabase
const mockSupabase = {
  auth: {
    getSession: vi.fn()
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn()
      })),
      in: vi.fn(() => ({
        order: vi.fn(() => ({
          range: vi.fn()
        }))
      })),
      order: vi.fn(() => ({
        range: vi.fn()
      })),
      textSearch: vi.fn(() => ({
        range: vi.fn()
      })),
      overlaps: vi.fn(() => ({
        range: vi.fn()
      }))
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn()
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn()
    })),
    upsert: vi.fn()
  }))
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

describe('Entry Points Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful auth session
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'mock-token',
          user: { id: 'user-1' }
        }
      }
    });
  });

  describe('listEntryPoints', () => {
    it('fetches entry points with filters', async () => {
      const mockData = [
        { id: 'entry-1', title: 'Test Adventure' },
        { id: 'entry-2', title: 'Another Adventure' }
      ];

      const mockQuery = {
        range: vi.fn().mockResolvedValue({
          data: mockData,
          error: null,
          count: 2
        })
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({
                data: mockData,
                error: null,
                count: 2
              })
            })
          })
        })
      });

      const result = await entryPointsService.listEntryPoints({
        lifecycle: ['draft'],
        visibility: ['public']
      });

      expect(result.data).toEqual(mockData);
      expect(result.count).toBe(2);
    });

    it('handles search queries', async () => {
      const mockData = [{ id: 'entry-1', title: 'Test Adventure' }];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          textSearch: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: mockData,
              error: null,
              count: 1
            })
          })
        })
      });

      const result = await entryPointsService.listEntryPoints({
        search: 'test'
      });

      expect(result.data).toEqual(mockData);
    });

    it('handles errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
              count: 0
            })
          })
        })
      });

      await expect(entryPointsService.listEntryPoints()).rejects.toThrow('Failed to fetch entry points');
    });
  });

  describe('getEntryPoint', () => {
    it('fetches a single entry point', async () => {
      const mockEntryPoint = { id: 'entry-1', title: 'Test Adventure' };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockEntryPoint,
              error: null
            })
          })
        })
      });

      const result = await entryPointsService.getEntryPoint('entry-1');

      expect(result).toEqual(mockEntryPoint);
    });

    it('handles not found error', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' }
            })
          })
        })
      });

      await expect(entryPointsService.getEntryPoint('nonexistent')).rejects.toThrow('Failed to fetch entry point');
    });
  });

  describe('createEntryPoint', () => {
    it('creates a new entry point', async () => {
      const mockEntryPoint = { id: 'entry-1', title: 'Test Adventure' };
      const createData = {
        slug: 'test-adventure',
        type: 'adventure' as const,
        world_id: 'world-1',
        ruleset_id: 'ruleset-1',
        title: 'Test Adventure',
        description: 'A test adventure',
        tags: ['fantasy'],
        visibility: 'private' as const,
        content_rating: 'general'
      };

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockEntryPoint,
              error: null
            })
          })
        })
      });

      const result = await entryPointsService.createEntryPoint(createData);

      expect(result).toEqual(mockEntryPoint);
      expect(mockSupabase.from).toHaveBeenCalledWith('entry_points');
    });

    it('handles creation errors', async () => {
      const createData = {
        slug: 'test-adventure',
        type: 'adventure' as const,
        world_id: 'world-1',
        ruleset_id: 'ruleset-1',
        title: 'Test Adventure',
        description: 'A test adventure',
        tags: ['fantasy'],
        visibility: 'private' as const,
        content_rating: 'general'
      };

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Validation error' }
            })
          })
        })
      });

      await expect(entryPointsService.createEntryPoint(createData)).rejects.toThrow('Failed to create entry point');
    });
  });

  describe('updateEntryPoint', () => {
    it('updates an entry point', async () => {
      const mockEntryPoint = { id: 'entry-1', title: 'Updated Adventure' };
      const updateData = { title: 'Updated Adventure' };

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockEntryPoint,
                error: null
              })
            })
          })
        })
      });

      const result = await entryPointsService.updateEntryPoint('entry-1', updateData);

      expect(result).toEqual(mockEntryPoint);
    });

    it('handles update errors', async () => {
      const updateData = { title: 'Updated Adventure' };

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Update failed' }
              })
            })
          })
        })
      });

      await expect(entryPointsService.updateEntryPoint('entry-1', updateData)).rejects.toThrow('Failed to update entry point');
    });
  });

  describe('submitForReview', () => {
    it('submits entry point for review', async () => {
      // Mock successful update
      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              error: null
            })
          })
        })
      });

      // Mock successful upsert
      mockSupabase.from.mockReturnValueOnce({
        upsert: vi.fn().mockResolvedValue({
          error: null
        })
      });

      await entryPointsService.submitForReview('entry-1', 'Review note');

      expect(mockSupabase.from).toHaveBeenCalledWith('entry_points');
      expect(mockSupabase.from).toHaveBeenCalledWith('content_reviews');
    });

    it('handles submission errors', async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              error: { message: 'Update failed' }
            })
          })
        })
      });

      await expect(entryPointsService.submitForReview('entry-1')).rejects.toThrow('Failed to update lifecycle');
    });
  });

  describe('deleteEntryPoint', () => {
    it('deletes an entry point', async () => {
      mockSupabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null
          })
        })
      });

      await entryPointsService.deleteEntryPoint('entry-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('entry_points');
    });

    it('handles deletion errors', async () => {
      mockSupabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { message: 'Delete failed' }
          })
        })
      });

      await expect(entryPointsService.deleteEntryPoint('entry-1')).rejects.toThrow('Failed to delete entry point');
    });
  });

  describe('getWorlds', () => {
    it('fetches worlds list', async () => {
      const mockWorlds = [
        { id: 'world-1', doc: { name: 'Fantasy World' } },
        { id: 'world-2', doc: { name: 'Sci-Fi World' } }
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockWorlds,
            error: null
          })
        })
      });

      const result = await entryPointsService.getWorlds();

      expect(result).toEqual([
        { id: 'world-1', name: 'Fantasy World' },
        { id: 'world-2', name: 'Sci-Fi World' }
      ]);
    });
  });

  describe('getRulesets', () => {
    it('fetches rulesets list', async () => {
      const mockRulesets = [
        { id: 'ruleset-1', doc: { name: 'Standard Rules' } },
        { id: 'ruleset-2', doc: { name: 'Advanced Rules' } }
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockRulesets,
            error: null
          })
        })
      });

      const result = await entryPointsService.getRulesets();

      expect(result).toEqual([
        { id: 'ruleset-1', name: 'Standard Rules' },
        { id: 'ruleset-2', name: 'Advanced Rules' }
      ]);
    });
  });

  describe('authentication', () => {
    it('handles missing authentication', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null }
      });

      await expect(entryPointsService.listEntryPoints()).rejects.toThrow('No authentication token available');
    });
  });
});


