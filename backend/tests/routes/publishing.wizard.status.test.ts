/**
 * Publishing Wizard Status Route Tests
 * Phase 7: Tests for wizard status endpoint
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import wizardRouter from '../../src/routes/publishing.wizard.js';
import { authenticateToken } from '../../src/middleware/auth.js';
import * as featureFlags from '../../src/config/featureFlags.js';
import { supabaseAdmin } from '../../src/services/supabase.js';
import { getLatestFindings } from '../../src/dal/publishingQuality.js';
import { ApiErrorCode } from '@shared';

// Mock middleware
vi.mock('../../src/middleware/auth.js', () => ({
  authenticateToken: vi.fn((req, res, next) => {
    req.user = { id: 'user-1', role: 'creator' };
    next();
  }),
}));

// Mock feature flags
vi.mock('../../src/config/featureFlags.js', () => ({
  isPublishingWizardEnabled: vi.fn(),
  isPublishingQualityGatesEnabled: vi.fn(),
}));

// Mock Supabase
vi.mock('../../src/services/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

// Mock DAL
vi.mock('../../src/dal/publishingQuality.js', () => ({
  getLatestFindings: vi.fn(),
}));

// Mock telemetry
vi.mock('../../src/telemetry/publishingTelemetry.js', () => ({
  emitPublishingEvent: vi.fn(),
}));

const app = express();
app.use(express.json());
app.use('/api/publishing/wizard', wizardRouter);

describe('GET /api/publishing/wizard/status/:type/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(featureFlags.isPublishingWizardEnabled).mockReturnValue(true);
    vi.mocked(featureFlags.isPublishingQualityGatesEnabled).mockReturnValue(true);
  });

  it('should return 501 if wizard is not enabled', async () => {
    vi.mocked(featureFlags.isPublishingWizardEnabled).mockReturnValue(false);
    
    const res = await request(app).get('/api/publishing/wizard/status/world/test-id');
    
    expect(res.statusCode).toEqual(501);
    expect(res.body.code).toEqual(ApiErrorCode.PUBLISH_REQUEST_DISABLED);
  });

  it('should return combined status for a world', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'test-id',
              name: 'Test World',
              visibility: 'private',
              review_state: 'draft',
              owner_user_id: 'user-1',
            },
            error: null,
          }),
        }),
      }),
    });

    (supabaseAdmin.from as any).mockReturnValue(mockFrom());
    vi.mocked(getLatestFindings).mockResolvedValue(null);

    const res = await request(app).get('/api/publishing/wizard/status/world/test-id');
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.type).toBe('world');
    expect(res.body.id).toBe('test-id');
    expect(res.body.dependency_invalid).toBe(false);
  });

  it('should return dependency status for story/npc', async () => {
    // Mock story fetch
    const mockStoryFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'story-id',
              title: 'Test Story',
              world_id: 'world-id',
              dependency_invalid: false,
              visibility: 'private',
              review_state: 'draft',
              owner_user_id: 'user-1',
            },
            error: null,
          }),
        }),
      }),
    });

    // Mock world fetch
    const mockWorldFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              visibility: 'public',
              review_state: 'approved',
            },
            error: null,
          }),
        }),
      }),
    });

    (supabaseAdmin.from as any)
      .mockReturnValueOnce(mockStoryFrom())
      .mockReturnValueOnce(mockWorldFrom());
    
    vi.mocked(getLatestFindings).mockResolvedValue(null);

    const res = await request(app).get('/api/publishing/wizard/status/story/story-id');
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.dependency_invalid).toBe(false);
    expect(res.body.parent_world).toBeDefined();
  });

  it('should return 404 if entity not found', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        }),
      }),
    });

    (supabaseAdmin.from as any).mockReturnValue(mockFrom());

    const res = await request(app).get('/api/publishing/wizard/status/world/nonexistent');
    
    expect(res.statusCode).toEqual(404);
    expect(res.body.code).toEqual(ApiErrorCode.NOT_FOUND);
  });
});

