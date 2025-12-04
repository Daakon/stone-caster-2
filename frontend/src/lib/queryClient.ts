/**
 * Centralized QueryClient configuration
 * Single source of truth for React Query defaults
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,        // 5 minutes (Data is "fresh" immediately)
      gcTime: 1000 * 60 * 30,          // Cache persists for 30m
      refetchOnWindowFocus: false,     // Prevent erratic background refetches
      refetchOnMount: false,           // CRITICAL: If data is in cache, use it. Do not refetch on component mount.
      refetchOnReconnect: false,      // Prevent refetch on network reconnect (use stale data)
      retry: 1,                        // Retry once on failure
      // Ensure queries are deduplicated even in StrictMode
      structuralSharing: true,         // Share identical query results
    },
    mutations: {
      retry: 0,                        // No retries for mutations
    },
  },
});

