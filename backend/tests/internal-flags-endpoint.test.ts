/**
 * /api/internal/flags Endpoint Tests
 * Tests for GET /api/internal/flags endpoint (admin-only)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import internalFlagsRouter from '../src/routes/internalFlags.js';
import { isAdmin } from '../src/middleware/auth-admin.js';

// Mock dependencies
vi.mock('../src/middleware/auth.js', () => ({
  requireAuth: vi.fn((req, res, next) => {
    // Mock authenticated user
    req.ctx = {
      userId: 'test-user-id',
      isGuest: false,
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        isGuest: false,
      },
    };
    next();
  }),
}));

vi.mock('../src/middleware/auth-admin.js', () => ({
  isAdmin: vi.fn(),
}));

vi.mock('../src/config/featureFlags.js', () => ({
  isEarlyAccessOn: vi.fn(() => true),
}));

describe('GET /api/internal/flags', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/internal', internalFlagsRouter);
  });

  it('should return flags when user is admin', async () => {
    vi.mocked(isAdmin).mockResolvedValue(true);

    const response = await request(app)
      .get('/api/internal/flags')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      data: {
        EARLY_ACCESS_MODE: 'on',
      },
    });
  });

  it('should return 403 when user is not admin', async () => {
    vi.mocked(isAdmin).mockResolvedValue(false);

    const response = await request(app)
      .get('/api/internal/flags')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      ok: false,
      error: 'Admin access required',
    });
  });
});

