/**
 * usePendingMedia Hook
 * Phase 3c: React Query hook for fetching pending media with pagination and filters
 */

import { useQuery } from '@tanstack/react-query';
import { listPendingMedia, type ListPendingMediaParams } from '@/services/admin.media';
import type { MediaAssetDTO } from '@shared/types/media';

export interface UsePendingMediaParams {
  limit?: number;
  cursor?: string;
  kind?: 'npc' | 'world' | 'story' | 'site' | 'all';
  owner?: string;
  enabled?: boolean;
}

export interface UsePendingMediaResult {
  items: MediaAssetDTO[];
  nextCursor?: string;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to fetch pending media with keyset pagination and filters
 */
export function usePendingMedia(params: UsePendingMediaParams = {}): UsePendingMediaResult {
  const { limit = 25, cursor, kind, owner, enabled = true } = params;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pendingMedia', { limit, cursor, kind, owner }],
    queryFn: async () => {
      const result = await listPendingMedia({
        limit,
        cursor,
        kind,
        owner,
      });

      if (!result.ok) {
        throw new Error(result.error?.message || 'Failed to fetch pending media');
      }

      return result.data;
    },
    enabled,
    staleTime: 30 * 1000, // 30 seconds - pending queue changes frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    items: data?.items || [],
    nextCursor: data?.nextCursor,
    loading: isLoading,
    error: error instanceof Error ? error : null,
    refetch: () => {
      refetch();
    },
  };
}


