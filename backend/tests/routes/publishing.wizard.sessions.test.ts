/**
 * Publishing Wizard Sessions Route Tests
 * Phase 8: Tests for session save/delete endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import wizardRouter from '../../src/routes/publishing.wizard.js';
import { authenticateToken } from '../../src/middleware/auth.js';
import * as featureFlags from '../../src/config/featureFlags.js';
import { supabaseAdmin } from '../../src/services/supabase.js';
import { ApiErrorCode } from '@shared';

// Mock middleware
vi.mock('../../src/middleware/auth.js', () => ({
  authenticateToken: vi.fn((req, res, next) => {
    req.user = { id: 'user-1', email: 'user@example.com', role: 'creator' };
    next();
  }),
}));

// Mock feature flags
vi.mock('../../src/config/featureFlags.js', () => ({
  isPublishingWizardEnabled: vi.fn(),
  isPublishingWizardSessionsEnabled: vi.fn(),
  isPublishingWizardRolloutEnabled: vi.fn(),
}));

// Mock Supabase
vi.mock('../../src/services/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

// Mock telemetry
vi.mock('../../src/telemetry/publishingTelemetry.js', () => ({
  emitPublishingEvent: vi.fn(),
}));

const app = express();
app.use(express.json());
app.use('/api/publishing/wizard', wizardRouter);

describe('POST /api/publishing/wizard/session/:type/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(featureFlags.isPublishingWizardEnabled).mockReturnValue(true);
    vi.mocked(featureFlags.isPublishingWizardSessionsEnabled).mockReturnValue(true);
  });

  it('should return 501 if wizard is not enabled', async () => {
    vi.mocked(featureFlags.isPublishingWizardEnabled).mockReturnValue(false);
    
    const res = await request(app)
      .post('/api/publishing/wizard/session/world/test-id')
      .send({ step: 'preflight', data: { score: 80 } });
    
    expect(res.statusCode).toEqual(501);
    expect(res.body.code).toEqual(ApiErrorCode.PUBLISH_REQUEST_DISABLED);
  });

  it('should return 501 if sessions are not enabled', async () => {
    vi.mocked(featureFlags.isPublishingWizardSessionsEnabled).mockReturnValue(false);
    
    const res = await request(app)
      .post('/api/publishing/wizard/session/world/test-id')
      .send({ step: 'preflight', data: { score: 80 } });
    
    expect(res.statusCode).toEqual(501);
    expect(res.body.code).toEqual(ApiErrorCode.PUBLISH_REQUEST_DISABLED);
  });

  it('should save session successfully', async () => {
    // Mock entity fetch (ownership check)
    const mockEntityFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { owner_user_id: 'user-1' },
            error: null,
          }),
        }),
      }),
    });

    // Mock session upsert
    const mockSessionFrom = vi.fn().mockReturnValue({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              step: 'preflight',
              data: { score: 80 },
              updated_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      }),
    });

    (supabaseAdmin.from as any)
      .mockReturnValueOnce(mockEntityFrom())
      .mockReturnValueOnce(mockSessionFrom());

    const res = await request(app)
      .post('/api/publishing/wizard/session/world/test-id')
      .send({ step: 'preflight', data: { score: 80 } });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.step).toBe('preflight');
    expect(res.body.data.score).toBe(80);
  });

  it('should return 403 if user does not own entity', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { owner_user_id: 'other-user' },
            error: null,
          }),
        }),
      }),
    });

    (supabaseAdmin.from as any).mockReturnValue(mockFrom());

    const res = await request(app)
      .post('/api/publishing/wizard/session/world/test-id')
      .send({ step: 'preflight', data: { score: 80 } });
    
    expect(res.statusCode).toEqual(403);
    expect(res.body.code).toEqual(ApiErrorCode.FORBIDDEN);
  });
});

describe('DELETE /api/publishing/wizard/session/:type/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(featureFlags.isPublishingWizardEnabled).mockReturnValue(true);
    vi.mocked(featureFlags.isPublishingWizardSessionsEnabled).mockReturnValue(true);
  });

  it('should delete session successfully', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null,
            }),
          }),
        }),
      }),
    });

    (supabaseAdmin.from as any).mockReturnValue(mockFrom());

    const res = await request(app)
      .delete('/api/publishing/wizard/session/world/test-id');
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.deleted).toBe(true);
  });
});

