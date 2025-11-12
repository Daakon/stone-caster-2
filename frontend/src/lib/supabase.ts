import { createClient } from '@supabase/supabase-js';
import { getAppConfig, getWebBaseUrl } from '@shared/config/appConfig';

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

let config: ReturnType<typeof getAppConfig>;
let supabaseUrl: string;
let supabaseKey: string;

// Direct access to import.meta.env as fallback (Vite replaces these at build time)
const env = import.meta.env as Record<string, string | undefined>;
const directSupabaseUrl = env.VITE_SUPABASE_URL;
const directSupabaseKey = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

try {
  config = getAppConfig();
  supabaseUrl = config.supabaseUrl;
  supabaseKey = config.supabaseAnonKey;
  
  // If config returned placeholders but we have direct env access, use direct access
  if ((supabaseUrl === 'https://placeholder.supabase.co' && directSupabaseUrl) ||
      (supabaseKey === 'placeholder-anon-key' && directSupabaseKey)) {

    if (directSupabaseUrl) supabaseUrl = directSupabaseUrl;
    if (directSupabaseKey) supabaseKey = directSupabaseKey;
  }
  
  // Warn if still using placeholders
  if (supabaseUrl === 'https://placeholder.supabase.co' || supabaseKey === 'placeholder-anon-key') {

  }
} catch (error) {

  // Use direct import.meta.env access as fallback
  supabaseUrl = directSupabaseUrl || 'https://placeholder.supabase.co';
  supabaseKey = directSupabaseKey || 'placeholder-anon-key';
  
  if (supabaseUrl === 'https://placeholder.supabase.co' || supabaseKey === 'placeholder-anon-key') {

  }
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
    // Get the web base URL for OAuth redirects
    // Note: The redirectTo in client config is a default, but we pass it explicitly in signInWithOAuth
    let redirectUrl: string | undefined;
    try {
      const webBaseUrl = getWebBaseUrl();
      redirectUrl = `${webBaseUrl}/auth/callback`;
    } catch (error) {
      // Fallback if config not available
      if (typeof window !== 'undefined') {
        redirectUrl = `${window.location.origin}/auth/callback`;
      }
    }
    
    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        storageKey: 'stonecaster.auth.token', // Use a specific storage key to avoid conflicts
        // Note: redirectTo here is a default, but signInWithOAuth should use the one passed in options
        // The issue is that Supabase's backend uses the Site URL from dashboard for the state token
        // This can cause redirects to go to production if dashboard is configured for production
        redirectTo: redirectUrl,
      },
    });
    
    // Log the configuration for debugging
    if (redirectUrl) {

    }
  }
  return supabaseInstance;
}

// Export the singleton instance for backward compatibility
// Session reads (getSession) are local-only and don't hit the network
export const supabase = getSupabaseClient();

// Note: adminSupabase removed - use supabase singleton instead
// If admin operations needed, they should go through the API server

