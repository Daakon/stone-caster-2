/**
 * Role Resolver Service
 * Phase B3: Resolve user role from request with LRU caching
 */

import type { Request } from 'express';
import crypto from 'crypto';
import { supabaseAdmin } from './supabase.js';
import { SimpleLRU } from '../lib/lru.js';

export type AppRole = 'pending' | 'early_access' | 'member' | 'admin';

// In-process LRU cache for role lookups (mirrors Worker KV approach)
const roleCache = new SimpleLRU<{ role: AppRole }>(1000);

/**
 * Generate bearer fingerprint for cache key
 */
function bearerKey(bearer: string): string {
  return crypto.createHash('sha256').update(bearer).digest('base64').slice(0, 24);
}

/**
 * Resolve user role from request with LRU caching
 * Uses req.ctx.userId if available (set by auth middleware), otherwise extracts from bearer token
 * @param req - Express request
 * @returns Role and authentication status
 */
export async function resolveRole(req: Request): Promise<{ role: AppRole | null; authed: boolean }> {
  // Extract bearer token for cache key
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  
  // Check LRU cache if we have a bearer token
  if (bearer) {
    const key = 'bf:' + bearerKey(bearer);
    const cached = roleCache.get(key);
    if (cached) {
      return { role: cached.role, authed: true };
    }
  }

  // Fast path: if req.ctx.userId is already set by auth middleware, use it
  if (req.ctx?.userId && !req.ctx.isGuest) {
    try {
      // Get user profile
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', req.ctx.userId)
        .single();

      if (profileError || !profile) {
        return { role: 'pending', authed: true }; // fail-safe: treat as pending
      }

      let role = (profile.role as AppRole) || 'pending';

      // If profile role is 'pending', check for approved access request
      // This handles cases where access was approved by email before user signed up
      if (role === 'pending') {
        // Get user email from auth.users
        const userEmail = req.ctx.user?.email;
        
        if (userEmail) {
          // Check for approved access request by userId or email
          const { data: accessRequest } = await supabaseAdmin
            .from('access_requests')
            .select('status')
            .or(`user_id.eq.${req.ctx.userId},email.eq.${userEmail.toLowerCase()}`)
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (accessRequest) {
            role = 'early_access';
          }
        }
      }

      // Cache result if we have a bearer token
      if (bearer) {
        const key = 'bf:' + bearerKey(bearer);
        const ttlMs = 25000 + Math.floor(Math.random() * 10000); // 25-35s randomized
        roleCache.set(key, { role }, ttlMs);
      }

      return { role, authed: true };
    } catch {
      return { role: 'pending', authed: true };
    }
  }

  // Fallback: extract bearer token and resolve user
  if (!bearer) {
    return { role: null, authed: false };
  }

  try {
    // Use admin client to verify token and get user
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(bearer);

    if (userError || !user) {
      return { role: null, authed: false };
    }

    // Get role from profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return { role: 'pending', authed: true }; // fail-safe: treat as pending
    }

    let role = (profile.role as AppRole) || 'pending';

    // If profile role is 'pending', check for approved access request
    // This handles cases where access was approved by email before user signed up
    if (role === 'pending') {
      const userEmail = user.email;
      
      if (userEmail) {
        // Check for approved access request by userId or email
        const { data: accessRequest } = await supabaseAdmin
          .from('access_requests')
          .select('status')
          .or(`user_id.eq.${user.id},email.eq.${userEmail.toLowerCase()}`)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (accessRequest) {
          role = 'early_access';
        }
      }
    }

    // Cache result
    const key = 'bf:' + bearerKey(bearer);
    const ttlMs = 25000 + Math.floor(Math.random() * 10000); // 25-35s randomized
    roleCache.set(key, { role }, ttlMs);

    return { role, authed: true };
  } catch {
    return { role: 'pending', authed: true };
  }
}

/**
 * Bust server-side role cache for a bearer token
 * Phase B3: Used for cache invalidation after role updates
 */
export function bustServerRoleCacheForBearer(bearer: string): void {
  const key = 'bf:' + bearerKey(bearer);
  roleCache.delete(key);
}

