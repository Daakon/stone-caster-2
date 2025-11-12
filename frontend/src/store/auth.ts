import { create } from 'zustand';
import { authService } from '../services/auth/AuthService';
import { AuthState, type AuthUser } from '@shared/types/auth';
import type { ProfileDTO } from '@shared/types/dto';

interface AuthStoreState {
  user: AuthUser | null;
  profile: ProfileDTO | null;
  loading: boolean;

  isAuthenticated: boolean;
  isGuest: boolean;
  isCookied: boolean;
  authToken: string | null;
  userId: string | null;
  displayName: string;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithOAuth: (provider: 'google' | 'github' | 'discord') => Promise<void>;
  signOut: () => Promise<void>;
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

  const applyState = (user: AuthUser | null, profile: ProfileDTO | null, loading: boolean) => {
    set(() => ({
      user,
      profile,
      loading,
      ...computeDerivedState(user, profile),
    }));
  };

  const setLoading = (value: boolean) => {
    set((current) => ({
      ...current,
      loading: value,
    }));
  };

  return {
    user: null,
    profile: null,
    loading: true,
    ...computeDerivedState(null, null),

    initialize: async () => {
      try {

        if (!unsubscribe) {
          unsubscribe = authService.subscribe((newUser) => {
            applyState(newUser, newUser?.profile ?? null, false);
          });
        }

        const user = await authService.initialize();
        const currentUser = authService.getCurrentUser() ?? user ?? null;
        applyState(currentUser, currentUser?.profile ?? null, false);
      } catch (error) {
        console.error('[AuthStore] Initialization error:', error);
        applyState(null, null, false);
      }
    },

    signIn: async (email: string, password: string) => {
      try {
        setLoading(true);
        await authService.signIn(email, password);
      } catch (error) {
        console.error('[AuthStore] Sign in error:', error);
        setLoading(false);
        throw error;
      }
    },

    signUp: async (email: string, password: string) => {
      try {
        setLoading(true);
        await authService.signUp(email, password);
      } catch (error) {
        console.error('[AuthStore] Sign up error:', error);
        setLoading(false);
        throw error;
      }
    },

    signInWithOAuth: async (provider: 'google' | 'github' | 'discord') => {
      try {
        setLoading(true);
        await authService.signInWithOAuth(provider);
      } catch (error) {
        console.error('[AuthStore] OAuth sign in error:', error);
        setLoading(false);
        throw error;
      }
    },

    signOut: async () => {
      try {
        setLoading(true);
        await authService.signOut();
      } catch (error) {
        console.error('[AuthStore] Sign out error:', error);
        setLoading(false);
        throw error;
      }
    },
  };
});
