/**
 * Quota Service Tests
 * Phase 8: Test quota enforcement and Option A behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { assertUserWithinQuota, getUserQuotaStatus, USER_QUOTAS } from '../../../src/services/quotaService.js';
import { supabaseAdmin } from '../../../src/services/supabase.js';
import { ApiErrorCode } from '@shared';

// Mock supabaseAdmin
vi.mock('../../../src/services/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

describe('quotaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('assertUserWithinQuota', () => {
    it('should allow creating first world', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockOr = vi.fn().mockReturnValue({ count: 0, error: null });

      (supabaseAdmin.from as any).mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        or: mockOr,
      });

      await expect(
        assertUserWithinQuota('user-123', { worlds: USER_QUOTAS.worlds })
      ).resolves.not.toThrow();
    });

    it('should throw QUOTA_EXCEEDED when world limit reached', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockOr = vi.fn().mockReturnValue({ count: 1, error: null });

      (supabaseAdmin.from as any).mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        or: mockOr,
      });

      await expect(
        assertUserWithinQuota('user-123', { worlds: USER_QUOTAS.worlds })
      ).rejects.toMatchObject({
        code: ApiErrorCode.QUOTA_EXCEEDED,
        details: {
          type: 'world',
          limit: 1,
          current: 1,
          remaining: 0,
        },
      });
    });

    it('should allow creating up to 3 stories', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockOr = vi.fn()
        .mockReturnValueOnce({ count: 0, error: null }) // First call (worlds check if included)
        .mockReturnValueOnce({ count: 2, error: null }); // Stories count

      (supabaseAdmin.from as any).mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        or: mockOr,
      });

      await expect(
        assertUserWithinQuota('user-123', { stories: USER_QUOTAS.stories })
      ).resolves.not.toThrow();
    });

    it('should throw QUOTA_EXCEEDED when story limit reached', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockOr = vi.fn().mockReturnValue({ count: 3, error: null });

      (supabaseAdmin.from as any).mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        or: mockOr,
      });

      await expect(
        assertUserWithinQuota('user-123', { stories: USER_QUOTAS.stories })
      ).rejects.toMatchObject({
        code: ApiErrorCode.QUOTA_EXCEEDED,
        details: {
          type: 'story',
          limit: 3,
          current: 3,
          remaining: 0,
        },
      });
    });

    it('should allow creating up to 6 NPCs', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockOr = vi.fn().mockReturnValue({ count: 5, error: null });

      (supabaseAdmin.from as any).mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        or: mockOr,
      });

      await expect(
        assertUserWithinQuota('user-123', { npcs: USER_QUOTAS.npcs })
      ).resolves.not.toThrow();
    });

    it('should throw QUOTA_EXCEEDED when NPC limit reached', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockOr = vi.fn().mockReturnValue({ count: 6, error: null });

      (supabaseAdmin.from as any).mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        or: mockOr,
      });

      await expect(
        assertUserWithinQuota('user-123', { npcs: USER_QUOTAS.npcs })
      ).rejects.toMatchObject({
        code: ApiErrorCode.QUOTA_EXCEEDED,
        details: {
          type: 'npc',
          limit: 6,
          current: 6,
          remaining: 0,
        },
      });
    });

    it('should confirm Option A: published items do not count', async () => {
      // This test verifies that the count query uses .or() filter
      // that excludes 'published' status
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockOr = vi.fn().mockReturnValue({ count: 0, error: null });

      (supabaseAdmin.from as any).mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        or: mockOr,
      });

      // User has 1 published world, but count should be 0 (published doesn't count)
      await expect(
        assertUserWithinQuota('user-123', { worlds: USER_QUOTAS.worlds })
      ).resolves.not.toThrow();

      // Verify the query filters out published items
      expect(mockOr).toHaveBeenCalledWith(
        'publish_status.is.null,publish_status.eq.draft,publish_status.eq.in_review,publish_status.eq.rejected'
      );
    });
  });

  describe('getUserQuotaStatus', () => {
    it('should return correct quota status for all types', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockOr = vi.fn()
        .mockReturnValueOnce({ count: 0, error: null }) // worlds
        .mockReturnValueOnce({ count: 2, error: null }) // stories
        .mockReturnValueOnce({ count: 4, error: null }); // npcs

      (supabaseAdmin.from as any).mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        or: mockOr,
      });

      const status = await getUserQuotaStatus('user-123', USER_QUOTAS);

      expect(status).toHaveLength(3);
      expect(status.find(s => s.type === 'world')).toEqual({
        type: 'world',
        limit: 1,
        current: 0,
        remaining: 1,
      });
      expect(status.find(s => s.type === 'story')).toEqual({
        type: 'story',
        limit: 3,
        current: 2,
        remaining: 1,
      });
      expect(status.find(s => s.type === 'npc')).toEqual({
        type: 'npc',
        limit: 6,
        current: 4,
        remaining: 2,
      });
    });
  });
});

