// [CHIMERA V3] Architecture: Greenfield | Layer: Frontend
/**
 * Game Client Service
 * Handles gameplay API calls for the Chimera V3 runtime
 */

import { apiFetch, apiPost } from '@/lib/api';
import type { GameState, Mas2ResponseDto } from '@shared/types/chimera-runtime';

export interface CastStoneResponse {
  mas1: {
    action_slug: string;
    parameters: Record<string, unknown>;
    sentiment: string;
  };
  engine: {
    success: boolean;
    outcome_summary: string;
    numeric_deltas: Record<string, number>;
  };
  mas2: Mas2ResponseDto;
  updatedState: GameState;
}

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
 * Cast a stone (process player input through the game loop)
 */
export async function castStone(
  gameStateId: string,
  text: string
): Promise<CastStoneResponse> {
  const result = await apiPost<CastStoneResponse>(
    `/api/chimera/play/${gameStateId}/cast`,
    {
      userText: text,
    }
  );

  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to cast stone');
  }

  return result.data!;
}

/**
 * Load the current game state
 */
export async function loadState(gameStateId: string): Promise<GameState> {
  // Note: This endpoint may need to be created on the backend
  // For now, we'll get the state from castStone response
  // If a dedicated endpoint is needed, it would be: GET /api/chimera/play/:gameStateId
  const result = await apiFetch<GameState>(`/api/chimera/play/${gameStateId}`);

  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to load game state');
  }

  return result.data!;
}

