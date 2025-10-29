/**
 * React Query hooks for the new product model
 * All catalog queries include activeOnly=1 via http client
 */

import { useQuery } from '@tanstack/react-query';
import { listWorlds, listNPCs, listRulesets, listStories, getStory, getWorld, getNPC, getRuleset } from '@/lib/api';
import type { ID, StoryKind } from '@/types/domain';

export const useWorldsQuery = (q?: string) =>
  useQuery({ 
    queryKey: ['worlds', { q }], 
    queryFn: () => listWorlds({ q }) 
  });

export const useNPCsQuery = (p: { q?: string; world?: ID }) =>
  useQuery({ 
    queryKey: ['npcs', p], 
    queryFn: () => listNPCs(p) 
  });

export const useRulesetsQuery = (q?: string) =>
  useQuery({ 
    queryKey: ['rulesets', { q }], 
    queryFn: () => listRulesets({ q }) 
  });

export const useStoriesQuery = (p: { q?: string; world?: ID; kind?: StoryKind; ruleset?: ID; tags?: string[] }) =>
  useQuery({ 
    queryKey: ['stories', p], 
    queryFn: () => listStories(p) 
  });

export const useStoryQuery = (idOrSlug: ID | string) =>
  useQuery({ 
    queryKey: ['story', idOrSlug], 
    queryFn: () => getStory(idOrSlug), 
    enabled: !!idOrSlug 
  });

// Individual detail hooks
export const useWorldQuery = (idOrSlug: ID | string) =>
  useQuery({ 
    queryKey: ['world', idOrSlug], 
    queryFn: () => getWorld(idOrSlug), 
    enabled: !!idOrSlug 
  });

export const useNPCQuery = (id: ID) =>
  useQuery({ 
    queryKey: ['npc', id], 
    queryFn: () => getNPC(id), 
    enabled: !!id 
  });

export const useRulesetQuery = (id: ID) =>
  useQuery({ 
    queryKey: ['ruleset', id], 
    queryFn: () => getRuleset(id), 
    enabled: !!id 
  });

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
