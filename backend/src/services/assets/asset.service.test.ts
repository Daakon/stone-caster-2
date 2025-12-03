/**
 * Asset Service Test
 * Tests asset upload URL generation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AssetService } from './asset.service.js';
import { requestDirectUpload, CloudflareImagesError } from '../../lib/cloudflareImages.js';
import { getCloudflareImagesDeliveryUrl } from '../../config/media.js';

// Mock dependencies
vi.mock('../../lib/cloudflareImages.js', () => ({
  requestDirectUpload: vi.fn(),
  CloudflareImagesError: class extends Error {
    constructor(public code: number, message: string) {
      super(message);
      this.name = 'CloudflareImagesError';
    }
  },
}));

vi.mock('../../config/media.js', () => ({
  getCloudflareImagesDeliveryUrl: vi.fn(() => 'https://imagedelivery.net/test-account'),
}));

describe('AssetService', () => {
  let assetService: AssetService;

  beforeEach(() => {
    vi.clearAllMocks();
    assetService = new AssetService();
  });

  it('should generate upload URL and return uploadUrl and accessUrl', async () => {
    const mockUploadResponse = {
      uploadURL: 'https://upload.imagedelivery.net/test-upload-url',
      id: 'test-image-id-123',
    };

    vi.mocked(requestDirectUpload).mockResolvedValue(mockUploadResponse);

    const result = await assetService.generateUploadUrl(
      'image/png',
      'worlds',
      undefined
    );

    expect(result).toBeDefined();
    expect(result.uploadUrl).toBe('https://upload.imagedelivery.net/test-upload-url');
    expect(result.publicUrl).toContain('test-image-id-123');
    expect(result.path).toBe('worlds/test-image-id-123');
    expect(requestDirectUpload).toHaveBeenCalledWith({
      metadata: {
        folder: 'worlds',
        content_type: 'image/png',
      },
    });
  });

  it('should include user ID in metadata when request context is provided', async () => {
    const mockUploadResponse = {
      uploadURL: 'https://upload.imagedelivery.net/test-upload-url',
      id: 'test-image-id-456',
    };

    vi.mocked(requestDirectUpload).mockResolvedValue(mockUploadResponse);

    const mockRequest = {
      ctx: {
        userId: 'user-123',
      },
    } as any;

    await assetService.generateUploadUrl(
      'image/jpeg',
      'entities',
      mockRequest
    );

    expect(requestDirectUpload).toHaveBeenCalledWith({
      metadata: {
        folder: 'entities',
        content_type: 'image/jpeg',
        user_id: 'user-123',
      },
    });
  });

  it('should handle CloudflareImagesError', async () => {
    vi.mocked(requestDirectUpload).mockRejectedValue(
      new CloudflareImagesError(500, 'CF API Error')
    );

    await expect(
      assetService.generateUploadUrl('image/png', 'worlds', undefined)
    ).rejects.toThrow('Failed to generate upload URL: CF API Error');
  });

  it('should use fallback delivery URL if not configured', async () => {
    vi.mocked(getCloudflareImagesDeliveryUrl).mockReturnValue(null);

    const mockUploadResponse = {
      uploadURL: 'https://upload.imagedelivery.net/test-upload-url',
      id: 'test-image-id-789',
    };

    vi.mocked(requestDirectUpload).mockResolvedValue(mockUploadResponse);

    const result = await assetService.generateUploadUrl(
      'image/png',
      'worlds',
      undefined
    );

    expect(result.publicUrl).toContain('unknown');
    expect(result.publicUrl).toContain('test-image-id-789');
  });
});

