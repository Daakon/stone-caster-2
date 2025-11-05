/**
 * Admin Access Request Endpoint Tests
 * Phase B5: Integration tests for admin access request endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import accessRequestsAdminRouter from '../src/routes/accessRequests.admin.js';
import { isAdmin } from '../src/middleware/auth-admin.js';
import { supabaseAdmin } from '../src/services/supabase.js';

// Mock dependencies
vi.mock('../src/middleware/auth-admin.js', () => ({
  isAdmin: vi.fn(),
}));

vi.mock('../src/services/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('GET /api/admin/access-requests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin/access-requests', accessRequestsAdminRouter);
    vi.clearAllMocks();
  });

  it('should return 403 for non-admin users', async () => {
    vi.mocked(isAdmin).mockResolvedValue(false);

    const response = await request(app)
      .get('/api/admin/access-requests')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(403);
    expect(response.body.ok).toBe(false);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('should return paginated list for admin users', async () => {
    vi.mocked(isAdmin).mockResolvedValue(true);

    const mockSelect = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'req-1',
            email: 'test1@example.com',
            status: 'pending',
          },
        ],
        error: null,
        count: 1,
      }),
    };

    vi.mocked(supabaseAdmin.from).mockReturnValue(mockSelect as any);

    const response = await request(app)
      .get('/api/admin/access-requests?page=1&pageSize=50')
      .set('Authorization', 'Bearer admin-token');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta.total).toBe(1);
  });

  it('should filter by status', async () => {
    vi.mocked(isAdmin).mockResolvedValue(true);

    const mockSelect = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      }),
    };

    vi.mocked(supabaseAdmin.from).mockReturnValue(mockSelect as any);

    await request(app)
      .get('/api/admin/access-requests?status=pending')
      .set('Authorization', 'Bearer admin-token');

    expect(mockSelect.eq).toHaveBeenCalledWith('status', 'pending');
  });

  it('should search by email', async () => {
    vi.mocked(isAdmin).mockResolvedValue(true);

    const mockSelect = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      }),
    };

    vi.mocked(supabaseAdmin.from).mockReturnValue(mockSelect as any);

    await request(app)
      .get('/api/admin/access-requests?q=test@example.com')
      .set('Authorization', 'Bearer admin-token');

    expect(mockSelect.ilike).toHaveBeenCalledWith('email', '%test@example.com%');
  });
});

describe('POST /api/admin/access-requests/:id/approve', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.ctx = { userId: 'admin-123' };
      next();
    });
    app.use('/api/admin/access-requests', accessRequestsAdminRouter);
    vi.clearAllMocks();
  });

  it('should return 403 for non-admin users', async () => {
    vi.mocked(isAdmin).mockResolvedValue(false);

    const response = await request(app)
      .post('/api/admin/access-requests/req-123/approve')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(403);
  });

  it('should approve request and update profile role', async () => {
    vi.mocked(isAdmin).mockResolvedValue(true);

    const mockRequest = {
      id: 'req-123',
      email: 'test@example.com',
      user_id: 'user-123',
      status: 'pending',
    };

    const mockProfile = {
      role: 'pending',
      role_version: 1,
    };

    // Mock request fetch
    const mockFromRequest = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockRequest,
          error: null,
        }),
      }),
    };

    // Mock profile fetch
    const mockFromProfile = {
      from: vi.fn((table: string) => {
        if (table === 'access_requests') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockRequest,
              error: null,
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
            update: vi.fn().mockReturnThis(),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnThis(),
        };
      }),
    };

    vi.mocked(supabaseAdmin.from).mockImplementation(
      mockFromProfile.from as any
    );

    // Mock update calls
    let updateCallCount = 0;
    const mockUpdate = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(() => {
        updateCallCount++;
        return Promise.resolve({ error: null });
      }),
    };

    // Setup mocks
    const requestChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: mockRequest,
        error: null,
      }),
    };

    const profileChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      }),
      update: vi.fn().mockReturnThis(),
    };

    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'access_requests') {
        if (updateCallCount === 0) {
          return requestChain as any;
        }
        return updateChain as any;
      }
      if (table === 'profiles') {
        return profileChain as any;
      }
      return {} as any;
    });

    const response = await request(app)
      .post('/api/admin/access-requests/req-123/approve')
      .set('Authorization', 'Bearer admin-token');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.roleUpdated).toBe(true);
    expect(response.body.data.roleVersion).toBe(2);
  });

  it('should be idempotent (already approved)', async () => {
    vi.mocked(isAdmin).mockResolvedValue(true);

    const mockRequest = {
      id: 'req-123',
      email: 'test@example.com',
      user_id: 'user-123',
      status: 'approved',
    };

    const mockFrom = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockRequest,
          error: null,
        }),
      }),
    };

    vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom.from as any);

    const response = await request(app)
      .post('/api/admin/access-requests/req-123/approve')
      .set('Authorization', 'Bearer admin-token');

    expect(response.status).toBe(200);
    expect(response.body.data.roleUpdated).toBe(false);
  });
});

describe('POST /api/admin/access-requests/:id/deny', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.ctx = { userId: 'admin-123' };
      next();
    });
    app.use('/api/admin/access-requests', accessRequestsAdminRouter);
    vi.clearAllMocks();
  });

  it('should return 403 for non-admin users', async () => {
    vi.mocked(isAdmin).mockResolvedValue(false);

    const response = await request(app)
      .post('/api/admin/access-requests/req-123/deny')
      .send({ reason: 'Not eligible' })
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(403);
  });

  it('should deny request with reason', async () => {
    vi.mocked(isAdmin).mockResolvedValue(true);

    const mockRequest = {
      id: 'req-123',
      email: 'test@example.com',
      status: 'pending',
    };

    const mockFrom = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockRequest,
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
        eq2: vi.fn().mockResolvedValue({ error: null }),
      }),
    };

    let updateChain: any;
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'access_requests') {
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation((col: string, val: string) => {
            if (col === 'id') {
              return {
                single: vi.fn().mockResolvedValue({
                  data: mockRequest,
                  error: null,
                }),
              };
            }
            // For update
            updateChain = {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
            return updateChain;
          }),
          update: vi.fn().mockReturnThis(),
        };
        return chain as any;
      }
      return {} as any;
    });

    const response = await request(app)
      .post('/api/admin/access-requests/req-123/deny')
      .send({ reason: 'Not eligible at this time' })
      .set('Authorization', 'Bearer admin-token');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it('should require reason field', async () => {
    vi.mocked(isAdmin).mockResolvedValue(true);

    const response = await request(app)
      .post('/api/admin/access-requests/req-123/deny')
      .send({})
      .set('Authorization', 'Bearer admin-token');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });
});

