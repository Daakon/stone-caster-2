import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { GuestCookieService } from '../services/guestCookie';

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
  linkGuestAccount: (accessToken: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  
  // Helper function to link guest account to authenticated user
  linkGuestAccount: async (accessToken: string) => {
    const guestCookieId = GuestCookieService.getGuestCookieForApi();
    if (!guestCookieId) {
      console.log('[AuthStore] No guest cookie to link');
      return;
    }

    try {
      console.log('[AuthStore] Linking guest account:', guestCookieId);
      const apiBaseUrl = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://api.stonecaster.ai');
      const linkResponse = await fetch(`${apiBaseUrl}/api/profile/link-guest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ cookieGroupId: guestCookieId }),
      });
      
      if (linkResponse.ok) {
        console.log('[AuthStore] Guest account linked successfully');
      } else {
        console.warn('[AuthStore] Failed to link guest account:', linkResponse.status);
      }
    } catch (linkError) {
      console.warn('[AuthStore] Error linking guest account:', linkError);
    }
  },
  
  initialize: async () => {
    try {
      console.log('[AuthStore] Initializing auth store');
      
      // Check if Supabase is configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      console.log('[AuthStore] Supabase URL:', supabaseUrl);
      console.log('[AuthStore] Supabase Key configured:', !!supabaseKey);
      
      if (!supabaseUrl || !supabaseKey || supabaseUrl === 'https://demo.supabase.co') {
        console.warn('[AuthStore] Supabase not configured, running in demo mode');
        set({ user: null, loading: false });
        return;
      }

      console.log('[AuthStore] Getting current session');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[AuthStore] Error getting session:', error);
      } else {
        console.log('[AuthStore] Session retrieved:', !!session);
      }
      
      set({ user: session?.user ?? null, loading: false });

      console.log('[AuthStore] Setting up auth state change listener');
      supabase.auth.onAuthStateChange((event, session) => {
        console.log('[AuthStore] Auth state changed:', event, !!session);
        set({ user: session?.user ?? null });
      });
    } catch (error) {
      console.error('[AuthStore] Auth initialization error:', error);
      set({ loading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    console.log('[AuthStore] Attempting sign in with email:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('[AuthStore] Sign in error:', error);
      throw error;
    }
    
    console.log('[AuthStore] Sign in successful:', !!data.user);
    
    // Link guest account if available
    if (data.session?.access_token) {
      await (useAuthStore.getState().linkGuestAccount)(data.session.access_token);
    }
    
    set({ user: data.user });
  },

  signUp: async (email: string, password: string) => {
    console.log('[AuthStore] Attempting sign up with email:', email);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) {
      console.error('[AuthStore] Sign up error:', error);
      throw error;
    }
    
    console.log('[AuthStore] Sign up successful:', !!data.user);
    
    // Link guest account if available
    if (data.session?.access_token) {
      await (useAuthStore.getState().linkGuestAccount)(data.session.access_token);
    }
    
    set({ user: data.user });
  },

  signOut: async () => {
    console.log('[AuthStore] Signing out');
    await supabase.auth.signOut();
    
    // Clear guest cookie when signing out
    GuestCookieService.clearGuestCookie();
    
    set({ user: null });
  },
}));
