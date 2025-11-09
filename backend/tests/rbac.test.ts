/**
 * RBAC Tests
 * CI gate: Ensure RBAC middleware works correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireRole } from '../src/middleware/rbac.js';

// Mock Supabase
vi.mock('../src/services/supabase.js', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => ({
            data: { role: 'admin' },
            error: null,
          }),
        }),
      }),
    }),
  },
}));

describe('RBAC Middleware', () => {
  it('should allow publisher role to access publisher endpoints', async () => {
    const req = {
      user: { id: 'test-user' },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn() as NextFunction;

    const middleware = requireRole('publisher');
    await middleware(req, res, next);

    // Should call next() for admin user (mapped to publisher)
    expect(next).toHaveBeenCalled();
  });

  it('should reject viewer role from publisher endpoints', async () => {
    // Mock viewer role
    vi.doMock('../src/services/supabase.js', () => ({
      supabaseAdmin: {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => ({
                data: { role: 'user' }, // Maps to viewer
                error: null,
              }),
            }),
          }),
        }),
      },
    }));

    const req = {
      user: { id: 'test-user' },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn() as NextFunction;

    const middleware = requireRole('publisher');
    await middleware(req, res, next);

    // Should return 403
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

