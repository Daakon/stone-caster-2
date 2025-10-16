import { supabaseAdmin } from './supabase.js';
import { ApiErrorCode, GameDTO, GameListDTO, AdventureDTO } from '@shared';
import type { TurnResponse } from '@shared';
import { ContentService } from './content.service.js';
import { CharactersService } from './characters.service.js';
import { WalletService } from './wallet.service.js';
import { LedgerService } from './ledger.service.js';
import { configService } from './config.service.js';

export interface Game {
  id: string;
  adventure_id: string;
  character_id?: string;
  user_id?: string;
  cookie_group_id?: string;
  world_slug: string;
  state_snapshot: any;
  turn_count: number;
  status: 'active' | 'completed' | 'paused' | 'abandoned';
  created_at: string;
  updated_at: string;
  last_played_at: string;
}

export interface SpawnRequest {
  adventureSlug: string;
  characterId?: string;
  ownerId: string;
  isGuest: boolean;
}

export interface SpawnResult {
  success: boolean;
  game?: GameDTO;
  error?: ApiErrorCode;
  message?: string;
  existingGameId?: string;
}

export class GamesService {
  /**
   * Spawn a new game for a character and adventure
   * @param request - Spawn request parameters
   * @returns Spawn result with success status and game data
   */
  async spawn(request: SpawnRequest): Promise<SpawnResult> {
    const { adventureSlug, characterId, ownerId, isGuest } = request;

    try {
      // Load adventure and validate it exists
      const { data: adventure, error: adventureError } = await supabaseAdmin
        .from('adventures')
        .select('id, slug, title, description, world_slug')
        .eq('slug', adventureSlug)
        .eq('is_active', true)
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
        const character = await CharactersService.getCharacterById(characterId, ownerId, isGuest);
        if (!character) {
          return {
            success: false,
            error: ApiErrorCode.NOT_FOUND,
            message: 'Character not found',
          };
        }

        // Check character is not already active in another game
        if (character.activeGameId) {
          return {
            success: false,
            error: ApiErrorCode.CONFLICT,
            message: 'Character is already active in another game',
            existingGameId: character.activeGameId,
          };
        }

        // Check character and adventure are from the same world
        if (character.worldSlug !== adventure.world_slug) {
          return {
            success: false,
            error: ApiErrorCode.VALIDATION_FAILED,
            message: 'Character and adventure must be from the same world',
          };
        }
      }

      // For guest users, ensure they have a cookie group
      if (isGuest) {
        await this.ensureGuestCookieGroup(ownerId);
      }

      // Check for starter stones grant (if enabled and first spawn)
      await this.handleStarterStonesGrant(ownerId, isGuest);

      // Create new game
      const newGame = {
        adventure_id: adventure.id,
        character_id: characterId || null,
        world_slug: adventure.world_slug,
        state_snapshot: {},
        turn_count: 0,
        status: 'active' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_played_at: new Date().toISOString(),
        // Set owner based on user type
        ...(isGuest ? { cookie_group_id: ownerId } : { user_id: ownerId })
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

      // Convert to DTO
      const gameDTO = await this.mapGameToDTO(createdGame);

      return {
        success: true,
        game: gameDTO,
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
   * Get a single game by ID with proper ownership validation
   * @param gameId - Game ID
   * @param ownerId - Owner ID (user ID or cookie group ID)
   * @param isGuest - Whether the owner is a guest
   * @returns Game DTO or null if not found
   */
  async getGameById(gameId: string, ownerId: string, isGuest: boolean): Promise<GameDTO | null> {
    try {
      let query = supabaseAdmin
        .from('games')
        .select(`
          *,
          adventures!inner(id, slug, title, description, world_slug),
          characters!games_character_id_fkey(id, name, world_data, level, current_health, max_health, race, class)
        `)
        .eq('id', gameId);

      // For linked users, check both user_id and cookie_group_id
      // This allows authenticated users to access games created by their linked guest account
      // and vice versa, except for real money transactions
      if (isGuest) {
        query = query.eq('cookie_group_id', ownerId);
      } else {
        // For authenticated users, check both user_id and cookie_group_id
        // This handles the case where a game was created as guest but accessed as authenticated user
        query = query.or(`user_id.eq.${ownerId},cookie_group_id.eq.${ownerId}`);
      }

      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found or not owned by user
        }
        console.error('Error fetching game:', error);
        return null;
      }

      return await this.mapGameToDTO(data);
    } catch (error) {
      console.error('Unexpected error in getGameById:', error);
      return null;
    }
  }

  /**
   * Get games list for a user
   * @param ownerId - Owner ID (user ID or cookie group ID)
   * @param isGuest - Whether the owner is a guest
   * @param limit - Maximum number of games to return
   * @param offset - Number of games to skip
   * @returns Array of GameListDTO
   */
  async getGames(ownerId: string, isGuest: boolean, limit: number = 20, offset: number = 0): Promise<GameListDTO[]> {
    try {
      let query = supabaseAdmin
        .from('games')
        .select(`
          id,
          turn_count,
          status,
          last_played_at,
          adventures!inner(title, world_slug),
          characters!games_character_id_fkey(name)
        `)
        .order('last_played_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Filter by owner - for linked users, check both user_id and cookie_group_id
      if (isGuest) {
        query = query.eq('cookie_group_id', ownerId);
      } else {
        // For authenticated users, check both user_id and cookie_group_id
        // This handles the case where games were created as guest but accessed as authenticated user
        query = query.or(`user_id.eq.${ownerId},cookie_group_id.eq.${ownerId}`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching games:', error);
        return [];
      }

      return (data || []).map(this.mapGameToListDTO);
    } catch (error) {
      console.error('Unexpected error in getGames:', error);
      return [];
    }
  }

  /**
   * Load a game by ID (internal method)
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
   * Check if a string is a valid UUID
   * @param str - String to check
   * @returns True if valid UUID
   */
  private isValidUuid(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  /**
   * Apply a turn result to a game
   * @param gameId - Game ID
   * @param turnResult - Turn result from AI
   * @param optionId - Selected option ID
   * @param turnData - Comprehensive turn data for recording
   * @returns Turn record with ID and metadata
   */
  async applyTurn(
    gameId: string, 
    turnResult: TurnResponse, 
    optionId: string, 
    turnData?: {
      userInput?: string;
      userInputType?: 'choice' | 'text' | 'action';
      promptData?: any;
      promptMetadata?: any;
      aiResponseMetadata?: any;
      processingTimeMs?: number;
    }
  ): Promise<any> {
    try {
      // Load current game state
      const currentGame = await this.loadGame(gameId);
      if (!currentGame) {
        throw new Error('Game not found for turn application');
      }

      // Check if a turn already exists for this game and turn number
      const nextTurnNumber = currentGame.turn_count + 1;
      const { data: existingTurn } = await supabaseAdmin
        .from('turns')
        .select('*')
        .eq('game_id', gameId)
        .eq('turn_number', nextTurnNumber)
        .single();

      if (existingTurn) {
        console.log(`[GAMES_SERVICE] Turn ${nextTurnNumber} already exists for game ${gameId}, returning existing turn`);
        return existingTurn;
      }

      // Create turn record
      // Generate a UUID for option_id if it's not already a valid UUID
      let optionIdUuid = optionId;
      if (optionId && !this.isValidUuid(optionId)) {
        // For non-UUID optionIds like "game_start", generate a UUID
        optionIdUuid = crypto.randomUUID();
        console.log(`[GAMES_SERVICE] Generated UUID for optionId "${optionId}": ${optionIdUuid}`);
      }
      
      // Determine if this is an initialization turn
      const isInitialization = nextTurnNumber === 1;
      
      // Extract narrative summary from turn result
      const narrativeSummary = turnResult.narrative || 'Narrative not available';
      
      const turnRecord = {
        game_id: gameId,
        option_id: optionIdUuid,
        ai_response: turnResult,
        turn_number: nextTurnNumber,
        created_at: new Date().toISOString(),
        // Enhanced turn recording fields for realtime data
        session_id: gameId, // Same as game_id for compatibility
        sequence: nextTurnNumber,
        user_prompt: turnData?.userInput || null,
        narrative_summary: narrativeSummary,
        is_initialization: isInitialization,
        // Legacy fields for backward compatibility
        user_input: turnData?.userInput || null,
        user_input_type: turnData?.userInputType || 'choice',
        prompt_data: turnData?.promptData || null,
        prompt_metadata: turnData?.promptMetadata || null,
        ai_response_metadata: turnData?.aiResponseMetadata || null,
        processing_time_ms: turnData?.processingTimeMs || null,
        token_count: turnData?.aiResponseMetadata?.tokenCount || null,
        model_used: turnData?.aiResponseMetadata?.model || null,
        prompt_id: turnData?.aiResponseMetadata?.promptId || null,
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

      // Only update game state if we created a new turn
      const newState = {
        ...currentGame.state_snapshot,
        ...turnResult.worldStateChanges,
      };

      const newTurnIndex = currentGame.turn_count + 1;
      const serverSummary = this.generateServerSummary(turnResult);

      const { error: updateError } = await supabaseAdmin
        .from('games')
        .update({
          state_snapshot: newState,
          turn_count: newTurnIndex,
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
   * Get all turns for a game
   * @param gameId - Game ID
   * @returns Array of turn records
   */
  async getGameTurns(gameId: string): Promise<any[]> {
    try {
      const { data: turns, error } = await supabaseAdmin
        .from('turns')
        .select('*')
        .eq('game_id', gameId)
        .order('turn_number', { ascending: true });

      if (error) {
        console.error('Error loading game turns:', error);
        throw new Error(`Failed to load game turns: ${error.message}`);
      }

      return turns || [];
    } catch (error) {
      console.error('Unexpected error in getGameTurns:', error);
      throw error;
    }
  }

  /**
   * Fetch turns for a game session including initialize narrative
   * @param gameId - Game ID
   * @returns Array of turns with narrative data
   */
  async getSessionTurns(gameId: string): Promise<any[]> {
    try {
      const { data: turns, error } = await supabaseAdmin
        .from('turns')
        .select(`
          id,
          session_id,
          sequence,
          user_prompt,
          narrative_summary,
          is_initialization,
          created_at,
          turn_number
        `)
        .eq('session_id', gameId)
        .order('sequence', { ascending: true });

      if (error) {
        console.error('Error fetching session turns:', error);
        throw new Error(`Failed to fetch session turns: ${error.message}`);
      }

      return turns || [];
    } catch (error) {
      console.error('Unexpected error in getSessionTurns:', error);
      throw error;
    }
  }

  /**
   * Get initialize narrative for a game session
   * @param gameId - Game ID
   * @returns Initialize narrative or null
   */
  async getInitializeNarrative(gameId: string): Promise<string | null> {
    try {
      const { data: turn, error } = await supabaseAdmin
        .from('turns')
        .select('narrative_summary')
        .eq('session_id', gameId)
        .eq('is_initialization', true)
        .single();

      if (error) {
        console.error('Error fetching initialize narrative:', error);
        return null;
      }

      return turn?.narrative_summary || null;
    } catch (error) {
      console.error('Unexpected error in getInitializeNarrative:', error);
      return null;
    }
  }

  /**
   * Ensure guest user has a cookie group
   * @param cookieId - Cookie ID for the guest user
   */
  private async ensureGuestCookieGroup(cookieId: string): Promise<void> {
    try {
      // Check if the cookie group itself exists in cookie_groups table
      const { data: existingGroup, error: groupError } = await supabaseAdmin
        .from('cookie_groups')
        .select('id')
        .eq('id', cookieId)
        .single();

      if (existingGroup && !groupError) {
        console.log(`Cookie group ${cookieId} already exists`);
        return; // Cookie group exists
      }

      // Cookie group doesn't exist - create it manually
      console.log(`Creating cookie group for guest user ${cookieId}`);
      
      // First, create the cookie group
      const { data: newGroup, error: groupCreateError } = await supabaseAdmin
        .from('cookie_groups')
        .insert({
          id: cookieId,
          user_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (groupCreateError) {
        // If it's a duplicate key error, that's okay - the group already exists
        if (groupCreateError.code === '23505' && groupCreateError.message.includes('duplicate key')) {
          console.log(`Cookie group already exists for guest user ${cookieId} (duplicate key)`);
          return;
        }
        
        console.error('Error creating cookie group:', groupCreateError);
        throw new Error(`Failed to create cookie group: ${groupCreateError.message}`);
      }

      // Then, create the cookie group member
      const { error: memberCreateError } = await supabaseAdmin
        .from('cookie_group_members')
        .insert({
          cookie_id: cookieId,
          group_id: cookieId,
          device_label: 'Guest Device',
          created_at: new Date().toISOString(),
        });

      if (memberCreateError) {
        // If it's a duplicate key error, that's okay - the member already exists
        if (memberCreateError.code === '23505' && memberCreateError.message.includes('duplicate key')) {
          console.log(`Cookie group member already exists for guest user ${cookieId}`);
          return;
        }
        
        console.error('Error creating cookie group member:', memberCreateError);
        throw new Error(`Failed to create cookie group member: ${memberCreateError.message}`);
      }

      console.log(`Created cookie group and member for guest user ${cookieId}`);
    } catch (error) {
      console.error('Error ensuring guest cookie group:', error);
      throw error;
    }
  }

  /**
   * Handle starter stones grant for first-time spawners
   * @param ownerId - Owner ID (user ID or cookie group ID)
   * @param isGuest - Whether the owner is a guest
   */
  private async handleStarterStonesGrant(ownerId: string, isGuest: boolean): Promise<void> {
    try {
      // Check if starter stones are enabled in config
      const pricingConfig = configService.getPricing();
      
      if (pricingConfig.guestStarterCastingStones <= 0) {
        return; // Starter stones disabled
      }

      // Check if this is the first spawn for this owner
      const existingGames = await this.getGames(ownerId, isGuest, 1, 0);
      if (existingGames.length > 0) {
        return; // Not the first spawn
      }

      // Check current wallet balance
      const wallet = await WalletService.getWallet(ownerId, isGuest);
      if (wallet.castingStones >= pricingConfig.guestStarterCastingStones) {
        return; // Already has sufficient stones
      }

      // Grant starter stones
      const grantAmount = pricingConfig.guestStarterCastingStones - wallet.castingStones;
      await WalletService.addCastingStones(ownerId, isGuest, grantAmount, 'STARTER', {
        reason: 'First spawn starter grant',
        grantAmount,
        isFirstSpawn: true
      });

      console.log(`Granted ${grantAmount} starter stones to ${isGuest ? 'guest' : 'user'} ${ownerId}`);
    } catch (error) {
      console.error('Error handling starter stones grant:', error);
      // Don't fail the spawn if starter grant fails
    }
  }

  /**
   * Map database game row to GameDTO
   * @param dbRow - Database row with joined data
   * @returns GameDTO
   */
  private async mapGameToDTO(dbRow: any): Promise<GameDTO> {
    // Get world name from content service
    const world = await ContentService.getWorldBySlug(dbRow.world_slug);
    const worldName = world?.name || dbRow.world_slug;

    return {
      id: dbRow.id,
      adventureId: dbRow.adventure_id,
      adventureTitle: dbRow.adventures?.title || 'Unknown Adventure',
      adventureDescription: dbRow.adventures?.description,
      characterId: dbRow.character_id,
      characterName: dbRow.characters?.name,
      worldSlug: dbRow.world_slug,
      worldName,
      turnCount: dbRow.turn_count,
      status: dbRow.status,
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at,
      lastPlayedAt: dbRow.last_played_at,
    };
  }

  /**
   * Map database game row to GameListDTO
   * @param dbRow - Database row with joined data
   * @returns GameListDTO
   */
  private mapGameToListDTO(dbRow: any): GameListDTO {
    return {
      id: dbRow.id,
      adventureTitle: dbRow.adventures?.title || 'Unknown Adventure',
      characterName: dbRow.characters?.name,
      worldName: dbRow.adventures?.world_slug || 'Unknown World', // Will be enhanced with proper world names
      turnCount: dbRow.turn_count,
      status: dbRow.status,
      lastPlayedAt: dbRow.last_played_at,
    };
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
