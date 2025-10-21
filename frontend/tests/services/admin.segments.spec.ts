/**
 * Segments Service Tests
 * Phase 4: Tests for the global segments service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { segmentsService } from '@/services/admin.segments';

// Mock Supabase
const mockSupabase = {
  auth: {
    getSession: vi.fn()
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      in: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        }))
      })),
      order: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      })),
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        }))
      })),
      or: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      }))
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: {},
          error: null
        })
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: {},
            error: null
          })
        }))
      }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({
        error: null
      })
    })),
    upsert: vi.fn().mockResolvedValue({
      error: null
    })
  })),
  rpc: vi.fn(() => ({
    data: [],
    error: null
  }))
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

describe('Segments Service', () => {
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

  describe('listSegments', () => {
    it('fetches segments with filters', async () => {
      const mockSegments = [
        { id: 'segment-1', scope: 'core', content: 'Test content' },
        { id: 'segment-2', scope: 'entry', content: 'Entry content' }
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: mockSegments,
                error: null
              })
            })
          })
        })
      });

      const result = await segmentsService.listSegments({
        scope: ['core', 'entry'],
        active: true
      });

      expect(result.data).toEqual(mockSegments);
      expect(result.hasMore).toBe(false);
    });

    it('handles search queries', async () => {
      const mockSegments = [{ id: 'segment-1', content: 'Test content' }];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockSegments,
              error: null
            })
          })
        })
      });

      const result = await segmentsService.listSegments({
        q: 'test'
      });

      expect(result.data).toEqual(mockSegments);
    });

    it('handles pagination with cursor', async () => {
      const mockSegments = Array(21).fill(null).map((_, i) => ({
        id: `segment-${i}`,
        updated_at: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`
      }));

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockSegments,
              error: null
            })
          })
        })
      });

      const result = await segmentsService.listSegments({
        cursor: '2024-01-01T00:00:00Z'
      });

      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();
    });

    it('handles errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      });

      await expect(segmentsService.listSegments()).rejects.toThrow('Failed to fetch segments');
    });
  });

  describe('getAvailableLocales', () => {
    it('fetches available locales from segments', async () => {
      const mockData = [
        { metadata: { locale: 'en' } },
        { metadata: { locale: 'es' } },
        { metadata: { locale: 'fr' } },
        { metadata: {} } // No locale
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({
            data: mockData,
            error: null
          })
        })
      });

      const result = await segmentsService.getAvailableLocales();

      expect(result).toEqual(['en', 'es', 'fr']);
    });
  });

  describe('findNearDuplicates', () => {
    it('finds duplicate segments using RPC', async () => {
      const mockDuplicates = [
        { id: 'segment-2', content: 'Similar content', similarity: 0.9 }
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockDuplicates,
        error: null
      });

      const result = await segmentsService.findNearDuplicates({
        scope: 'core',
        refId: undefined,
        contentHash: 'hash123',
        excludeId: 'segment-1'
      });

      expect(result).toEqual(mockDuplicates);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('find_segment_duplicates', {
        p_scope: 'core',
        p_ref_id: null,
        p_content_hash: 'hash123',
        p_exclude_id: 'segment-1'
      });
    });
  });

  describe('computeContentHash', () => {
    it('computes consistent hash for same content', () => {
      const content = 'Test content for hashing';
      const hash1 = segmentsService.computeContentHash(content);
      const hash2 = segmentsService.computeContentHash(content);

      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
    });

    it('computes different hashes for different content', () => {
      const hash1 = segmentsService.computeContentHash('Content 1');
      const hash2 = segmentsService.computeContentHash('Content 2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('cloneToLocale', () => {
    it('clones segment with new locale', async () => {
      const originalSegment = {
        id: 'segment-1',
        scope: 'core',
        content: 'Original content',
        metadata: { locale: 'en', kind: 'baseline' }
      };

      const clonedSegment = {
        ...originalSegment,
        id: 'segment-2',
        metadata: { locale: 'es', kind: 'baseline' }
      };

      // Mock getSegment
      vi.spyOn(segmentsService, 'getSegment').mockResolvedValue(originalSegment as any);
      
      // Mock createSegment
      vi.spyOn(segmentsService, 'createSegment').mockResolvedValue(clonedSegment as any);

      const result = await segmentsService.cloneToLocale('segment-1', 'es');

      expect(result).toEqual(clonedSegment);
      expect(segmentsService.createSegment).toHaveBeenCalledWith({
        scope: 'core',
        content: 'Original content',
        metadata: { locale: 'es', kind: 'baseline' }
      });
    });
  });

  describe('bulkToggleActive', () => {
    it('toggles active status for multiple segments', async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            error: null
          })
        })
      });

      await segmentsService.bulkToggleActive(['segment-1', 'segment-2'], true);

      expect(mockSupabase.from).toHaveBeenCalledWith('prompt_segments');
    });
  });

  describe('exportSegments', () => {
    it('exports selected segments to JSON format', async () => {
      const mockSegments = [
        { id: 'segment-1', scope: 'core', content: 'Content 1' },
        { id: 'segment-2', scope: 'entry', content: 'Content 2' }
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: mockSegments,
            error: null
          })
        })
      });

      const result = await segmentsService.exportSegments(['segment-1', 'segment-2']);

      expect(result).toEqual(mockSegments);
    });
  });

  describe('importSegments', () => {
    it('imports segments from JSON data', async () => {
      const segmentsToImport = [
        { id: 'segment-1', scope: 'core', content: 'Content 1' },
        { id: 'segment-2', scope: 'entry', content: 'Content 2' }
      ];

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: segmentsToImport,
            error: null
          })
        })
      });

      const result = await segmentsService.importSegments(segmentsToImport);

      expect(result).toEqual(segmentsToImport);
    });

    it('validates segment data before import', async () => {
      const invalidSegments = [
        { id: 'segment-1' }, // Missing scope and content
        { id: 'segment-2', scope: 'core' } // Missing content
      ];

      await expect(segmentsService.importSegments(invalidSegments)).rejects.toThrow(
        'Invalid segment data: missing required fields'
      );
    });
  });

  describe('authentication', () => {
    it('handles missing authentication', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null }
      });

      await expect(segmentsService.listSegments()).rejects.toThrow('No authentication token available');
    });
  });
});
