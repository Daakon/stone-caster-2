// [CHIMERA V3] Architecture: Greenfield | Layer: Frontend
/**
 * Game Client Service
 * Handles gameplay API calls for the Chimera V3 runtime
 */

import { apiFetch } from "@/lib/api";
import type { PlaySnapshot } from "@shared/types/chimera-play-view";

/**
 * Load the current game state
 * (Turn submission lives in features/active-game/services/activeGameApi.ts)
 */
export async function loadState(gameStateId: string): Promise<PlaySnapshot> {
  const result = await apiFetch<PlaySnapshot>(
    `/api/chimera/play/${gameStateId}`,
  );

  if (!result.ok) {
    throw new Error(result.error.message || "Failed to load game state");
  }

  return result.data!;
}
