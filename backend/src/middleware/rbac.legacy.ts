/**
 * RBAC Middleware
 * Role-based access control for admin endpoints
 */

import { supabaseAdmin } from '../services/supabase.js';
import type { Request, Response, NextFunction } from 'express';

export type AdminRole = 'viewer' | 'editor' | 'publisher';
type LegacyRole = 'creator' | 'moderator' | 'admin' | 'prompt_admin';
type RoleRequirement = AdminRole | LegacyRole | Array<AdminRole | LegacyRole>;

const roleLevels: Record<AdminRole, number> = {
  viewer: 1,
  editor: 2,
  publisher: 3,
};

function mapRoleName(role?: string | null): AdminRole | null {
  if (!role) {
    return null;
  }

  const normalized = role.toLowerCase();
  if (normalized === 'publisher') {
    return 'publisher';
  }
  if (normalized === 'editor') {
    return 'editor';
  }
  if (normalized === 'viewer') {
    return 'viewer';
  }
  if (normalized === 'admin' || normalized === 'prompt_admin') {
    return 'publisher';
  }
  if (normalized === 'moderator') {
    return 'editor';
  }
  if (normalized === 'creator') {
    return 'viewer';
  }

  return null;
}

/**
 * Get user's admin role from app_roles / profiles
 */
async function getUserAdminRole(userId: string): Promise<AdminRole | null> {
  // Phase 5+ roles live in app_roles with one row per role
  try {
    const { data: appRoles, error: appRolesError } = await supabaseAdmin
      .from('app_roles')
      .select('role')
      .eq('user_id', userId);

    if (!appRolesError && appRoles && appRoles.length > 0) {
      const roleNames = appRoles.map((row: { role: string }) => row.role);
      if (roleNames.some((role) => mapRoleName(role) === 'publisher')) {
        return 'publisher';
      }
      if (roleNames.some((role) => mapRoleName(role) === 'editor')) {
        return 'editor';
      }
      if (roleNames.some((role) => mapRoleName(role) === 'viewer')) {
        return 'viewer';
      }
    }
  } catch (error) {
    console.warn('[RBAC] Failed to load app_roles', { error });
  }

  // Fallback to profiles.role (legacy Phase 0 data model)
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (!error && data) {
      const mapped = mapRoleName((data as any).role);
      if (mapped) {
        return mapped;
      }
    }
  } catch (error) {
    console.warn('[RBAC] Failed to load profiles role', { error });
  }

  // Final fallback to legacy user_profiles table
  try {
    const { data } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('auth_user_id', userId)
      .single();

    if (data) {
      const mapped = mapRoleName((data as any).role);
      if (mapped) {
        return mapped;
      }
    }
  } catch (error) {
    console.warn('[RBAC] Failed to load user_profiles role', { error });
  }

  return null;
}

/**
 * Require minimum role level
 */
export function requireRole(required: RoleRequirement) {
  const requiredRoles = Array.isArray(required) ? required : [required];
  const normalizedRoles = requiredRoles
    .map((role) => mapRoleName(role))
    .filter((role): role is AdminRole => Boolean(role));
  const minLevel =
    normalizedRoles.length > 0
      ? Math.min(...normalizedRoles.map((role) => roleLevels[role]))
      : roleLevels.viewer;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      const userRole = await getUserAdminRole(userId);
      if (!userRole) {
        return res.status(403).json({ ok: false, error: 'Access denied' });
      }

      if (roleLevels[userRole] < minLevel) {
        return res.status(403).json({
          ok: false,
          error: `Insufficient permissions. Required: ${normalizedRoles.join(' | ') || 'viewer'}, have: ${userRole}`,
        });
      }

      // Attach role to request for use in handlers
      (req as any).adminRole = userRole;
      next();
    } catch (error) {
      console.error('RBAC check error:', error);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  };
}

