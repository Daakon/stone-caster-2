/**
 * Cloudflare Images Client Tests
 * Phase 2a: Unit tests for direct upload requests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestDirectUpload, getImageInfo, CloudflareImagesError } from '../../src/lib/cloudflareImages.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('Cloudflare Images Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set required env vars
    process.env.CF_ACCOUNT_ID = 'test-account-id';
    process.env.CF_API_TOKEN = 'test-api-token';
    process.env.CF_IMAGES_ACCOUNT_HASH = 'test-hash';
    process.env.CF_IMAGES_DELIVERY_URL = 'https://imagedelivery.net/test-hash';
  });

  it('should return upload URL and ID on successful request', async () => {
    const mockResponse = {
      result: {
        uploadURL: 'https://upload.imagedelivery.net/test-upload-url',
        id: 'test-image-id-123',
      },
      success: true,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await requestDirectUpload();

    expect(result).toEqual({
      uploadURL: 'https://upload.imagedelivery.net/test-upload-url',
      id: 'test-image-id-123',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/test-account-id/images/v2/direct_upload',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-api-token',
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('should include metadata in request body when provided', async () => {
    const mockResponse = {
      result: {
        uploadURL: 'https://upload.imagedelivery.net/test',
        id: 'test-id',
      },
      success: true,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    await requestDirectUpload({
      metadata: { kind: 'world', owner_user_id: 'user-123' },
    });

    const callArgs = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body.metadata).toEqual({
      kind: 'world',
      owner_user_id: 'user-123',
    });
  });

  it('should throw CloudflareImagesError on API error', async () => {
    const mockErrorResponse = {
      errors: [
        { code: 1003, message: 'Invalid API token' },
      ],
      success: false,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => mockErrorResponse,
    });

    await expect(requestDirectUpload()).rejects.toThrow(CloudflareImagesError);
    await expect(requestDirectUpload()).rejects.toThrow('Cloudflare Images API error: Invalid API token');
  });

  it('should throw CloudflareImagesError on missing config', async () => {
    delete process.env.CF_ACCOUNT_ID;

    await expect(requestDirectUpload()).rejects.toThrow(CloudflareImagesError);
    await expect(requestDirectUpload()).rejects.toThrow('Cloudflare Images configuration is missing');
  });

  it('should throw CloudflareImagesError on invalid response format', async () => {
    const mockResponse = {
      result: {
        // Missing uploadURL and id
      },
      success: true,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    await expect(requestDirectUpload()).rejects.toThrow(CloudflareImagesError);
    await expect(requestDirectUpload()).rejects.toThrow('Invalid response from Cloudflare Images API');
  });

  it('should wrap network errors', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    await expect(requestDirectUpload()).rejects.toThrow(CloudflareImagesError);
    await expect(requestDirectUpload()).rejects.toThrow('Failed to request direct upload');
  });

  describe('getImageInfo', () => {
    it('should return image info with dimensions', async () => {
      const mockResponse = {
        result: {
          filename: 'test.jpg',
          uploaded: '2025-01-01T00:00:00Z',
          width: 1920,
          height: 1080,
          variants: ['thumb', 'avatar', 'card', 'banner'],
          requireSignedURLs: false,
        },
        success: true,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getImageInfo('test-image-id');

      expect(result).toEqual({
        width: 1920,
        height: 1080,
        uploaded: '2025-01-01T00:00:00Z',
        meta: {},
        variants: ['thumb', 'avatar', 'card', 'banner'],
        requireSignedURLs: false,
        draft: false,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/accounts/test-account-id/images/v1/test-image-id',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-token',
          }),
        })
      );
    });

    it('should extract dimensions from meta object', async () => {
      const mockResponse = {
        result: {
          filename: 'test.jpg',
          uploaded: '2025-01-01T00:00:00Z',
          meta: {
            width: 800,
            height: 600,
          },
          variants: [],
        },
        success: true,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getImageInfo('test-image-id');

      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });

    it('should throw CloudflareImagesError on API error', async () => {
      const mockErrorResponse = {
        errors: [
          { code: 1003, message: 'Image not found' },
        ],
        success: false,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => mockErrorResponse,
      });

      await expect(getImageInfo('invalid-id')).rejects.toThrow(CloudflareImagesError);
      await expect(getImageInfo('invalid-id')).rejects.toThrow('Cloudflare Images API error: Image not found');
    });

    it('should throw error on invalid response format', async () => {
      const mockResponse = {
        // Missing result
        success: true,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await expect(getImageInfo('test-id')).rejects.toThrow(CloudflareImagesError);
      await expect(getImageInfo('test-id')).rejects.toThrow('Invalid response from Cloudflare Images API');
    });
  });
});

