/**
 * Chimera Play Service
 * API client for Chimera V2 play endpoints
 */

import { apiFetch, apiPost } from '@/lib/api';

export interface ChimeraGameState {
  id: string;
  story_id: string;
  user_id: string;
  current_game_state: {
    tier0_tracked_state: Record<string, unknown>;
    tier1_singular_state: Record<string, unknown>;
    tier2_relational_state: Record<string, unknown>;
  };
  turn_count: number;
  status: 'active' | 'ended' | 'abandoned';
  created_at: string;
  updated_at: string;
}

export interface CharacterSchema {
  world_name: string;
  ui_schema_merged: Record<string, unknown>;
}

export interface FinalizeCharacterRequest {
  character_data: Record<string, unknown>;
}

export interface FinalizeCharacterResponse {
  player_entity_id: string;
  game_state_id: string;
}

export const chimeraPlayService = {
  /**
   * Get character creation schema for a story
   */
  async getCharacterSchema(storyId: string): Promise<CharacterSchema> {
    const result = await apiFetch<CharacterSchema>(`/api/chimera/play/${storyId}/character/schema`);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch character schema');
    }
    return result.data!;
  },

  /**
   * Finalize character creation
   */
  async finalizeCharacter(storyId: string, request: FinalizeCharacterRequest): Promise<FinalizeCharacterResponse> {
    const result = await apiPost<FinalizeCharacterResponse>(`/api/chimera/play/${storyId}/character/finalize`, request);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to finalize character');
    }
    return result.data!;
  },

  /**
   * Quick start - create default character and start game
   */
  async quickStart(storyId: string, characterName?: string): Promise<FinalizeCharacterResponse> {
    const result = await apiPost<FinalizeCharacterResponse>(`/api/chimera/play/${storyId}/quick-start`, {
      character_name: characterName,
    });
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to quick start');
    }
    return result.data!;
  },

  /**
   * Start game with an existing player entity
   */
  async startWithEntity(storyId: string, entityId: string): Promise<ChimeraGameState> {
    const result = await apiPost<ChimeraGameState>(`/api/chimera/play/${storyId}/start-with-entity/${entityId}`, {});
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to start game with entity');
    }
    return result.data!;
  },

  /**
   * Get a game state by ID
   */
  async getGameState(gameStateId: string): Promise<ChimeraGameState> {
    const result = await apiFetch<ChimeraGameState>(`/api/chimera/play/${gameStateId}`);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch game state');
    }
    return result.data!;
  },
  // Turn submission lives in features/active-game/services/activeGameApi.ts
  // (POST /api/games/:id/turn); the legacy /cast-stone route was removed.
};
