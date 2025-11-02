/**
 * React Query hooks for the new product model
 * All catalog queries include activeOnly=1 via http client
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listWorlds, listNPCs, listRulesets, listStories, getStory, getWorld, getNPC, getRuleset, listCharacters, createCharacter, createSession, createGuestToken, getSession, getSessionMessages, findExistingSession } from '@/lib/api';
import type { ID, StoryKind } from '@/types/domain';

export const useWorldsQuery = (q?: string) =>
  useQuery({ 
    queryKey: ['worlds', { q }], 
    queryFn: () => listWorlds({ q }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes (formerly cacheTime)
  });

export const useNPCsQuery = (p: { q?: string; world?: ID }) =>
  useQuery({ 
    queryKey: ['npcs', p], 
    queryFn: () => listNPCs(p),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

export const useRulesetsQuery = (q?: string) =>
  useQuery({ 
    queryKey: ['rulesets', { q }], 
    queryFn: () => listRulesets({ q }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

export const useStoriesQuery = (p: { q?: string; world?: ID; kind?: StoryKind; ruleset?: ID; tags?: string[]; limit?: number }) =>
  useQuery({ 
    queryKey: ['stories', p], 
    queryFn: () => listStories(p),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

export const useStoryQuery = (idOrSlug: ID | string) =>
  useQuery({ 
    queryKey: ['story', idOrSlug], 
    queryFn: () => getStory(idOrSlug), 
    enabled: !!idOrSlug,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

// Individual detail hooks
export const useWorldQuery = (idOrSlug: ID | string) =>
  useQuery({ 
    queryKey: ['world', idOrSlug], 
    queryFn: () => getWorld(idOrSlug), 
    enabled: !!idOrSlug,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

export const useNPCQuery = (id: ID) =>
  useQuery({ 
    queryKey: ['npc', id], 
    queryFn: () => getNPC(id), 
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

export const useRulesetQuery = (id: ID) =>
  useQuery({ 
    queryKey: ['ruleset', id], 
    queryFn: () => getRuleset(id), 
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

// ============================================================================
// CHARACTERS & SESSIONS QUERIES - Start Story Flow
// ============================================================================

export const useCharactersQuery = () =>
  useQuery({ 
    queryKey: ['characters'], 
    queryFn: () => listCharacters(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

export const useCreateCharacter = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createCharacter,
    onSuccess: () => {
      // Invalidate and refetch characters list
      queryClient.invalidateQueries({ queryKey: ['characters'] });
    },
  });
};

export const useCreateSession = () => {
	return useMutation({
		mutationFn: (input: any) => {
			if (input && typeof input === 'object' && 'body' in input) {
				return createSession((input as any).body, (input as any).opts);
			}
			return createSession(input);
		},
	});
};

export const useCreateGuestToken = () => {
  return useMutation({
    mutationFn: createGuestToken,
  });
};

// ============================================================================
// TEMP DEPRECATED ALIASES - Remove in Phase 2
// ============================================================================

/**
 * @deprecated Use useStoriesQuery instead. This alias will be removed in Phase 2.
 */
export const useEntriesQuery = useStoriesQuery;

/**
 * @deprecated Use useStoryQuery instead. This alias will be removed in Phase 2.
 */
export const useEntryQuery = useStoryQuery;

export const usePrefetchSessionBundle = () => {
	const qc = useQueryClient();
	return async (sessionId: string) => {
		const prefetch = [
			qc.prefetchQuery({ queryKey: ['session', sessionId], queryFn: () => getSession(sessionId), staleTime: 5_000 }),
			qc.prefetchQuery({ queryKey: ['session', sessionId, 'messages', { limit: 20 }], queryFn: () => getSessionMessages(sessionId, 20), staleTime: 1_000, gcTime: 10 * 60_000 }),
		];
		await Promise.allSettled(prefetch);
	};
};

export const useFindExistingSession = () => {
	return {
		lookup: (storyId: string, characterId: string) => findExistingSession(storyId, characterId),
	};
};
