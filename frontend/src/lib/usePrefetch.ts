import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { getWorld, getNPC, getRuleset, getStory } from '@/lib/api';

export function usePrefetch() {
  const queryClient = useQueryClient();

  const prefetchWorld = useCallback((idOrSlug: string) => {
    queryClient.prefetchQuery({
      queryKey: ['world', idOrSlug],
      queryFn: () => getWorld(idOrSlug),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  }, [queryClient]);

  const prefetchNPC = useCallback((id: string) => {
    queryClient.prefetchQuery({
      queryKey: ['npc', id],
      queryFn: () => getNPC(id),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  }, [queryClient]);

  const prefetchRuleset = useCallback((id: string) => {
    queryClient.prefetchQuery({
      queryKey: ['ruleset', id],
      queryFn: () => getRuleset(id),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  }, [queryClient]);

  const prefetchStory = useCallback((idOrSlug: string) => {
    queryClient.prefetchQuery({
      queryKey: ['story', idOrSlug],
      queryFn: () => getStory(idOrSlug),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  }, [queryClient]);

  return {
    prefetchWorld,
    prefetchNPC,
    prefetchRuleset,
    prefetchStory,
  };
}
