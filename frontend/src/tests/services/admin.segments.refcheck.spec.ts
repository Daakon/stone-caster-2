/**
 * Admin Segments Reference Check Tests
 * Tests for segment reference validation in admin service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { segmentsService } from '@/services/admin.segments';
import { assertScopeRef, expectedRefTable } from '@/services/validation';

// Mock Supabase
const mockSupabase = {
  auth: {
    getSession: vi.fn()
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'Not found' } }))
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
    }))
  }))
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

describe('Segment Reference Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } }
    });
  });

  describe('assertScopeRef', () => {
    it('should allow core scope without ref_id', () => {
      expect(() => assertScopeRef('core')).not.toThrow();
      expect(() => assertScopeRef('core', undefined)).not.toThrow();
    });

    it('should require ref_id for non-core scopes', () => {
      const nonCoreScopes = ['ruleset', 'world', 'entry', 'entry_start', 'npc'];
      
      nonCoreScopes.forEach(scope => {
        expect(() => assertScopeRef(scope, 'valid-id')).not.toThrow();
        
        try {
          assertScopeRef(scope);
          expect.fail('Should have thrown error for missing ref_id');
        } catch (error: any) {
          expect(error.code).toBe('SEGMENT_REF_REQUIRED');
        }
      });
    });

    it('should throw error with correct code for missing ref_id', () => {
      try {
        assertScopeRef('ruleset');
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('SEGMENT_REF_REQUIRED');
        expect(error.message).toContain('requires a reference id');
      }
    });
  });

  describe('expectedRefTable', () => {
    it('should return correct table for each scope', () => {
      expect(expectedRefTable('core')).toBeNull();
      expect(expectedRefTable('world')).toBe('worlds');
      expect(expectedRefTable('ruleset')).toBe('rulesets');
      expect(expectedRefTable('entry')).toBe('entries');
      expect(expectedRefTable('entry_start')).toBe('entries');
      expect(expectedRefTable('npc')).toBe('npcs');
    });

    it('should return null for invalid scopes', () => {
      expect(expectedRefTable('invalid')).toBeNull();
      expect(expectedRefTable('')).toBeNull();
    });
  });

  describe('SegmentsService Reference Validation', () => {
    it('should validate reference exists for createSegment', async () => {
      // Mock successful reference lookup
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { id: 'valid-id' }, error: null }))
          }))
        }))
      });

      const validData = {
        scope: 'world' as const,
        ref_id: 'valid-world-id',
        content: 'Test world segment'
      };

      await expect(segmentsService.createSegment(validData)).resolves.toBeDefined();
    });

    it('should reject createSegment with invalid reference', async () => {
      // Mock failed reference lookup
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'Not found' } }))
          }))
        }))
      });

      const invalidData = {
        scope: 'world' as const,
        ref_id: 'invalid-world-id',
        content: 'Test world segment'
      };

      await expect(segmentsService.createSegment(invalidData)).rejects.toThrow();
    });

    it('should validate reference exists for updateSegment', async () => {
      // Mock successful reference lookup
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { id: 'valid-id' }, error: null }))
          }))
        }))
      });

      const validData = {
        scope: 'ruleset' as const,
        ref_id: 'valid-ruleset-id',
        content: 'Test ruleset segment'
      };

      await expect(segmentsService.updateSegment('segment-id', validData)).resolves.toBeDefined();
    });

    it('should reject updateSegment with invalid reference', async () => {
      // Mock failed reference lookup
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'Not found' } }))
          }))
        }))
      });

      const invalidData = {
        scope: 'ruleset' as const,
        ref_id: 'invalid-ruleset-id',
        content: 'Test ruleset segment'
      };

      await expect(segmentsService.updateSegment('segment-id', invalidData)).rejects.toThrow();
    });

    it('should skip reference validation for core scope', async () => {
      const coreData = {
        scope: 'core' as const,
        content: 'Test core segment'
      };

      await expect(segmentsService.createSegment(coreData)).resolves.toBeDefined();
    });

    it('should skip reference validation when scope is not updated', async () => {
      const updateData = {
        content: 'Updated content'
      };

      await expect(segmentsService.updateSegment('segment-id', updateData)).resolves.toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return friendly error for SEGMENT_REF_NOT_FOUND', async () => {
      // Mock failed reference lookup
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'Not found' } }))
          }))
        }))
      });

      const invalidData = {
        scope: 'world' as const,
        ref_id: 'invalid-world-id',
        content: 'Test world segment'
      };

      try {
        await segmentsService.createSegment(invalidData);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('SEGMENT_REF_NOT_FOUND');
        expect(error.message).toContain('not found in worlds');
      }
    });

    it('should return friendly error for SEGMENT_REF_REQUIRED', async () => {
      const invalidData = {
        scope: 'world' as const,
        content: 'Test world segment without ref_id'
      };

      try {
        await segmentsService.createSegment(invalidData);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('requires a reference id');
      }
    });
  });

  describe('Reference Table Mapping', () => {
    it('should validate against correct table for each scope', async () => {
      const testCases = [
        { scope: 'world', table: 'worlds' },
        { scope: 'ruleset', table: 'rulesets' },
        { scope: 'entry', table: 'entries' },
        { scope: 'entry_start', table: 'entries' },
        { scope: 'npc', table: 'npcs' }
      ];

      for (const testCase of testCases) {
        // Mock failed reference lookup
        mockSupabase.from.mockReturnValue({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'Not found' } }))
            }))
          }))
        });

        const invalidData = {
          scope: testCase.scope as any,
          ref_id: 'invalid-id',
          content: `Test ${testCase.scope} segment`
        };

        try {
          await segmentsService.createSegment(invalidData);
          expect.fail(`Should have thrown error for ${testCase.scope}`);
        } catch (error: any) {
          expect(error.message).toContain(`not found in ${testCase.table}`);
        }
      }
    });
  });
});
