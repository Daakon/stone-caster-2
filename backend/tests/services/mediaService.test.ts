/**
 * Media Service Tests
 * Phase 2a: Unit tests for media service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDirectUpload, finalizeUpload } from '../../src/services/mediaService.js';
import { supabaseAdmin } from '../../src/services/supabase.js';
import { isAdmin } from '../../src/middleware/auth-admin.js';
import { requestDirectUpload, getImageInfo } from '../../src/lib/cloudflareImages.js';
import type { Request } from 'express';

// Mock dependencies
vi.mock('../../src/services/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock('../../src/middleware/auth-admin.js', () => ({
  isAdmin: vi.fn(),
}));

vi.mock('../../src/lib/cloudflareImages.js', () => ({
  requestDirectUpload: vi.fn(),
}));

describe('Media Service', () => {
  const mockUserId = 'user-123';
  const mockMediaId = 'media-456';
  const mockProviderKey = 'cf-image-id-789';
  const mockUploadURL = 'https://upload.imagedelivery.net/test';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create direct upload with pending status for non-admin', async () => {
    const mockInsert = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: mockMediaId,
          owner_user_id: mockUserId,
          kind: 'world',
          provider: 'cloudflare_images',
          provider_key: mockProviderKey,
          visibility: 'private',
          status: 'pending',
          image_review_status: 'pending',
          created_at: '2025-01-01T00:00:00Z',
        },
        error: null,
      }),
    };

    (supabaseAdmin.from as any).mockReturnValue(mockInsert);
    (requestDirectUpload as any).mockResolvedValue({
      uploadURL: mockUploadURL,
      id: mockProviderKey,
    });
    (isAdmin as any).mockResolvedValue(false);

    const result = await createDirectUpload({
      userId: mockUserId,
      kind: 'world',
    });

    expect(result.uploadURL).toBe(mockUploadURL);
    expect(result.media.status).toBe('pending');
    expect(result.media.image_review_status).toBe('pending');
    expect(result.media.visibility).toBe('private');
    expect(result.media.provider_key).toBe(mockProviderKey);

    expect(mockInsert.insert).toHaveBeenCalledWith({
      owner_user_id: mockUserId,
      kind: 'world',
      provider: 'cloudflare_images',
      provider_key: mockProviderKey,
      visibility: 'private',
      status: 'pending',
      image_review_status: 'pending',
    });
  });

  it('should create direct upload with approved status for admin', async () => {
    const mockRequest = {} as Request;
    const mockInsert = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: mockMediaId,
          owner_user_id: mockUserId,
          kind: 'npc',
          provider: 'cloudflare_images',
          provider_key: mockProviderKey,
          visibility: 'private',
          status: 'pending',
          image_review_status: 'approved',
          created_at: '2025-01-01T00:00:00Z',
        },
        error: null,
      }),
    };

    (supabaseAdmin.from as any).mockReturnValue(mockInsert);
    (requestDirectUpload as any).mockResolvedValue({
      uploadURL: mockUploadURL,
      id: mockProviderKey,
    });
    (isAdmin as any).mockResolvedValue(true);

    const result = await createDirectUpload({
      userId: mockUserId,
      kind: 'npc',
      req: mockRequest,
    });

    expect(result.media.image_review_status).toBe('approved');
    expect(mockInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        image_review_status: 'approved',
      })
    );
  });

  it('should throw error if database insert fails', async () => {
    const mockInsert = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      }),
    };

    (supabaseAdmin.from as any).mockReturnValue(mockInsert);
    (requestDirectUpload as any).mockResolvedValue({
      uploadURL: mockUploadURL,
      id: mockProviderKey,
    });

    await expect(
      createDirectUpload({
        userId: mockUserId,
        kind: 'story',
      })
    ).rejects.toThrow('Failed to create media asset');
  });

  it('should handle unique constraint conflict and return existing row', async () => {
    const mockInsert = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { 
          code: '23505',
          message: 'duplicate key value violates unique constraint',
        },
      }),
    };

    const mockSelect = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: mockMediaId,
          owner_user_id: mockUserId,
          kind: 'world',
          provider: 'cloudflare_images',
          provider_key: mockProviderKey,
          visibility: 'private',
          status: 'pending',
          image_review_status: 'pending',
          width: null,
          height: null,
          sha256: null,
          created_at: '2025-01-01T00:00:00Z',
          ready_at: null,
        },
        error: null,
      }),
    };

    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'media_assets') {
        return {
          insert: mockInsert.insert,
          select: mockSelect.select,
        };
      }
      return {};
    });

    (requestDirectUpload as any).mockResolvedValue({
      uploadURL: mockUploadURL,
      id: mockProviderKey,
    });

    const result = await createDirectUpload({
      userId: mockUserId,
      kind: 'world',
    });

    expect(result.uploadURL).toBe(mockUploadURL);
    expect(result.media.id).toBe(mockMediaId);
    expect(mockSelect.eq).toHaveBeenCalledWith('provider', 'cloudflare_images');
    expect(mockSelect.eq).toHaveBeenCalledWith('provider_key', mockProviderKey);
  });
});

