// [CHIMERA V3] Architecture: Greenfield | Layer: Frontend
/**
 * Game Client Service
 * Handles gameplay API calls for the Chimera V3 runtime
 */

import { apiFetch, apiPost } from '@/lib/api';
import type { GameState } from '@shared/types/chimera-runtime';

export interface StartGameResponse {
  gameStateId: string;
}

/**
 * Start a new game session from a compiled story
 */
export async function startGame(compiledStoryId: string): Promise<StartGameResponse> {
  const result = await apiPost<StartGameResponse>('/api/chimera/play/start', {
    compiledStoryId,
  });

  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to start game');
  }

  return result.data!;
}

/**
 * Load the current game state
 * (Turn submission lives in features/active-game/services/activeGameApi.ts)
 */
export async function loadState(gameStateId: string): Promise<GameState> {
  const result = await apiFetch<GameState>(`/api/chimera/play/${gameStateId}`);

  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to load game state');
  }

  return result.data!;
}

