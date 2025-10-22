/**
 * Admin Segments Service Tests
 * Tests for segment scope validation and CRUD operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { segmentsService } from '@/services/admin.segments';
import { assertAllowedScope, isDeprecatedScope, validateSegmentData } from '@/services/validation';

// Mock Supabase
const mockSupabase = {
  auth: {
    getSession: vi.fn()
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              offset: vi.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        }))
      }))
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: {}, error: null }))
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: {}, error: null }))
        }))
      }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  }))
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

describe('Segment Scope Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } }
    });
  });

  describe('assertAllowedScope', () => {
    it('should allow valid scopes', () => {
      const validScopes = ['core', 'ruleset', 'world', 'entry', 'entry_start', 'npc'];
      
      validScopes.forEach(scope => {
        expect(() => assertAllowedScope(scope)).not.toThrow();
      });
    });

    it('should reject deprecated scopes', () => {
      const deprecatedScopes = ['game_state', 'player', 'rng', 'input'];
      
      deprecatedScopes.forEach(scope => {
        expect(() => assertAllowedScope(scope)).toThrow();
      });
    });

    it('should throw error with correct code for deprecated scopes', () => {
      try {
        assertAllowedScope('game_state');
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('SEGMENT_SCOPE_INVALID');
        expect(error.message).toContain('deprecated');
      }
    });
  });

  describe('isDeprecatedScope', () => {
    it('should identify deprecated scopes', () => {
      expect(isDeprecatedScope('game_state')).toBe(true);
      expect(isDeprecatedScope('player')).toBe(true);
      expect(isDeprecatedScope('rng')).toBe(true);
      expect(isDeprecatedScope('input')).toBe(true);
    });

    it('should identify allowed scopes as not deprecated', () => {
      const allowedScopes = ['core', 'ruleset', 'world', 'entry', 'entry_start', 'npc'];
      
      allowedScopes.forEach(scope => {
        expect(isDeprecatedScope(scope)).toBe(false);
      });
    });
  });

  describe('validateSegmentData', () => {
    it('should validate allowed scopes', () => {
      const validData = {
        scope: 'core',
        content: 'Test content',
        ref_id: ''
      };

      expect(() => validateSegmentData(validData)).not.toThrow();
    });

    it('should reject deprecated scopes', () => {
      const invalidData = {
        scope: 'game_state',
        content: 'Test content',
        ref_id: 'test-id'
      };

      expect(() => validateSegmentData(invalidData)).toThrow();
    });

    it('should require content', () => {
      const invalidData = {
        scope: 'core',
        content: '',
        ref_id: ''
      };

      expect(() => validateSegmentData(invalidData)).toThrow();
    });

    it('should require ref_id for non-core scopes', () => {
      const invalidData = {
        scope: 'ruleset',
        content: 'Test content',
        ref_id: ''
      };

      expect(() => validateSegmentData(invalidData)).toThrow();
    });

    it('should not require ref_id for core scope', () => {
      const validData = {
        scope: 'core',
        content: 'Test content',
        ref_id: ''
      };

      expect(() => validateSegmentData(validData)).not.toThrow();
    });

    it('should reject ref_id for core scope', () => {
      const invalidData = {
        scope: 'core',
        content: 'Test content',
        ref_id: 'test-id'
      };

      expect(() => validateSegmentData(invalidData)).toThrow();
    });

    it('should enforce content length limit', () => {
      const invalidData = {
        scope: 'core',
        content: 'x'.repeat(10001),
        ref_id: ''
      };

      expect(() => validateSegmentData(invalidData)).toThrow();
    });
  });

  describe('SegmentsService', () => {
    it('should reject deprecated scopes in createSegment', async () => {
      const invalidData = {
        scope: 'game_state' as any,
        content: 'Test content',
        ref_id: 'test-id'
      };

      await expect(segmentsService.createSegment(invalidData)).rejects.toThrow();
    });

    it('should reject deprecated scopes in updateSegment', async () => {
      const invalidData = {
        scope: 'player' as any,
        content: 'Test content',
        ref_id: 'test-id'
      };

      await expect(segmentsService.updateSegment('test-id', invalidData)).rejects.toThrow();
    });

    it('should allow valid scopes in createSegment', async () => {
      const validData = {
        scope: 'core' as const,
        content: 'Test content'
      };

      await expect(segmentsService.createSegment(validData)).resolves.toBeDefined();
    });
  });
});
