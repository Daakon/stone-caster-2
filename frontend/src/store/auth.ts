import { create } from 'zustand';
import { authService } from '../services/auth/AuthService';
import { AuthState, type AuthUser } from '@shared/types/auth';
import type { ProfileDTO } from '@shared/types/dto';

interface AuthStoreState {
  user: AuthUser | null;
  profile: ProfileDTO | null;

  isAuthenticated: boolean;
  isGuest: boolean;
  isCookied: boolean;
  authToken: string | null;
  userId: string | null;
  displayName: string;

  // Actions for setting state (called by AuthProvider sync)
  setUser: (user: AuthUser | null) => void;
  setProfile: (profile: ProfileDTO | null) => void;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithOAuth: (provider: 'google' | 'github' | 'discord') => Promise<void>;
  signOut: () => Promise<void>;
  
  // Legacy: Keep for backward compatibility but it should not fetch
  // AuthProvider handles fetching via React Query
  initialize: () => Promise<void>;
}

const computeDerivedState = (user: AuthUser | null, profile: ProfileDTO | null) => ({
  isAuthenticated: user?.state === AuthState.AUTHENTICATED,
  isGuest: user?.state === AuthState.GUEST,
  isCookied: user?.state === AuthState.COOKIED,
  authToken: user?.key ?? null,
  userId: user?.id ?? null,
  displayName: profile?.displayName || user?.displayName || 'Guest',
});

export const useAuthStore = create<AuthStoreState>((set) => {
  let unsubscribe: (() => void) | null = null;

  const applyState = (user: AuthUser | null, profile: ProfileDTO | null) => {
    set(() => ({
      user,
      profile,
      ...computeDerivedState(user, profile),
    }));
  };

  return {
    user: null,
    profile: null,
    ...computeDerivedState(null, null),

    // Passive setters - called by AuthProvider to sync React Query data
    setUser: (user: AuthUser | null) => {
      set((current) => ({
        ...current,
        user,
        ...computeDerivedState(user, current.profile),
      }));
    },

    setProfile: (profile: ProfileDTO | null) => {
      set((current) => ({
        ...current,
        profile,
        ...computeDerivedState(current.user, profile),
      }));
    },

    // Legacy initialize - kept for backward compatibility
    // NOTE: This should NOT be called for session fetching - use AuthProvider instead
    // This only sets up Supabase auth listener for sign-in/sign-out events
    initialize: async () => {
      try {
        if (!unsubscribe) {
          unsubscribe = authService.subscribe((newUser) => {
            applyState(newUser, newUser?.profile ?? null);
          });
        }
        // Don't fetch session here - AuthProvider handles that via React Query
        // Just set up the listener for auth state changes
      } catch (error) {
        console.error('[AuthStore] Initialization error:', error);
      }
    },

    signIn: async (email: string, password: string) => {
      try {
        await authService.signIn(email, password);
        // Auth state change will be handled by Supabase listener
        // AuthProvider will sync React Query cache
      } catch (error) {
        console.error('[AuthStore] Sign in error:', error);
        throw error;
      }
    },

    signUp: async (email: string, password: string) => {
      try {
        await authService.signUp(email, password);
        // Auth state change will be handled by Supabase listener
        // AuthProvider will sync React Query cache
      } catch (error) {
        console.error('[AuthStore] Sign up error:', error);
        throw error;
      }
    },

    signInWithOAuth: async (provider: 'google' | 'github' | 'discord') => {
      try {
        await authService.signInWithOAuth(provider);
        // Auth state change will be handled by Supabase listener
        // AuthProvider will sync React Query cache
      } catch (error) {
        console.error('[AuthStore] OAuth sign in error:', error);
        throw error;
      }
    },

    signOut: async () => {
      try {
        await authService.signOut();
        // Clear user from store
        set(() => ({
          user: null,
          profile: null,
          ...computeDerivedState(null, null),
        }));
        // AuthProvider will sync React Query cache
      } catch (error) {
        console.error('[AuthStore] Sign out error:', error);
        throw error;
      }
    },
  };
});
