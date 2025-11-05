/**
 * Admin authentication helpers
 * Used for debug field guards in TurnDTO responses
 */

import type { Request } from 'express';
import { supabaseAdmin } from '../services/supabase.js';

/**
 * Check if the current user is an admin
 * @param req Express request with ctx.userId or user.id
 * @returns true if user has admin role
 */
export async function isAdmin(req: Request): Promise<boolean> {
  try {
    const userId = req.ctx?.userId || req.user?.id;
    if (!userId) {
      return false;
    }

    // Check profiles table for role (Phase 0: Early Access)
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .eq('id', userId)
      .single();

    // Check profiles.role first (primary role)
    if (profile && profile.role === 'admin') {
      console.log('[isAdmin] Admin role found in profiles', { userId, role: profile.role });
      return true;
    }

    // Check app_roles table (multiple roles per user)
    const { data: appRoles, error: appRolesError } = await supabaseAdmin
      .from('app_roles')
      .select('role')
      .eq('user_id', userId);

    if (!appRolesError && appRoles && appRoles.length > 0) {
      const hasAdmin = appRoles.some((r: { role: string }) => r.role === 'admin');
      if (hasAdmin) {
        console.log('[isAdmin] Admin role found in app_roles', { userId, roles: appRoles.map((r: { role: string }) => r.role) });
        return true;
      }
    }

    // Fallback to legacy user_profiles table for backward compatibility
    if (error || !profile) {
      console.log('[isAdmin] Checking legacy user_profiles', { userId, profileError: error?.message });
      const { data: legacyProfile, error: legacyError } = await supabaseAdmin
        .from('user_profiles')
        .select('role')
        .eq('auth_user_id', userId)
        .single();

      if (!legacyError && legacyProfile) {
        const isAdminResult = legacyProfile.role === 'admin' || legacyProfile.role === 'prompt_admin';
        console.log('[isAdmin] Legacy check result', { userId, role: legacyProfile.role, result: isAdminResult });
        return isAdminResult;
      }
    }

    console.log('[isAdmin] No admin role found', { userId, profileRole: profile?.role, appRolesCount: appRoles?.length || 0 });
    return false;
  } catch (error) {
    console.error('[isAdmin] Error checking admin status:', error);
    return false;
  }
}

/**
 * Check if debug fields should be included in response
 * @param req Express request
 * @returns true if isAdmin(req) and ?debug=1 query param is present
 */
export async function allowDebug(req: Request): Promise<boolean> {
  // Check query param first (faster)
  const debugParam = req.query.debug;
  if (debugParam !== '1' && debugParam !== 'true') {
    return false;
  }

  // If debug param is present, check admin status
  return await isAdmin(req);
}

