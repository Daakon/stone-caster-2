/**
 * Public Access Request Endpoint Tests
 * Phase B5: Integration tests for public access request endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import accessRequestsPublicRouter from '../src/routes/accessRequests.public.js';
import { accessRequestRateLimiter } from '../src/lib/rateLimiter.js';
import { supabaseAdmin } from '../src/services/supabase.js';

// Mock dependencies
vi.mock('../src/services/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock('../src/lib/rateLimiter.js', () => ({
  accessRequestRateLimiter: {
    check: vi.fn(),
    getResetTime: vi.fn(),
  },
}));

describe('POST /api/request-access', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/request-access', accessRequestsPublicRouter);
    vi.clearAllMocks();
  });

  it('should submit a valid request and return 200', async () => {
    vi.mocked(accessRequestRateLimiter.check).mockReturnValue(true);

    const mockInsert = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'req-123',
          email: 'test@example.com',
          status: 'pending',
          created_at: new Date().toISOString(),
        },
        error: null,
      }),
    };

    vi.mocked(supabaseAdmin.from).mockReturnValue(mockInsert as any);

    const response = await request(app).post('/api/request-access').send({
      email: 'test@example.com',
      note: 'I love RPGs!',
    });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.id).toBe('req-123');
    expect(response.body.data.status).toBe('pending');
  });

  it('should return 429 when rate limited', async () => {
    vi.mocked(accessRequestRateLimiter.check).mockReturnValue(false);
    vi.mocked(accessRequestRateLimiter.getResetTime).mockReturnValue(1800); // 30 minutes

    const response = await request(app).post('/api/request-access').send({
      email: 'test@example.com',
    });

    expect(response.status).toBe(429);
    expect(response.body.ok).toBe(false);
    expect(response.body.code).toBe('RATE_LIMITED');
    expect(response.body.meta.resetIn).toBe(1800);
  });

  it('should reject invalid email', async () => {
    vi.mocked(accessRequestRateLimiter.check).mockReturnValue(true);

    const response = await request(app).post('/api/request-access').send({
      email: 'not-an-email',
    });

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('should reject note that is too long', async () => {
    vi.mocked(accessRequestRateLimiter.check).mockReturnValue(true);

    const response = await request(app).post('/api/request-access').send({
      email: 'test@example.com',
      note: 'a'.repeat(501),
    });

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
  });

  it('should reject requests with honeypot field filled', async () => {
    vi.mocked(accessRequestRateLimiter.check).mockReturnValue(true);

    const response = await request(app).post('/api/request-access').send({
      email: 'test@example.com',
      honeypot: 'bot',
    });

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
  });
});

describe('GET /api/request-access/status', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    // Mock auth middleware
    app.use('/api/request-access', (req, res, next) => {
      req.ctx = {
        userId: 'user-123',
        isGuest: false,
      };
      next();
    });
    app.use('/api/request-access', accessRequestsPublicRouter);
    vi.clearAllMocks();
  });

  it('should return 401 for unauthenticated requests', async () => {
    const app2 = express();
    app2.use(express.json());
    app2.use('/api/request-access', accessRequestsPublicRouter);

    const response = await app2.get('/api/request-access/status');

    expect(response.status).toBe(401);
  });

  it('should return request status for authenticated user', async () => {
    const mockSelect = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'req-123',
          email: 'test@example.com',
          status: 'pending',
          user_id: 'user-123',
        },
        error: null,
      }),
    };

    vi.mocked(supabaseAdmin.from).mockReturnValue(mockSelect as any);

    const response = await request(app).get('/api/request-access/status');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.request.status).toBe('pending');
  });

  it('should return null if no request found', async () => {
    const mockSelect = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      }),
    };

    vi.mocked(supabaseAdmin.from).mockReturnValue(mockSelect as any);

    const response = await request(app).get('/api/request-access/status');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.request).toBeNull();
  });
});

