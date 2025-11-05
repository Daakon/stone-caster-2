/**
 * /api/me Endpoint Tests
 * Tests for GET /api/me endpoint (includes role in authenticated response)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import meRouter from '../src/routes/me.js';
import { supabaseAdmin } from '../src/services/supabase.js';

// Mock dependencies
vi.mock('../src/services/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock('../src/middleware/auth.js', () => ({
  optionalAuth: vi.fn((req, res, next) => {
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

describe('GET /api/me', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/me', meRouter);
  });

  it('should return user with role when authenticated', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: { role: 'early_access' },
      error: null,
    });

    vi.mocked(supabaseAdmin.from).mockReturnValue({
      select: mockSelect,
    } as any);
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      single: mockSingle,
    });

    const response = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          role: 'early_access',
        },
        kind: 'user',
      },
    });
  });

  it('should default to "pending" if profile not found', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    });

    vi.mocked(supabaseAdmin.from).mockReturnValue({
      select: mockSelect,
    } as any);
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      single: mockSingle,
    });

    const response = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          role: 'pending',
        },
        kind: 'user',
      },
    });
  });
});
