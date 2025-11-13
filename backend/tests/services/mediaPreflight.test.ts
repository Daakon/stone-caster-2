/**
 * Media Preflight Service Tests
 * Phase 2e: Unit tests for publish preflight media checks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkMediaPreflight } from '../../src/services/mediaPreflight.js';
import { supabaseAdmin } from '../../src/services/supabase.js';
import { isAdminMediaEnabled } from '../../src/config/featureFlags.js';

// Mock dependencies
vi.mock('../../src/services/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock('../../src/config/featureFlags.js', () => ({
  isAdminMediaEnabled: vi.fn(),
}));

describe('Media Preflight Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isAdminMediaEnabled as any).mockReturnValue(true);
  });

  it('should return ok if feature flag is disabled', async () => {
    (isAdminMediaEnabled as any).mockReturnValue(false);

    const result = await checkMediaPreflight({
      type: 'world',
      id: 'world-123',
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('should return MISSING_COVER_MEDIA if entity has no cover', async () => {
    const mockSelect = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'world-123',
          cover_media_id: null,
        },
        error: null,
      }),
    };

    (supabaseAdmin.from as any).mockReturnValue({
      select: mockSelect.select,
    });

    const result = await checkMediaPreflight({
      type: 'world',
      id: 'world-123',
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0].code).toBe('MISSING_COVER_MEDIA');
  });

  it('should return COVER_NOT_READY if cover status is not ready', async () => {
    const mockEntitySelect = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'world-123',
          cover_media_id: 'media-456',
        },
        error: null,
      }),
    };

    const mockMediaSelect = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'media-456',
          status: 'pending',
          image_review_status: 'approved',
        },
        error: null,
      }),
    };

    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'worlds') {
        return { select: mockEntitySelect.select };
      }
      if (table === 'media_assets') {
        return { select: mockMediaSelect.select };
      }
      return { select: vi.fn() };
    });

    const result = await checkMediaPreflight({
      type: 'world',
      id: 'world-123',
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0].code).toBe('COVER_NOT_READY');
  });

  it('should return COVER_NOT_APPROVED if cover is ready but not approved', async () => {
    const mockEntitySelect = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'world-123',
          cover_media_id: 'media-456',
        },
        error: null,
      }),
    };

    const mockMediaSelect = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'media-456',
          status: 'ready',
          image_review_status: 'pending',
        },
        error: null,
      }),
    };

    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'worlds') {
        return { select: mockEntitySelect.select };
      }
      if (table === 'media_assets') {
        return { select: mockMediaSelect.select };
      }
      return { select: vi.fn() };
    });

    const result = await checkMediaPreflight({
      type: 'world',
      id: 'world-123',
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0].code).toBe('COVER_NOT_APPROVED');
  });

  it('should return ok if cover is ready and approved', async () => {
    const mockEntitySelect = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'world-123',
          cover_media_id: 'media-456',
        },
        error: null,
      }),
    };

    const mockMediaSelect = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'media-456',
          status: 'ready',
          image_review_status: 'approved',
        },
        error: null,
      }),
    };

    const mockLinksSelect = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'worlds') {
        return { select: mockEntitySelect.select };
      }
      if (table === 'media_assets') {
        return { select: mockMediaSelect.select };
      }
      if (table === 'media_links') {
        return { select: mockLinksSelect.select };
      }
      return { select: vi.fn() };
    });

    const result = await checkMediaPreflight({
      type: 'world',
      id: 'world-123',
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('should return warning for gallery items not approved (non-blocking)', async () => {
    const mockEntitySelect = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'world-123',
          cover_media_id: 'media-456',
        },
        error: null,
      }),
    };

    const mockCoverMediaSelect = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'media-456',
          status: 'ready',
          image_review_status: 'approved',
        },
        error: null,
      }),
    };

    const mockLinksSelect = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [
          { media_id: 'media-789' },
          { media_id: 'media-101' },
        ],
        error: null,
      }),
    };

    const mockGalleryMediaSelect = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      mockResolvedValue: vi.fn().mockResolvedValue({
        data: [
          { id: 'media-789', status: 'ready', image_review_status: 'pending' },
          { id: 'media-101', status: 'ready', image_review_status: 'approved' },
        ],
        error: null,
      }),
    };

    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'worlds') {
        return { select: mockEntitySelect.select };
      }
      if (table === 'media_assets') {
        if (mockCoverMediaSelect.select.mock.calls.length === 0) {
          return { select: mockCoverMediaSelect.select };
        }
        return { select: mockGalleryMediaSelect.select, in: mockGalleryMediaSelect.in };
      }
      if (table === 'media_links') {
        return { select: mockLinksSelect.select };
      }
      return { select: vi.fn() };
    });

    // Fix the gallery media query mock
    const galleryQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          { id: 'media-789', status: 'ready', image_review_status: 'pending' },
          { id: 'media-101', status: 'ready', image_review_status: 'approved' },
        ],
        error: null,
      }),
    };

    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'worlds') {
        return { select: mockEntitySelect.select };
      }
      if (table === 'media_assets') {
        // First call is for cover, second is for gallery
        if (mockCoverMediaSelect.select.mock.calls.length === 0) {
          return { select: mockCoverMediaSelect.select };
        }
        return galleryQuery;
      }
      if (table === 'media_links') {
        return { select: mockLinksSelect.select };
      }
      return { select: vi.fn() };
    });

    const result = await checkMediaPreflight({
      type: 'world',
      id: 'world-123',
    });

    expect(result.ok).toBe(true); // Warnings don't block
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings?.[0].code).toBe('GALLERY_ITEMS_NOT_APPROVED');
    expect(result.warnings?.[0].mediaIds).toContain('media-789');
  });
});



