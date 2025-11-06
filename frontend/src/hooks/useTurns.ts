/**
 * React Query hooks for turn operations
 * Centralized hooks for latest turn fetching and choice submission
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getLatestTurn, postChoice, postTurn } from '../lib/api';
import type { TurnDTO } from '@shared';
import { queryKeys } from '../lib/queryKeys';

/**
 * Hook to fetch the latest turn for a game
 * Auto-initializes Turn 1 if no turns exist (handled by backend)
 */
export function useLatestTurn(gameId: string | undefined) {
  return useQuery<TurnDTO>({
    queryKey: queryKeys.latestTurn(gameId),
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
    retry: false, // No automatic retries - errors should be handled via user interaction
  });
}

/**
 * Hook to submit a choice and refresh the latest turn
 * @deprecated Use usePostTurn instead - sends choice text directly
 * Uses precise invalidations per PR7
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
      // Precise invalidations - only affected queries
      if (gameId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.latestTurn(gameId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.game(gameId) });
      }
    },
    retry: false, // No automatic retries - errors should be handled via user interaction
  });
}

/**
 * Hook to submit a turn (choice or text) - new format
 * Frontend sends choice text directly instead of UUID
 * Uses precise invalidations per PR7
 * PR11-D: Optimistic wallet update with rollback
 */
export function usePostTurn(gameId: string | undefined) {
  const queryClient = useQueryClient();
  
  return useMutation<TurnDTO, Error, { kind: 'choice' | 'text'; text: string; stonesSpent?: number }>({
    mutationFn: async (payload: { kind: 'choice' | 'text'; text: string; stonesSpent?: number }) => {
      if (!gameId) throw new Error('No game ID available');
      const result = await postTurn(gameId, payload, crypto.randomUUID());
      if (!result.ok) {
        const error = new Error(result.error.message || 'Failed to submit turn');
        (error as any).code = result.error.code;
        throw error;
      }
      return { ...result.data, stonesSpent: payload.stonesSpent };
    },
    onMutate: async (payload) => {
      // PR11-D: Optimistic wallet update if stones spent
      if (payload.stonesSpent && payload.stonesSpent > 0) {
        const walletKey = queryKeys.wallet();
        
        // Cancel outgoing wallet queries
        await queryClient.cancelQueries({ queryKey: walletKey });
        
        // Snapshot current wallet
        const previousWallet = queryClient.getQueryData(walletKey);
        
        // Optimistically update wallet
        queryClient.setQueryData(walletKey, (old: any) => {
          if (!old) return old;
          return {
            ...old,
            balance: Math.max(0, (old.balance || 0) - payload.stonesSpent),
          };
        });
        
        return { previousWallet };
      }
      return {};
    },
    onError: (_error, _payload, context) => {
      // PR11-D: Rollback wallet on error
      if (context?.previousWallet) {
        queryClient.setQueryData(queryKeys.wallet(), context.previousWallet);
      }
    },
    onSuccess: (data) => {
      // Precise invalidations - only affected queries
      if (gameId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.latestTurn(gameId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.game(gameId) });
      }
      
      // If stones were spent, invalidate wallet to get fresh data
      if (data.stonesSpent && data.stonesSpent > 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet() });
      }
    },
    retry: false, // No automatic retries - errors should be handled via user interaction
  });
}

