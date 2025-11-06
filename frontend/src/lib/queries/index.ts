/**
 * Canonical React Query Hooks
 * Single source of truth for all data fetching
 * All hooks follow query policy: docs/frontend/query-policy.md
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { z } from 'zod';
import { ProfileService } from '@/services/profile';
import { publicAccessRequestsService } from '@/services/accessRequests';
import { getWallet, getMyAdventures, getGame, getLatestTurn } from '@/lib/api';
import { listWorlds, getWorld, listStories } from '@/lib/api';
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/auth';
import type { ProfileDTO } from '@shared/types/dto';
import { GameListDTOSchema } from '@shared/types/dto';
import type { AccessRequest } from '@shared/types/accessRequests';
import type { GameListDTO } from '@shared';
import type { World, Character } from '@/types/domain';
import { queryKeys } from '@/lib/queryKeys';

// ============================================================================
// Validation Schemas
// ============================================================================

const ProfileSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  email: z.string().email().nullable(),
  preferences: z.record(z.unknown()).default({}),
  lastSeen: z.string().datetime().optional(),
});

const AccessRequestSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  user_id: z.string().uuid().nullable(),
  note: z.string().nullable(),
  status: z.enum(['pending', 'approved', 'denied']),
  reason: z.string().nullable(),
  approved_by: z.string().uuid().nullable(),
  approved_at: z.string().nullable(), // Accept any string format, not just ISO datetime
  denied_by: z.string().uuid().nullable(),
  denied_at: z.string().nullable(), // Accept any string format, not just ISO datetime
  meta: z.record(z.unknown()).default({}),
  created_at: z.string(), // Accept any string format, not just ISO datetime
  updated_at: z.string(), // Accept any string format, not just ISO datetime
});

const WalletSchema = z.object({
  balance: z.number().int().min(0),
  currency: z.string().default('stones'),
});

const GameSchema = z.object({
  id: z.string().uuid(),
  adventureId: z.string().uuid(),
  adventureTitle: z.string(),
  adventureDescription: z.string().optional(),
  characterId: z.string().uuid().optional(),
  characterName: z.string().optional(),
  worldSlug: z.string(),
  worldName: z.string(),
  turnCount: z.number().int().min(0),
  status: z.enum(['active', 'completed', 'paused', 'abandoned']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastPlayedAt: z.string().datetime(),
});

const TurnDTOSchema = z.object({
  turn_number: z.number().int(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  meta: z.record(z.unknown()).optional(),
  created_at: z.string().datetime(),
});

// ============================================================================
// Profile Hook
// ============================================================================

export function useProfile() {
  const { user, isAuthenticated } = useAuthStore();
  
  return useQuery({
    queryKey: queryKeys.profile(),
    queryFn: async () => {
      const result = await ProfileService.getProfile();
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to fetch profile');
      }
      const validated = ProfileSchema.parse(result.data);
      return validated;
    },
    enabled: isAuthenticated && !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
  });
}

export type Profile = z.infer<typeof ProfileSchema>;

// ============================================================================
// Admin Roles Hook
// ============================================================================

export function useAdminRoles(userId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.adminUserRoles(userId);
  
  // Check if data already exists in cache - if so, don't fetch
  const cachedData = queryClient.getQueryData<string[]>(queryKey);
  const hasCachedData = cachedData !== undefined;
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!userId) return [];
      const result = await apiClient.get<string[]>('/api/admin/user/roles');
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to fetch roles');
      }
      return result.data;
    },
    // Only fetch if userId exists AND we don't have cached data
    // This prevents duplicate fetches when data is already in cache
    enabled: !!userId && !hasCachedData,
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // Use cached data if available
    initialData: cachedData,
  });
}

// ============================================================================
// Access Status Hook
// ============================================================================

export function useAccessStatus() {
  const { user } = useAuthStore();
  
  return useQuery({
    queryKey: queryKeys.accessRequestStatus(),
    queryFn: async () => {
      const result = await publicAccessRequestsService.getStatus();
      
      if (!result.ok) {
        // Return null for unauthorized (not an error state)
        if (result.code === 'UNAUTHORIZED') {
          return null;
        }
        throw new Error(result.message || 'Failed to fetch access status');
      }
      
      // API returns { request: AccessRequest | null }
      // The service already transforms it to { ok: true, data: AccessRequest | null }
      if (!result.data) {
        return null;
      }
      
      // Validate the access request data
      try {
        const validated = AccessRequestSchema.parse(result.data);
        return validated;
      } catch (error) {
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.error('[useAccessStatus] Validation error:', error);
          console.error('[useAccessStatus] Raw data:', result.data);
        }
        throw new Error('Invalid access request data format');
      }
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
  });
}

export type AccessStatus = z.infer<typeof AccessRequestSchema> | null;

// ============================================================================
// Wallet Hook
// ============================================================================

export function useWallet(options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: queryKeys.wallet(),
    queryFn: async () => {
      const result = await getWallet();
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to fetch wallet');
      }
      const validated = WalletSchema.parse(result.data);
      return validated;
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000,
    refetchOnMount: false,
    refetchInterval: options?.refetchInterval ?? false,
  });
}

export type Wallet = z.infer<typeof WalletSchema>;

// ============================================================================
// Worlds Hooks
// ============================================================================

export function useWorlds(params?: { q?: string }) {
  return useQuery({
    queryKey: queryKeys.worlds({ q: params?.q ?? '' }),
    queryFn: async () => {
      const result = await listWorlds({ q: params?.q });
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to fetch worlds');
      }
      // Basic validation - World type from domain
      return result.data as World[];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    keepPreviousData: true,
  });
}

export function useWorld(idOrSlug: string) {
  return useQuery({
    queryKey: queryKeys.world(idOrSlug),
    queryFn: async () => {
      const result = await getWorld(idOrSlug);
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to fetch world');
      }
      return result.data as World;
    },
    enabled: !!idOrSlug,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
  });
}

// ============================================================================
// Stories Hook
// ============================================================================

const StorySchema = z.object({
  id: z.string(), // Can be UUID or slug
  slug: z.string().nullable().optional(),
  type: z.enum(['scenario', 'adventure']).optional(), // Backend uses 'type', not 'kind'
  title: z.string(),
  subtitle: z.string().nullable().optional(),
  description: z.string().optional(), // Backend uses 'description', not 'short_desc'
  synopsis: z.string().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  world_id: z.string().uuid().nullable().optional(),
  world_name: z.string().nullable().optional(), // Backend returns world_name directly
  world_slug: z.string().nullable().optional(),
  content_rating: z.string().optional(),
  is_playable: z.boolean().optional(),
  has_prompt: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(), // Can be datetime string or other format
  // Additional fields that might be present in detail view
  hero_quote: z.string().nullable().optional(),
  rulesets: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    sort_order: z.number().optional(),
  })).optional().nullable(),
  // Legacy fields for backward compatibility
  kind: z.enum(['scenario', 'adventure']).optional(), // Map type to kind if needed
  short_desc: z.string().optional(), // Map description to short_desc if needed
  ruleset_ids: z.array(z.string().uuid()).optional().default([]), // Extract from rulesets if needed
  hero_url: z.string().url().optional().nullable(),
  world: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string().optional(),
  }).optional().nullable(),
}).passthrough(); // Allow additional fields

export function useStories(params: {
  worldId?: string;
  page?: number;
  filter?: string;
  kind?: 'scenario' | 'adventure';
  ruleset?: string;
  tags?: string[];
}) {
  // Normalize params - coerce numeric strings, ensure consistent key shape
  const normalizedParams = {
    worldId: params.worldId ?? null,
    page: typeof params.page === 'string' ? parseInt(params.page, 10) : (params.page ?? 1),
    filter: params.filter ?? '',
    kind: params.kind ?? null,
    ruleset: params.ruleset ?? null,
    tags: params.tags ?? null,
  };
  
  // PR11-G: React Query automatically cancels previous requests when queryKey changes
  const queryKey = queryKeys.stories(normalizedParams);
  
  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      // Signal is automatically provided by React Query and will cancel on key change
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
      
      // Validate response with Zod and transform to match expected shape
      try {
        const validated = z.array(StorySchema).parse(result.data);
        // Transform to match expected frontend shape (map type->kind, description->short_desc)
        const transformed = validated.map((story) => ({
          ...story,
          kind: story.kind || story.type, // Use type as kind if kind not present
          short_desc: story.short_desc || story.description, // Use description as short_desc
          ruleset_ids: story.ruleset_ids || (story.rulesets?.map((r: any) => r.id) || []), // Extract IDs from rulesets
          world: story.world || (story.world_name ? {
            id: story.world_id || '',
            name: story.world_name,
            slug: story.world_slug || undefined,
          } : undefined),
        }));
        return transformed;
      } catch (error) {
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.error('[useStories] Validation error:', error);
          console.error('[useStories] Raw data:', result.data);
        }
        throw new Error('Invalid stories data format');
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    keepPreviousData: true,
  });
}

export type Story = z.infer<typeof StorySchema>;

// ============================================================================
// Characters Hook
// ============================================================================

export function useCharacters(params?: { worldId?: string }) {
  // PR11-G: React Query automatically cancels previous requests when queryKey changes
  return useQuery({
    queryKey: queryKeys.characters({ worldId: params?.worldId ?? null }),
    queryFn: async ({ signal }) => {
      // Signal is automatically provided by React Query and will cancel on key change
      // Use getCharacters with optional worldSlug filter
      const { getCharacters } = await import('@/lib/api');
      const result = params?.worldId
        ? await getCharacters(params.worldId)
        : await getCharacters();
      
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to fetch characters');
      }
      return result.data as Character[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    keepPreviousData: true,
  });
}

// ============================================================================
// My Adventures Hook
// ============================================================================

export function useMyAdventures() {
  const { user } = useAuthStore();
  
  return useQuery({
    queryKey: queryKeys.myAdventures(),
    queryFn: async () => {
      const result = await getMyAdventures();
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to fetch adventures');
      }
      // Validate each game in the list
      // Use safeParse to handle validation errors gracefully
      const parseResult = z.array(GameListDTOSchema).safeParse(result.data);
      if (!parseResult.success) {
        // Log validation errors in development
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.error('[useMyAdventures] Validation error:', parseResult.error);
          console.error('[useMyAdventures] Raw data:', result.data);
        }
        throw new Error('Invalid adventures data format');
      }
      return parseResult.data;
    },
    enabled: !!user, // Access check is handled by EarlyAccessRoute
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    retry: false, // Disable automatic retries - we handle errors explicitly
  });
}

// ============================================================================
// Game Hook
// ============================================================================

export function useGame(gameId: string) {
  return useQuery({
    queryKey: queryKeys.game(gameId),
    queryFn: async () => {
      const result = await getGame(gameId);
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to fetch game');
      }
      const validated = GameSchema.parse(result.data);
      return validated;
    },
    enabled: !!gameId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000,
    refetchOnMount: false,
  });
}

export type Game = z.infer<typeof GameSchema>;

// ============================================================================
// Latest Turn Hook
// ============================================================================

export function useLatestTurn(gameId: string, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: queryKeys.latestTurn(gameId),
    queryFn: async () => {
      const result = await getLatestTurn(gameId);
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to fetch latest turn');
      }
      const validated = TurnDTOSchema.parse(result.data);
      return validated;
    },
    enabled: !!gameId,
    staleTime: 10 * 1000, // 10 seconds
    gcTime: 30 * 1000,
    refetchOnMount: false, // Rely on mutation/event invalidation
    refetchInterval: options?.refetchInterval ?? false, // Only for debug/dev when events unavailable
  });
}

export type TurnDTO = z.infer<typeof TurnDTOSchema>;

