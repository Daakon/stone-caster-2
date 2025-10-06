import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IdempotencyService } from './idempotency.service.js';
import { ApiErrorCode } from '@shared';

// Mock Supabase
vi.mock('./supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn()
              }))
            }))
          }))
        }))
      }))
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn()
      }))
    }))
  }
}));

describe('IdempotencyService', () => {
  let mockSupabase: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { supabaseAdmin } = await import('./supabase.js');
    mockSupabase = vi.mocked(supabaseAdmin);
  });

  describe('checkIdempotency', () => {
    it('should return not duplicate when no existing record found', async () => {
      // Mock no existing record
      const mockQuery = {
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' } // No rows returned
        })
      };
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue(mockQuery)
              })
            })
          })
        })
      } as any);

      const result = await IdempotencyService.checkIdempotency(
        'test-key',
        'user-123',
        'game-456',
        'turn'
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.existingRecord).toBeUndefined();
    });

    it('should return duplicate when existing record found', async () => {
      const mockRecord = {
        id: 'record-123',
        key: 'test-key',
        owner_id: 'user-123',
        game_id: 'game-456',
        operation: 'turn',
        request_hash: 'hash-123',
        response_data: { test: 'data' },
        status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
        completed_at: '2024-01-01T00:00:00Z'
      };

      const mockQuery = {
        single: vi.fn().mockResolvedValue({
          data: mockRecord,
          error: null
        })
      };
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue(mockQuery)
              })
            })
          })
        })
      } as any);

      const result = await IdempotencyService.checkIdempotency(
        'test-key',
        'user-123',
        'game-456',
        'turn'
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.existingRecord).toEqual({
        id: 'record-123',
        key: 'test-key',
        ownerId: 'user-123',
        gameId: 'game-456',
        operation: 'turn',
        requestHash: 'hash-123',
        responseData: { test: 'data' },
        status: 'completed',
        createdAt: '2024-01-01T00:00:00Z',
        completedAt: '2024-01-01T00:00:00Z'
      });
    });

    it('should return error when database error occurs', async () => {
      const mockQuery = {
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'OTHER_ERROR', message: 'Database error' }
        })
      };
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue(mockQuery)
              })
            })
          })
        })
      } as any);

      const result = await IdempotencyService.checkIdempotency(
        'test-key',
        'user-123',
        'game-456',
        'turn'
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.error).toBe(ApiErrorCode.INTERNAL_ERROR);
      expect(result.message).toBe('Failed to check idempotency');
    });
  });

  describe('storeIdempotencyRecord', () => {
    it('should store idempotency record successfully', async () => {
      const mockRecord = {
        id: 'record-123',
        key: 'test-key',
        owner_id: 'user-123',
        game_id: 'game-456',
        operation: 'turn',
        request_hash: 'hash-123',
        response_data: { test: 'data' },
        status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
        completed_at: '2024-01-01T00:00:00Z'
      };

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockRecord,
              error: null
            })
          })
        })
      } as any);

      const result = await IdempotencyService.storeIdempotencyRecord(
        'test-key',
        'user-123',
        'game-456',
        'turn',
        'hash-123',
        { test: 'data' },
        'completed'
      );

      expect(result).toEqual({
        id: 'record-123',
        key: 'test-key',
        ownerId: 'user-123',
        gameId: 'game-456',
        operation: 'turn',
        requestHash: 'hash-123',
        responseData: { test: 'data' },
        status: 'completed',
        createdAt: '2024-01-01T00:00:00Z',
        completedAt: '2024-01-01T00:00:00Z'
      });
    });

    it('should throw error when database insert fails', async () => {
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Insert failed' }
            })
          })
        })
      } as any);

      await expect(
        IdempotencyService.storeIdempotencyRecord(
          'test-key',
          'user-123',
          'game-456',
          'turn',
          'hash-123',
          { test: 'data' },
          'completed'
        )
      ).rejects.toThrow('Failed to store idempotency record: Insert failed');
    });
  });

  describe('createRequestHash', () => {
    it('should create consistent hash for same data', () => {
      const data1 = { optionId: 'test-123', gameId: 'game-456' };
      const data2 = { optionId: 'test-123', gameId: 'game-456' };
      
      const hash1 = IdempotencyService.createRequestHash(data1);
      const hash2 = IdempotencyService.createRequestHash(data2);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex format
    });

    it('should create different hashes for different data', () => {
      const data1 = { optionId: 'test-123' };
      const data2 = { optionId: 'test-456' };
      
      const hash1 = IdempotencyService.createRequestHash(data1);
      const hash2 = IdempotencyService.createRequestHash(data2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle different property order consistently', () => {
      const data1 = { optionId: 'test-123', gameId: 'game-456' };
      const data2 = { gameId: 'game-456', optionId: 'test-123' };
      
      const hash1 = IdempotencyService.createRequestHash(data1);
      const hash2 = IdempotencyService.createRequestHash(data2);
      
      expect(hash1).toBe(hash2);
    });
  });
});
