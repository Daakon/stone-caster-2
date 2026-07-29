/**
 * useAuth Hook (Data Layer)
 * React Query hook acting as Singleton State Manager for user session
 * This is the ONLY place components should access session data
 */

import { useQuery } from '@tanstack/react-query';
import { getSession } from '@/services/auth.service';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Hook to get current user session
 * Uses React Query for automatic deduplication and caching
 * 
 * @returns User session data, loading state, and error
 */
export function useAuth() {
  return useQuery({
    queryKey: queryKeys.session(),
    queryFn: getSession,
    staleTime: Infinity, // Session doesn't change often, cache indefinitely
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}

