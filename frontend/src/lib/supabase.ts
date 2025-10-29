import { createClient } from '@supabase/supabase-js';

// For admin operations, use API base URL instead of direct Supabase URL
const API_BASE = (
  import.meta.env.VITE_API_BASE ?? (window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://api.stonecaster.ai')
).replace(/\/+$/, "");

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create a single Supabase client instance for auth
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













