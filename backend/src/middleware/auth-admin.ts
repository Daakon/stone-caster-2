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

    // Check user_profiles table for role
    const { data: profile, error } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('auth_user_id', userId)
      .single();

    if (error || !profile) {
      return false;
    }

    // Admin roles: 'admin' or 'prompt_admin'
    return profile.role === 'admin' || profile.role === 'prompt_admin';
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

