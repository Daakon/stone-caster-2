/**
 * Supabase Client Factory
 * Creates RLS-respecting Supabase clients for request context
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import type { Request } from 'express';

/**
 * Get a Supabase client that respects RLS
 * If a bearer token is present in the request, it will be used for authentication
 * @param req - Express request (optional, for token extraction)
 * @returns Supabase client configured with anon key and optional auth token
 */
export function getSupabaseClient(req?: Request): SupabaseClient {
  const client = createClient(
    config.supabase.url,
    config.supabase.anonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  // If request has a bearer token, set it for auth context
  // Note: For RLS, we need to set the auth context properly
  if (req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // Set auth header for subsequent requests
      // Supabase client will use this token for RLS checks
      client.auth.setSession({
        access_token: token,
        refresh_token: '',
      } as any).catch(() => {
        // Ignore errors - token might be invalid, but let RLS handle it
      });
    }
  }

  return client;
}

