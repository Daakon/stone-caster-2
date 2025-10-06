import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { ApiErrorCode } from '@shared';

// Mock Supabase first
vi.mock('../services/supabase.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

import { requireAdmin } from './adminAuth.js';

describe('Admin Authentication Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let mockSupabase: any;

  beforeEach(async () => {
    req = {
      headers: {
        authorization: 'Bearer valid-token',
      },
      ctx: undefined,
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
    vi.clearAllMocks();
    
    // Get the mocked supabase
    const { supabase } = await import('../services/supabase.js');
    mockSupabase = vi.mocked(supabase);
  });

  it('should allow admin users to access admin routes', async () => {
    // Mock admin user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'admin-user-123',
          email: 'admin@example.com',
          user_metadata: {
            role: 'admin',
          },
        },
      },
      error: null,
    });

    await requireAdmin(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(req.ctx).toEqual({
      userId: 'admin-user-123',
      isGuest: false,
      user: {
        id: 'admin-user-123',
        email: 'admin@example.com',
        isGuest: false,
        role: 'admin',
      },
    });
  });

  it('should reject non-admin users with FORBIDDEN', async () => {
    // Mock regular user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'regular-user-123',
          email: 'user@example.com',
          user_metadata: {
            role: 'user',
          },
        },
      },
      error: null,
    });

    await requireAdmin(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: ApiErrorCode.FORBIDDEN,
        message: 'Admin access required',
      },
      meta: {
        traceId: expect.any(String),
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject users without role metadata', async () => {
    // Mock user without role
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'user@example.com',
          user_metadata: {},
        },
      },
      error: null,
    });

    await requireAdmin(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: ApiErrorCode.FORBIDDEN,
        message: 'Admin access required',
      },
      meta: {
        traceId: expect.any(String),
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject invalid tokens with UNAUTHORIZED', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Invalid token'),
    });

    await requireAdmin(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: ApiErrorCode.UNAUTHORIZED,
        message: 'Invalid or expired token',
      },
      meta: {
        traceId: expect.any(String),
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject requests without authorization header', async () => {
    req.headers = {};

    await requireAdmin(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: ApiErrorCode.UNAUTHORIZED,
        message: 'Authentication required',
      },
      meta: {
        traceId: expect.any(String),
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should handle Supabase errors gracefully', async () => {
    mockSupabase.auth.getUser.mockRejectedValue(new Error('Supabase error'));

    await requireAdmin(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: 'Authentication failed',
      },
      meta: {
        traceId: expect.any(String),
      },
    });
    expect(next).not.toHaveBeenCalled();
  });
});
