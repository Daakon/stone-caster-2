/**
 * Media Routes Tests
 * Phase 2a: Unit tests for media upload endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import mediaRouter from '../../src/routes/media.js';
import { createDirectUpload, finalizeUpload } from '../../src/services/mediaService.js';
import { isAdminMediaEnabled } from '../../src/config/featureFlags.js';
import { CloudflareImagesError } from '../../src/lib/cloudflareImages.js';

// Mock dependencies
vi.mock('../../src/services/mediaService.js');
vi.mock('../../src/config/featureFlags.js');
// Mock auth middleware
const mockAuthenticateToken = (req: any, res: any, next: any) => {
  req.ctx = { userId: 'user-123', isGuest: false };
  req.user = { id: 'user-123' };
  next();
};

vi.mock('../../src/middleware/auth.js', () => ({
  authenticateToken: mockAuthenticateToken,
}));

vi.mock('../../src/middleware/validation.js', () => ({
  validateRequest: () => (req: any, res: any, next: any) => next(),
}));

const app = express();
app.use(express.json());
app.use('/api/media', mediaRouter);

describe('POST /api/media/uploads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 404 when feature flag is disabled', async () => {
    (isAdminMediaEnabled as any).mockReturnValue(false);

    const response = await request(app)
      .post('/api/media/uploads')
      .send({ kind: 'world' })
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(404);
    expect(response.body.error).toContain('not enabled');
  });

  it('should return 401 when unauthenticated', async () => {
    (isAdminMediaEnabled as any).mockReturnValue(true);

    // Create app without auth middleware
    const appNoAuth = express();
    appNoAuth.use(express.json());
    appNoAuth.use('/api/media', mediaRouter);

    const response = await request(appNoAuth)
      .post('/api/media/uploads')
      .send({ kind: 'world' });

    expect(response.status).toBe(401);
  });

  it('should return uploadURL and media row with status=pending', async () => {
    (isAdminMediaEnabled as any).mockReturnValue(true);
    (createDirectUpload as any).mockResolvedValue({
      uploadURL: 'https://upload.imagedelivery.net/test',
      media: {
        id: 'media-123',
        owner_user_id: 'user-123',
        kind: 'world',
        provider: 'cloudflare_images',
        provider_key: 'cf-id-456',
        visibility: 'private',
        status: 'pending',
        image_review_status: 'pending',
        created_at: '2025-01-01T00:00:00Z',
      },
    });

    const response = await request(app)
      .post('/api/media/uploads')
      .send({ kind: 'world' })
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body.data.uploadURL).toBe('https://upload.imagedelivery.net/test');
    expect(response.body.data.media.status).toBe('pending');
    expect(response.body.data.media.visibility).toBe('private');
  });

  it('should return 400 for invalid kind', async () => {
    (isAdminMediaEnabled as any).mockReturnValue(true);

    const response = await request(app)
      .post('/api/media/uploads')
      .send({ kind: 'invalid' })
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(400);
  });

  it('should handle Cloudflare API errors', async () => {
    (isAdminMediaEnabled as any).mockReturnValue(true);
    (createDirectUpload as any).mockRejectedValue(
      new CloudflareImagesError(401, 'Invalid API token')
    );

    const response = await request(app)
      .post('/api/media/uploads')
      .send({ kind: 'world' })
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(500);
    expect(response.body.error).toContain('Cloudflare Images error');
  });

  describe('POST /api/media/:id/finalize', () => {
    const mockMediaId = 'media-123';

    it('should return 401 when unauthenticated', async () => {
      (isAdminMediaEnabled as any).mockReturnValue(true);

      const appNoAuth = express();
      appNoAuth.use(express.json());
      appNoAuth.use('/api/media', mediaRouter);

      const response = await request(appNoAuth)
        .post(`/api/media/${mockMediaId}/finalize`);

      expect(response.status).toBe(401);
    });

    it('should return 404 when media not found', async () => {
      (isAdminMediaEnabled as any).mockReturnValue(true);
      (finalizeUpload as any).mockRejectedValue(new Error('Media asset not found'));

      const response = await request(app)
        .post(`/api/media/${mockMediaId}/finalize`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('not found');
    });

    it('should return 502 on Cloudflare API error', async () => {
      (isAdminMediaEnabled as any).mockReturnValue(true);
      (finalizeUpload as any).mockRejectedValue(
        new CloudflareImagesError(500, 'CF API error')
      );

      const response = await request(app)
        .post(`/api/media/${mockMediaId}/finalize`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(502);
      expect(response.body.error.message).toContain('Cloudflare Images error');
    });

    it('should return 200 on success with updated fields', async () => {
      (isAdminMediaEnabled as any).mockReturnValue(true);
      (finalizeUpload as any).mockResolvedValue({
        id: mockMediaId,
        owner_user_id: 'user-123',
        kind: 'world',
        provider: 'cloudflare_images',
        provider_key: 'cf-id-456',
        visibility: 'private',
        status: 'ready',
        image_review_status: 'pending',
        width: 1920,
        height: 1080,
        sha256: null,
        created_at: '2025-01-01T00:00:00Z',
        ready_at: '2025-01-01T01:00:00Z',
      });

      const response = await request(app)
        .post(`/api/media/${mockMediaId}/finalize`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.data.media.status).toBe('ready');
      expect(response.body.data.media.width).toBe(1920);
      expect(response.body.data.media.height).toBe(1080);
      expect(response.body.data.media.ready_at).toBeTruthy();
    });
  });
});

