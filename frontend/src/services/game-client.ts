// [CHIMERA V3] Architecture: Greenfield | Layer: Frontend
/**
 * Game Client Service
 * Handles gameplay API calls for the Chimera V3 runtime
 */

import { apiFetch } from '@/lib/api';
import type { GameState } from '@shared/types/chimera-runtime';

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
