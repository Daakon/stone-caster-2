/**
 * RBAC Tests
 * CI gate: Ensure RBAC middleware works correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextFunction } from 'express';
import { requireRole } from '../src/middleware/rbac.js';

const roleState = {
  appRoles: [{ role: 'admin' }],
  profileRole: null as string | null,
  legacyRole: null as string | null,
};

// Mock Supabase admin client
vi.mock('../src/services/supabase.js', () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: () => ({
        eq: () => {
          if (table === 'app_roles') {
            return Promise.resolve({
              data: roleState.appRoles,
              error: null,
            });
          }

          const respondWithRole = (role: string | null) => ({
            single: () =>
              Promise.resolve(
                role
                  ? { data: { role }, error: null }
                  : { data: null, error: new Error('not found') }
              ),
          });

          if (table === 'profiles') {
            return respondWithRole(roleState.profileRole);
          }

          if (table === 'user_profiles') {
            return respondWithRole(roleState.legacyRole);
          }

          return Promise.resolve({ data: null, error: new Error('unknown table') });
        },
      }),
    }),
  },
}));

beforeEach(() => {
  roleState.appRoles = [{ role: 'admin' }];
  roleState.profileRole = null;
  roleState.legacyRole = null;
});

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
    // Mock viewer role via app_roles fallback
    roleState.appRoles = [];
    roleState.profileRole = 'user';

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

