/**
 * Fine-grained query invalidation helpers
 * Use these in mutation onSuccess blocks
 */

import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export function invalidateWallet(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.wallet() });
}

export function invalidateMyAdventures(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.myAdventures() });
}

export function invalidateProfile(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
}

export function invalidateStories(
  queryClient: QueryClient,
  params?: { worldId?: string | null; page?: number; filter?: string; kind?: string | null; ruleset?: string | null; tags?: string[] | null }
) {
  // Invalidate all stories queries (canonical key shape)
  queryClient.invalidateQueries({ queryKey: ['stories'] });
}

export function invalidateWorlds(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['worlds'] });
}

export function invalidateCharacters(
  queryClient: QueryClient,
  params?: { worldId?: string | null }
) {
  if (params?.worldId !== undefined) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.characters({ worldId: params.worldId }),
    });
  } else {
    queryClient.invalidateQueries({ queryKey: ['characters'] });
  }
}

export function invalidateGame(queryClient: QueryClient, gameId: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.game(gameId) });
}

export function invalidateLatestTurn(queryClient: QueryClient, gameId: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.latestTurn(gameId) });
}

