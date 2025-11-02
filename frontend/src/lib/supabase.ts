import { createClient } from '@supabase/supabase-js';
import { API_BASE } from './apiBase';

/**
 * Supabase Configuration
 * 
 * IMPORTANT: The Supabase client is ONLY used for OAuth flows (Google, GitHub, Discord).
 * These flows require redirecting to Supabase's OAuth provider endpoints.
 * 
 * All other API calls (including session management) go through:
 * - http://localhost:3000 (development)
 * - https://api.stonecaster.ai (production)
 * 
 * Session tokens are stored in localStorage by Supabase and automatically
 * attached to API requests via the Authorization header.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create a single Supabase client instance for OAuth flows only
// Session reads (getSession) are local-only and don't hit the network
export const supabase = createClient(supabaseUrl, supabaseKey);

// Create an admin client that uses the Supabase URL for data operations
export const adminSupabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Use the same auth as the main client
    autoRefreshToken: true,
    persistSession: true,
  },
  global: {
    headers: {
      'apikey': supabaseKey,
    },
  },
});













