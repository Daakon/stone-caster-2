import { create } from 'zustand';
import { authService } from '../services/auth/AuthService';
import type { AuthUser } from 'shared';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  
  // Computed values - simple boolean flags and values
  isAuthenticated: boolean;
  isGuest: boolean;
  isCookied: boolean;
  authToken: string | null;
  userId: string | null;
  displayName: string;
  
  // Actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithOAuth: (provider: 'google' | 'github' | 'discord') => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  
  // Computed values
  get isAuthenticated() {
    return get().user?.state === 'authenticated';
  },
  
  get isGuest() {
    return get().user?.state === 'guest';
  },
  
  get isCookied() {
    return get().user?.state === 'cookied';
  },
  
  get authToken() {
    return get().user?.key || null;
  },
  
  get userId() {
    return get().user?.id || null;
  },
  
  get displayName() {
    return get().user?.displayName || 'Guest';
  },
  
  initialize: async () => {
    try {
      console.log('[AuthStore] Initializing auth store');
      const user = await authService.initialize();
      set({ user, loading: false });
      
      // Subscribe to auth changes
      authService.subscribe((newUser) => {
        set({ user: newUser, loading: false });
      });
    } catch (error) {
      console.error('[AuthStore] Initialization error:', error);
      set({ user: null, loading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      set({ loading: true });
      await authService.signIn(email, password);
      // Auth state will be updated via subscription
    } catch (error) {
      console.error('[AuthStore] Sign in error:', error);
      set({ loading: false });
      throw error;
    }
  },

  signUp: async (email: string, password: string) => {
    try {
      set({ loading: true });
      await authService.signUp(email, password);
      // Auth state will be updated via subscription
    } catch (error) {
      console.error('[AuthStore] Sign up error:', error);
      set({ loading: false });
      throw error;
    }
  },

  signInWithOAuth: async (provider: 'google' | 'github' | 'discord') => {
    try {
      set({ loading: true });
      await authService.signInWithOAuth(provider);
      // Auth state will be updated via subscription after redirect
    } catch (error) {
      console.error('[AuthStore] OAuth sign in error:', error);
      set({ loading: false });
      throw error;
    }
  },

  signOut: async () => {
    try {
      set({ loading: true });
      await authService.signOut();
      // Auth state will be updated via subscription
    } catch (error) {
      console.error('[AuthStore] Sign out error:', error);
      set({ loading: false });
      throw error;
    }
  },
}));