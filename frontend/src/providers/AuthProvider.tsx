/**
 * AuthProvider
 * Syncs React Query session data to Zustand store (Passive Mode)
 * React Query fetches, Zustand only stores
 */

import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth';
import type { AuthUser } from '@shared/types/auth';
import { AuthState } from '@shared/types/auth';

/**
 * Provider that syncs React Query session to Zustand store
 * This allows legacy components using useAuthStore to continue working
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // 1. Fetch via Singleton Hook (React Query) - deduplicates with other components
  const { data: sessionData, isLoading, isError } = useAuth();

  // 2. Sync to Zustand (for legacy compatibility)
  useEffect(() => {
    if (isLoading) {
      return;
    }

    const store = useAuthStore.getState();

    if (isError) {
      store.setUser(null);
      store.setProfile(null);
      return;
    }

    // Only sync if data is defined (prevents clearing store before first fetch resolves)
    if (sessionData === undefined) {
      return;
    }

    if (sessionData?.user) {
      // Convert MeResponse to AuthUser format
      const authUser: AuthUser = {
        id: sessionData.user.id,
        email: sessionData.user.email,
        displayName: sessionData.user.email || 'User',
        state: AuthState.AUTHENTICATED,
        key: undefined, // Token is handled by Supabase client
      };

      // Update store with user data
      store.setUser(authUser);
      return;
    }

    // Guest user
    const guestUser: AuthUser = {
      id: 'guest',
      state: AuthState.GUEST,
    };
    store.setUser(guestUser);
  }, [sessionData, isLoading, isError]);

  return <>{children}</>;
}

