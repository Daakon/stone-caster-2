/**
 * User Authoring Routes Tests
 * Phase 8: Test submit-for-publish and quota enforcement
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import userAuthoringRouter from '../../src/routes/user-authoring.js';
import { authenticateToken } from '../../src/middleware/auth.js';

// Mock middleware
vi.mock('../../src/middleware/auth.js', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-123' };
    next();
  },
}));

// Mock services
vi.mock('../../src/services/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock('../../src/services/quotaService.js', () => ({
  assertUserWithinQuota: vi.fn(),
  getUserQuotaStatus: vi.fn(),
  USER_QUOTAS: { worlds: 1, stories: 3, npcs: 6 },
}));

vi.mock('../../src/services/mediaPreflight.js', () => ({
  checkMediaPreflight: vi.fn(),
}));

vi.mock('../../src/services/publishingPreflightHelpers.js', () => ({
  checkDependencies: vi.fn(),
  validateRequiredFields: vi.fn(),
}));

describe('User Authoring Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', userAuthoringRouter);
    vi.clearAllMocks();
  });

  describe('GET /api/worlds', () => {
    it('should return user worlds with quota info', async () => {
      const { supabaseAdmin } = await import('../../src/services/supabase.js');
      const { getUserQuotaStatus } = await import('../../src/services/quotaService.js');

      const mockWorlds = [
        { id: 'world-1', name: 'Test World', publish_status: 'draft', updated_at: new Date().toISOString() },
      ];

      (supabaseAdmin.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockWorlds, error: null }),
      });

      (getUserQuotaStatus as any).mockResolvedValue([
        { type: 'world', limit: 1, current: 1, remaining: 0 },
      ]);

      const res = await request(app).get('/api/worlds');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.quotas).toEqual({
        limit: 1,
        used: 1,
        remaining: 0,
      });
    });
  });

  describe('POST /api/worlds/:id/submit-for-publish', () => {
    it('should submit draft world for review', async () => {
      const { supabaseAdmin } = await import('../../src/services/supabase.js');
      const { validateRequiredFields } = await import('../../src/services/publishingPreflightHelpers.js');

      const mockWorld = {
        id: 'world-1',
        owner_user_id: 'test-user-123',
        publish_status: 'draft',
        name: 'Test World',
        description: 'Test description',
      };

      (supabaseAdmin.from as any)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockWorld, error: null }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { ...mockWorld, publish_status: 'in_review' },
            error: null,
          }),
        });

      (validateRequiredFields as any).mockResolvedValue({
        fieldsMissing: [],
        fieldsInvalid: [],
      });

      const res = await request(app).post('/api/worlds/world-1/submit-for-publish');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.submitted).toBe(true);
    });

    it('should reject if world is already in review', async () => {
      const { supabaseAdmin } = await import('../../src/services/supabase.js');

      const mockWorld = {
        id: 'world-1',
        owner_user_id: 'test-user-123',
        publish_status: 'in_review',
        name: 'Test World',
      };

      (supabaseAdmin.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWorld, error: null }),
      });

      const res = await request(app).post('/api/worlds/world-1/submit-for-publish');

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_IN_REVIEW');
    });

    it('should reject if world is already published', async () => {
      const { supabaseAdmin } = await import('../../src/services/supabase.js');

      const mockWorld = {
        id: 'world-1',
        owner_user_id: 'test-user-123',
        publish_status: 'published',
        name: 'Test World',
      };

      (supabaseAdmin.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWorld, error: null }),
      });

      const res = await request(app).post('/api/worlds/world-1/submit-for-publish');

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_PUBLISHED');
    });

    it('should reject if user does not own the world', async () => {
      const { supabaseAdmin } = await import('../../src/services/supabase.js');

      const mockWorld = {
        id: 'world-1',
        owner_user_id: 'other-user-456',
        publish_status: 'draft',
        name: 'Test World',
      };

      (supabaseAdmin.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWorld, error: null }),
      });

      const res = await request(app).post('/api/worlds/world-1/submit-for-publish');

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('do not own');
    });

    it('should reject if required fields are missing', async () => {
      const { supabaseAdmin } = await import('../../src/services/supabase.js');
      const { validateRequiredFields } = await import('../../src/services/publishingPreflightHelpers.js');

      const mockWorld = {
        id: 'world-1',
        owner_user_id: 'test-user-123',
        publish_status: 'draft',
        name: 'Test World',
        description: null, // Missing description
      };

      (supabaseAdmin.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWorld, error: null }),
      });

      (validateRequiredFields as any).mockResolvedValue({
        fieldsMissing: ['description'],
        fieldsInvalid: [],
      });

      const res = await request(app).post('/api/worlds/world-1/submit-for-publish');

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.details.fieldsMissing).toContain('description');
    });
  });

  describe('POST /api/stories/:id/submit-for-publish', () => {
    it('should submit draft story for review', async () => {
      const { supabaseAdmin } = await import('../../src/services/supabase.js');
      const { validateRequiredFields, checkDependencies } = await import('../../src/services/publishingPreflightHelpers.js');
      const { checkMediaPreflight } = await import('../../src/services/mediaPreflight.js');

      const mockStory = {
        id: 'story-1',
        owner_user_id: 'test-user-123',
        publish_status: 'draft',
        title: 'Test Story',
        description: 'Test description',
        world_id: 'world-1',
      };

      (supabaseAdmin.from as any)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockStory, error: null }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { ...mockStory, publish_status: 'in_review' },
            error: null,
          }),
        });

      (validateRequiredFields as any).mockResolvedValue({
        fieldsMissing: [],
        fieldsInvalid: [],
      });

      (checkDependencies as any).mockResolvedValue({
        missingWorld: false,
        missingRuleset: false,
        worldPublished: true,
        invalidRefs: [],
      });

      (checkMediaPreflight as any).mockResolvedValue({
        ok: true,
      });

      const res = await request(app).post('/api/stories/story-1/submit-for-publish');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.submitted).toBe(true);
    });

    it('should reject if story world is not published', async () => {
      const { supabaseAdmin } = await import('../../src/services/supabase.js');
      const { validateRequiredFields, checkDependencies } = await import('../../src/services/publishingPreflightHelpers.js');

      const mockStory = {
        id: 'story-1',
        owner_user_id: 'test-user-123',
        publish_status: 'draft',
        title: 'Test Story',
        description: 'Test description',
        world_id: 'world-1',
      };

      (supabaseAdmin.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockStory, error: null }),
      });

      (validateRequiredFields as any).mockResolvedValue({
        fieldsMissing: [],
        fieldsInvalid: [],
      });

      (checkDependencies as any).mockResolvedValue({
        missingWorld: false,
        missingRuleset: false,
        worldPublished: false, // World not published
        invalidRefs: ['world_not_published'],
      });

      const res = await request(app).post('/api/stories/story-1/submit-for-publish');

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.message).toContain('published world');
    });
  });
});

