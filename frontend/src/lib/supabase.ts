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

// Singleton Supabase client to prevent "Multiple GoTrueClient instances" warning
// Only create once and reuse across the application
let supabaseInstance: ReturnType<typeof createClient> | null = null;

/**
 * Get the singleton Supabase client instance
 * IMPORTANT: All imports should use this function, never createClient() directly
 */
export function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        storageKey: 'stonecaster.auth.token', // Use a specific storage key to avoid conflicts
      },
    });
  }
  return supabaseInstance;
}

// Export the singleton instance for backward compatibility
// Session reads (getSession) are local-only and don't hit the network
export const supabase = getSupabaseClient();

// Note: adminSupabase removed - use supabase singleton instead
// If admin operations needed, they should go through the API server













