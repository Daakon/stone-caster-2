import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Fail fast if misconfigured
if (!url) {
  throw new Error('VITE_SUPABASE_URL is not set');
}
if (!publishableKey) {
  throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is not set');
}

export const supabase = createClient(url, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
