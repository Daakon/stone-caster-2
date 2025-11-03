/**
 * React Query hooks for turn operations
 * Centralized hooks for latest turn fetching and choice submission
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getLatestTurn, postChoice, postTurn } from '../lib/api';
import type { TurnDTO } from '@shared';

/**
 * Hook to fetch the latest turn for a game
 * Auto-initializes Turn 1 if no turns exist (handled by backend)
 */
export function useLatestTurn(gameId: string | undefined) {
  return useQuery<TurnDTO>({
    queryKey: ['turns.latest', gameId],
    queryFn: async () => {
      if (!gameId) throw new Error('No game ID available');
      const result = await getLatestTurn(gameId);
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to load latest turn');
      }
      return result.data;
    },
    enabled: !!gameId,
    refetchOnWindowFocus: false,
    staleTime: 10 * 1000, // 10 seconds cache
    retry: 1,
  });
}

/**
 * Hook to submit a choice and refresh the latest turn
 * @deprecated Use usePostTurn instead - sends choice text directly
 */
export function usePostChoice(gameId: string | undefined) {
  const queryClient = useQueryClient();
  
  return useMutation<TurnDTO, Error, string>({
    mutationFn: async (choiceId: string) => {
      if (!gameId) throw new Error('No game ID available');
      const result = await postChoice(gameId, choiceId, crypto.randomUUID());
      if (!result.ok) {
        const error = new Error(result.error.message || 'Failed to submit choice');
        (error as any).code = result.error.code;
        throw error;
      }
      return result.data;
    },
    onSuccess: () => {
      // Invalidate and refetch latest turn
      queryClient.invalidateQueries({ queryKey: ['turns.latest', gameId] });
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
  });
}

/**
 * Hook to submit a turn (choice or text) - new format
 * Frontend sends choice text directly instead of UUID
 */
export function usePostTurn(gameId: string | undefined) {
  const queryClient = useQueryClient();
  
  return useMutation<TurnDTO, Error, { kind: 'choice' | 'text'; text: string }>({
    mutationFn: async (payload: { kind: 'choice' | 'text'; text: string }) => {
      if (!gameId) throw new Error('No game ID available');
      const result = await postTurn(gameId, payload, crypto.randomUUID());
      if (!result.ok) {
        const error = new Error(result.error.message || 'Failed to submit turn');
        (error as any).code = result.error.code;
        throw error;
      }
      return result.data;
    },
    onSuccess: () => {
      // Invalidate and refetch latest turn
      queryClient.invalidateQueries({ queryKey: ['turns.latest', gameId] });
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
  });
}

