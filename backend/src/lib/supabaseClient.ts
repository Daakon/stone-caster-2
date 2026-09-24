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
  // Send the user's JWT as a global Authorization header so RLS is evaluated as that user.
  // (auth.setSession() with an empty refresh token silently fails and leaves the client acting as `anon`.)
  const authHeader = req?.headers.authorization;
  const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader : undefined;

  return createClient(
    config.supabase.url,
    config.supabase.anonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      ...(bearer ? { global: { headers: { Authorization: bearer } } } : {}),
    }
  );
}
