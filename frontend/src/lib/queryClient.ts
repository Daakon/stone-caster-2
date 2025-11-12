/**
 * Centralized QueryClient configuration
 * Single source of truth for React Query defaults
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 minutes
      gcTime: 10 * 60 * 1000,          // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,      // No refetch on tab focus
      refetchOnReconnect: true,         // Refetch on network reconnect
      refetchOnMount: false,            // No refetch on component mount (use cache)
      retry: 1,                         // Retry once on failure
      // Ensure queries are deduplicated even in StrictMode
      structuralSharing: true,         // Share identical query results
    },
    mutations: {
      retry: 0,                         // No retries for mutations
    },
  },
});

