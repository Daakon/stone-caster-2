/**
 * RBAC Middleware
 * Role-based access control for admin endpoints
 */

import { supabaseAdmin } from '../services/supabase.js';
import type { Request, Response, NextFunction } from 'express';

export type AdminRole = 'viewer' | 'editor' | 'publisher';

/**
 * Get user's admin role from profiles table
 */
async function getUserAdminRole(userId: string): Promise<AdminRole | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  // Map profile role to admin role
  // For now, 'admin' = publisher, 'moderator' = editor, others = viewer
  const profileRole = (data as any).role;
  if (profileRole === 'admin') {
    return 'publisher';
  }
  if (profileRole === 'moderator') {
    return 'editor';
  }
  return 'viewer';
}

/**
 * Require minimum role level
 */
export function requireRole(minRole: AdminRole) {
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

      // Role hierarchy: viewer < editor < publisher
      const roleLevels: Record<AdminRole, number> = {
        viewer: 1,
        editor: 2,
        publisher: 3,
      };

      if (roleLevels[userRole] < roleLevels[minRole]) {
        return res.status(403).json({
          ok: false,
          error: `Insufficient permissions. Required: ${minRole}, have: ${userRole}`,
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

