export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_PUBLISHABLE = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string;

// API configuration
export const PUBLIC_API_MODE = import.meta.env.VITE_PUBLIC_API_MODE === 'true' || 
  import.meta.env.MODE === 'production';