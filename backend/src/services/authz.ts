/**
 * Authorization utilities
 * Helper functions for role-based access control
 */

import { Request } from 'express';
import { supabaseAdmin } from './supabase.js';

/**
 * Get user role from request
 * @param req - Express request
 * @returns User role string or null if not authenticated/admin
 */
export async function getUserRole(req: Request): Promise<string | null> {
  try {
    const userId = req.ctx?.userId;
    if (!userId) {
      return null;
    }

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('auth_user_id', userId)
      .single();

    return profile?.role || null;
  } catch (error) {
    console.error('[AUTHZ] Error getting user role:', error);
    return null;
  }
}

/**
 * Require admin role - throws if not admin
 * @param req - Express request
 * @throws Error if user is not admin
 */
export async function requireAdmin(req: Request): Promise<void> {
  const role = await getUserRole(req);
  if (role !== 'admin') {
    throw new Error('Admin role required');
  }
}

/**
 * Check if user is admin
 * @param req - Express request
 * @returns true if user is admin
 */
export async function isAdmin(req: Request): Promise<boolean> {
  const role = await getUserRole(req);
  return role === 'admin';
}

