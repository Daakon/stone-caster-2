/**
 * Query prefetch utilities
 * PR8: Prefetch data on route hover/focus for instant navigation
 */

import type { QueryClient } from '@tanstack/react-query';
import { listWorlds, getWorld, listStories, getGame } from '@/lib/api';
import { queryKeys } from './queryKeys';

// Track prefetched keys to prevent duplicates
const prefetchedKeys = new Set<string>();
const debounceTimers = new Map<string, NodeJS.Timeout>();

/**
 * Debounce prefetch to avoid duplicate calls
 */
function debouncedPrefetch(
  key: string,
  prefetchFn: () => Promise<void>,
  delay: number = 250
): void {
  // Clear existing timer
  const existing = debounceTimers.get(key);
  if (existing) {
    clearTimeout(existing);
  }
  
  // Check if already prefetched
  if (prefetchedKeys.has(key)) {
    return;
  }
  
  // Set new timer
  const timer = setTimeout(() => {
    prefetchFn().then(() => {
      prefetchedKeys.add(key);
      debounceTimers.delete(key);
    }).catch(() => {
      // On error, allow retry
      prefetchedKeys.delete(key);
      debounceTimers.delete(key);
    });
  }, delay);
  
  debounceTimers.set(key, timer);
}

/**
 * Prefetch world data
 */
export function prefetchWorld(queryClient: QueryClient, idOrSlug: string): void {
  const key = `world:${idOrSlug}`;
  
  debouncedPrefetch(key, async () => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.world(idOrSlug),
      queryFn: async () => {
        const result = await getWorld(idOrSlug);
        if (!result.ok) {
          throw new Error(result.error.message || 'Failed to fetch world');
        }
        return result.data;
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  });
}

/**
 * Prefetch stories list
 */
export function prefetchStories(
  queryClient: QueryClient,
  params: {
    worldId?: string;
    page?: number;
    filter?: string;
    kind?: 'scenario' | 'adventure';
    ruleset?: string;
    tags?: string[];
  }
): void {
  const normalizedParams = {
    worldId: params.worldId ?? null,
    page: params.page ?? 1,
    filter: params.filter ?? '',
    kind: params.kind ?? null,
    ruleset: params.ruleset ?? null,
    tags: params.tags ?? null,
  };
  const key = `stories:${JSON.stringify(normalizedParams)}`;
  
  debouncedPrefetch(key, async () => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.stories(normalizedParams),
      queryFn: async () => {
        const listParams: any = {};
        if (normalizedParams.worldId) listParams.world = normalizedParams.worldId;
        if (normalizedParams.filter) listParams.q = normalizedParams.filter;
        if (normalizedParams.kind) listParams.kind = normalizedParams.kind;
        if (normalizedParams.ruleset) listParams.ruleset = normalizedParams.ruleset;
        if (normalizedParams.tags && normalizedParams.tags.length > 0) listParams.tags = normalizedParams.tags;
        
        const result = await listStories(listParams);
        if (!result.ok) {
          throw new Error(result.error.message || 'Failed to fetch stories');
        }
        return result.data;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  });
}

/**
 * Prefetch game data
 */
export function prefetchGame(queryClient: QueryClient, gameId: string): void {
  const key = `game:${gameId}`;
  
  debouncedPrefetch(key, async () => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.game(gameId),
      queryFn: async () => {
        const result = await getGame(gameId);
        if (!result.ok) {
          throw new Error(result.error.message || 'Failed to fetch game');
        }
        return result.data;
      },
      staleTime: 30 * 1000, // 30 seconds
    });
  });
}

/**
 * Clear prefetch cache (useful for testing)
 */
export function clearPrefetchCache(): void {
  prefetchedKeys.clear();
  debounceTimers.forEach(timer => clearTimeout(timer));
  debounceTimers.clear();
}

