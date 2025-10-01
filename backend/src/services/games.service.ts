import { supabaseAdmin } from './supabase.js';
import { ApiErrorCode } from 'shared';
import type { TurnResponse } from 'shared';

export interface Game {
  id: string;
  adventure_id: string;
  character_id?: string;
  user_id: string;
  state_snapshot: any;
  turn_index: number;
  world_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface SpawnRequest {
  adventureId: string;
  characterId?: string;
  owner: string;
}

export interface SpawnResult {
  success: boolean;
  game?: Game;
  error?: ApiErrorCode;
  message?: string;
}

export class GamesService {
  /**
   * Spawn a new game for a character and adventure
   * @param request - Spawn request parameters
   * @returns Spawn result with success status and game data
   */
  async spawn(request: SpawnRequest): Promise<SpawnResult> {
    const { adventureId, characterId, owner } = request;

    try {
      // Load adventure and validate it exists
      const { data: adventure, error: adventureError } = await supabaseAdmin
        .from('adventures')
        .select('id, world_id, title')
        .eq('id', adventureId)
        .single();

      if (adventureError || !adventure) {
        return {
          success: false,
          error: ApiErrorCode.NOT_FOUND,
          message: 'Adventure not found',
        };
      }

      // If character is specified, validate it exists and is available
      if (characterId) {
        const { data: character, error: characterError } = await supabaseAdmin
          .from('characters')
          .select('id, user_id, world_id, active_game_id, name')
          .eq('id', characterId)
          .single();

        if (characterError || !character) {
          return {
            success: false,
            error: ApiErrorCode.NOT_FOUND,
            message: 'Character not found',
          };
        }

        // Check character ownership
        if (character.user_id !== owner) {
          return {
            success: false,
            error: ApiErrorCode.FORBIDDEN,
            message: 'Character does not belong to user',
          };
        }

        // Check character is not already active in another game
        if (character.active_game_id) {
          return {
            success: false,
            error: ApiErrorCode.CONFLICT,
            message: 'Character is already active in another game',
          };
        }

        // Check character and adventure are from the same world
        if (character.world_id !== adventure.world_id) {
          return {
            success: false,
            error: ApiErrorCode.CONFLICT,
            message: 'Character and adventure must be from the same world',
          };
        }
      }

      // Create new game
      const newGame = {
        adventure_id: adventureId,
        character_id: characterId || null,
        user_id: owner,
        state_snapshot: {},
        turn_index: 0,
        world_id: adventure.world_id,
        created_at: new Date().toISOString(),
      };

      const { data: createdGame, error: createError } = await supabaseAdmin
        .from('games')
        .insert(newGame)
        .select('*')
        .single();

      if (createError) {
        console.error('Error creating game:', createError);
        return {
          success: false,
          error: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to create game',
        };
      }

      // Update character to mark it as active in this game
      if (characterId) {
        const { error: updateError } = await supabaseAdmin
          .from('characters')
          .update({
            active_game_id: createdGame.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', characterId);

        if (updateError) {
          console.error('Error updating character active game:', updateError);
          // Don't fail the spawn, just log the error
        }
      }

      return {
        success: true,
        game: createdGame,
      };
    } catch (error) {
      console.error('Unexpected error in spawn:', error);
      return {
        success: false,
        error: ApiErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
      };
    }
  }

  /**
   * Load a game by ID
   * @param gameId - Game ID
   * @returns Game object or null if not found
   */
  async loadGame(gameId: string): Promise<Game | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        console.error('Error loading game:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Unexpected error in loadGame:', error);
      return null;
    }
  }

  /**
   * Apply a turn result to a game
   * @param gameId - Game ID
   * @param turnResult - Turn result from AI
   * @returns Turn record with ID and metadata
   */
  async applyTurn(gameId: string, turnResult: TurnResponse): Promise<any> {
    try {
      // Create turn record
      const turnRecord = {
        game_id: gameId,
        ai_response: turnResult,
        created_at: new Date().toISOString(),
      };

      const { data: createdTurn, error: turnError } = await supabaseAdmin
        .from('turns')
        .insert(turnRecord)
        .select('*')
        .single();

      if (turnError) {
        console.error('Error creating turn record:', turnError);
        throw new Error(`Failed to create turn record: ${turnError.message}`);
      }

      // Update game state
      const currentGame = await this.loadGame(gameId);
      if (!currentGame) {
        throw new Error('Game not found for turn application');
      }

      const newState = {
        ...currentGame.state_snapshot,
        ...turnResult.worldStateChanges,
      };

      const newTurnIndex = currentGame.turn_index + 1;
      const serverSummary = this.generateServerSummary(turnResult);

      const { error: updateError } = await supabaseAdmin
        .from('games')
        .update({
          state_snapshot: newState,
          turn_index: newTurnIndex,
          server_summary: serverSummary,
          updated_at: new Date().toISOString(),
        })
        .eq('id', gameId);

      if (updateError) {
        console.error('Error updating game state:', updateError);
        throw new Error(`Failed to update game state: ${updateError.message}`);
      }

      return createdTurn;
    } catch (error) {
      console.error('Unexpected error in applyTurn:', error);
      throw error;
    }
  }

  /**
   * Generate a server summary from turn result
   * @param turnResult - Turn result from AI
   * @returns Server summary string
   */
  private generateServerSummary(turnResult: TurnResponse): string {
    const summary = turnResult.narrative.substring(0, 100);
    return summary.length < turnResult.narrative.length ? `${summary}...` : summary;
  }

  /**
   * End a game and free up the character
   * @param gameId - Game ID
   * @returns Success status
   */
  async endGame(gameId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const game = await this.loadGame(gameId);
      if (!game) {
        return {
          success: false,
          error: 'Game not found',
        };
      }

      // Update game status
      const { error: gameError } = await supabaseAdmin
        .from('games')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', gameId);

      if (gameError) {
        console.error('Error updating game status:', gameError);
        return {
          success: false,
          error: 'Failed to update game status',
        };
      }

      // Free up character if it exists
      if (game.character_id) {
        const { error: characterError } = await supabaseAdmin
          .from('characters')
          .update({
            active_game_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', game.character_id);

        if (characterError) {
          console.error('Error freeing character:', characterError);
          // Don't fail the operation, just log
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Unexpected error in endGame:', error);
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }
}

export const gamesService = new GamesService();
