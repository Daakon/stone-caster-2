import { WalletService } from './wallet.service.js';
import { promptsService } from './prompts.service.js';
import { gamesService } from './games.service.js';
import { StoneLedgerService } from './stoneLedger.service.js';
import { IdempotencyService } from './idempotency.service.js';
import { gameStateService } from './game-state.service.js';
import { debugService } from './debug.service.js';
import { aiService } from './ai.js';
import { supabaseAdmin } from './supabase.js';
import { TurnResponseSchema, type TurnResponse, type TurnDTO } from '@shared';
import { ApiErrorCode } from '@shared';
import { configService } from '../config/index.js';
import { ServiceError } from '../utils/serviceError.js';
import { v4 as uuidv4 } from 'uuid';

export interface TurnRequest {
  gameId: string;
  optionId: string;
  owner: string;
  idempotencyKey: string;
  isGuest: boolean;
  userInput?: string;
  userInputType?: 'choice' | 'text' | 'action';
}

export interface TurnResult {
  success: boolean;
  turnDTO?: TurnDTO;
  error?: ApiErrorCode;
  message?: string;
  details?: {
    prompt?: any;
    aiResponse?: string | null;
    transformedResponse?: any;
    validationErrors?: any;
    error?: string;
    timestamp?: string;
    cached?: boolean;
  };
}

export class TurnsService {
  /**
   * Execute a buffered turn with AI generation and validation
   * @param request - Turn request parameters
   * @returns Turn result with success status and data
   */
  async runBufferedTurn(request: TurnRequest): Promise<TurnResult> {
    const { gameId, optionId, owner, idempotencyKey, isGuest, userInput, userInputType } = request;
    
    // Declare variables at method level for error handling
    let gameContext: any = null;
    let aiResponseText: string | null = null;
    const turnStartTime = Date.now();
    let promptData: any = null;
    let promptMetadata: any = null;
    let aiResponseMetadata: any = null;

    try {
      // Check idempotency first
      const idempotencyCheck = await IdempotencyService.checkIdempotency(
        idempotencyKey,
        owner,
        gameId,
        'turn'
      );

      if (idempotencyCheck.error) {
        return {
          success: false,
          error: idempotencyCheck.error,
          message: idempotencyCheck.message,
        };
      }

      if (idempotencyCheck.isDuplicate && idempotencyCheck.existingRecord) {
        // Return cached response for duplicate request
        return {
          success: true,
          turnDTO: idempotencyCheck.existingRecord.responseData,
          details: {
            prompt: null, // Not available for cached responses
            aiResponse: null, // Not available for cached responses
            transformedResponse: null, // Not available for cached responses
            timestamp: idempotencyCheck.existingRecord.createdAt,
            cached: true
          }
        };
      }

      // Load game and validate it exists
      const game = await gamesService.loadGame(gameId);
      if (!game) {
        return {
          success: false,
          error: ApiErrorCode.NOT_FOUND,
          message: 'Game not found',
        };
      }

      // Get turn cost from config
      const pricingConfig = configService.getPricing();
      const turnCost = this.getTurnCost(pricingConfig, game.world_slug || '');

      // Check if user has sufficient stones
      const wallet = await WalletService.getWallet(owner, isGuest);
      if (wallet.castingStones < turnCost) {
        return {
          success: false,
          error: ApiErrorCode.INSUFFICIENT_STONES,
          message: `Insufficient casting stones. Have ${wallet.castingStones}, need ${turnCost}`,
        };
      }

      // Ensure initial game state exists
      await this.ensureInitialGameState(game);

      // Check if this is the first turn (turn_count = 0) and create initial prompt
      if (game.turn_count === 0) {
        console.log(`[TURNS] Game ${gameId} has no turns, creating initial AI prompt with adventure start JSON`);
        
        try {
          console.log(`[TURNS] Creating initial AI prompt for game ${game.id}`);
          const initialPromptResult = await this.createInitialAIPrompt(game);
          
          if (!initialPromptResult) {
            console.error(`[TURNS] Initial prompt creation failed for game ${game.id}`);
            return {
              success: false,
              error: ApiErrorCode.INTERNAL_ERROR,
              message: 'Failed to create initial AI prompt',
              details: {
                prompt: gameContext,
                aiResponse: null,
                transformedResponse: null,
                error: 'Initial prompt creation failed',
                timestamp: new Date().toISOString()
              }
            };
          }
          
          console.log(`[TURNS] Initial prompt created successfully for game ${game.id}`);
          
          // Convert the turn record to TurnDTO format
          const turnDTO = {
            id: initialPromptResult.turnRecord.id,
            gameId: game.id,
            turnCount: 1,
            narrative: initialPromptResult.transformedResponse.narrative,
            emotion: initialPromptResult.transformedResponse.emotion || 'neutral',
            choices: initialPromptResult.transformedResponse.choices || [],
            actions: initialPromptResult.transformedResponse.actions || [],
            createdAt: initialPromptResult.turnRecord.created_at,
            castingStonesBalance: 62, // Default balance for initial turn
            debugPrompt: initialPromptResult.initialPrompt,
            debugAiResponse: {
              hasChoices: (initialPromptResult.transformedResponse.choices || []).length > 0,
              choiceCount: (initialPromptResult.transformedResponse.choices || []).length,
              hasNpcResponses: false,
              npcResponseCount: 0,
              hasRelationshipDeltas: false,
              hasFactionDeltas: false
            }
          };
          
          return {
            success: true,
            turnDTO,
            details: {
              prompt: gameContext,
              aiResponse: initialPromptResult.aiResponse,
              transformedResponse: initialPromptResult.transformedResponse,
              timestamp: new Date().toISOString()
            }
          };
        } catch (error) {
          console.error(`[TURNS] Error creating initial AI prompt:`, error);
          return {
            success: false,
            error: ApiErrorCode.INTERNAL_ERROR,
            message: 'Failed to create initial AI prompt',
            details: {
              prompt: gameContext,
              aiResponse: null,
              transformedResponse: null,
              error: error instanceof Error ? error.message : String(error),
              errorName: error instanceof Error ? error.name : 'UnknownError',
              errorStack: error instanceof Error ? error.stack : undefined,
              timestamp: new Date().toISOString()
            }
          };
        }
      }

      // Generate AI response using new wrapper system
      let aiResult: any = null;
      const aiStartTime = Date.now();
      
      // Build game context for new AI service
      gameContext = {
        id: game.id,
        world_id: game.world_slug,
        character_id: game.character_id,
        state_snapshot: game.state_snapshot,
        turn_index: game.turn_count,
        current_scene: game.state_snapshot?.currentScene || 'unknown',
        character: game.state_snapshot?.character || {},
        adventure: game.state_snapshot?.adventure || {},
      };
      
      try {

        // Get available choices for input resolution
        const choices = game.state_snapshot?.choices || [];

        // Check if debug mode is enabled (via environment variable or request header)
        const includeDebug = process.env.NODE_ENV === 'development' || 
                           process.env.ENABLE_AI_DEBUG === 'true';
        
        // Check AWF mode configuration
        const { isAwfEnabled } = await import('../config/awf-mode.js');
        const awfEnabled = isAwfEnabled({ sessionId: gameId });
        
        if (awfEnabled) {
          console.log(`[TURNS] AWF bundle path enabled for game ${gameId}`);
          
          try {
            // Use AWF turn orchestrator
            const { runAwfTurn } = await import('../orchestrators/awf-turn-orchestrator.js');
            const awfResult = await runAwfTurn({
              sessionId: gameId,
              inputText: userInput || ''
            });
            
            // Convert AWF result to legacy format
            aiResponseText = awfResult.txt;
            
            // Create legacy-compatible response structure
            const legacyResponse = {
              response: awfResult.txt,
              choices: awfResult.choices.map(choice => ({
                id: choice.id,
                text: choice.label
              })),
              scene: awfResult.meta.scn
            };
            
            // Set AI result to legacy format for compatibility
            aiResult = {
              response: legacyResponse.response,
              choices: legacyResponse.choices,
              scene: legacyResponse.scene,
              model: 'awf-orchestrator',
              tokenCount: null,
              promptId: null,
              promptData: null,
              promptMetadata: null
            };
            
            console.log(`[TURNS] AWF turn completed for game ${gameId}`);
            
          } catch (awfError) {
            console.error(`[TURNS] AWF turn failed for game ${gameId}, falling back to legacy:`, awfError);
            // Fall through to legacy path
          }
        }
        
        if (!awfEnabled) {
          console.log(`[TURNS] Legacy markdown path in use for game ${gameId}`);

          try {
            aiResult = await Promise.race([
          aiService.generateTurnResponse(gameContext, optionId, choices, includeDebug),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('AI timeout')), 30000) // 30 second timeout
          )
        ]);
        
        aiResponseText = aiResult.response;
        
        // Capture prompt data and metadata for comprehensive turn recording
        promptData = aiResult.promptData || null;
        promptMetadata = aiResult.promptMetadata || null;
        aiResponseMetadata = {
          model: aiResult.model || 'unknown',
          responseTime: Date.now() - aiStartTime,
          tokenCount: aiResult.tokenCount || null,
          promptId: aiResult.promptId || null,
          validationPassed: true,
          timestamp: new Date().toISOString()
        };
        
        // Log AI response to debug service
        debugService.logAiResponse(
          gameId,
          game.turn_count,
          'prompt-id', // TODO: Get actual prompt ID from prompt assembly
          aiResponseText,
          Date.now() - aiStartTime
        );
          } catch (legacyError) {
            console.error('AI service error:', legacyError);
            if (legacyError instanceof Error && legacyError.message === 'AI timeout') {
              return {
                success: false,
                error: ApiErrorCode.UPSTREAM_TIMEOUT,
                message: 'AI service timeout',
                details: {
                  prompt: gameContext,
                  aiResponse: null,
                  error: legacyError.message,
                  timestamp: new Date().toISOString()
                }
              };
            }
            return {
              success: false,
              error: ApiErrorCode.INTERNAL_ERROR,
              message: 'AI service error',
              details: {
                prompt: gameContext,
                aiResponse: null,
                error: legacyError instanceof Error ? legacyError.message : String(legacyError),
                timestamp: new Date().toISOString()
              }
            };
          }
        }

      } catch (error) {
        console.error('Error in turn processing:', error);
        return {
          success: false,
          error: ApiErrorCode.INTERNAL_ERROR,
          message: 'Turn processing error',
          details: {
            prompt: gameContext,
            aiResponse: null,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
          }
        };
      }

      // Parse and validate AI response
      let aiResponse: TurnResponse;
      try {
        if (!aiResponseText) {
          throw new Error('AI response text is null or undefined');
        }
        
        console.log(`[TURNS_SERVICE] Parsing AI response (${aiResponseText.length} characters)`);
        console.log(`[TURNS_SERVICE] AI response preview: ${aiResponseText.substring(0, 200)}...`);
        
        const parsedResponse = JSON.parse(aiResponseText);
        console.log('[TURNS_SERVICE] Successfully parsed JSON, transforming AWF format...');
        
        // Transform AWF format to TurnResponseSchema format
        const transformedResponse = await this.transformAWFToTurnResponse(parsedResponse);
        console.log('[TURNS_SERVICE] Transformed response, validating schema...');
        
        // Additional validation checks before schema validation
        if (!transformedResponse.narrative || typeof transformedResponse.narrative !== 'string' || transformedResponse.narrative.trim().length === 0) {
          console.error('[TURNS_SERVICE] AI response has empty or invalid narrative');
          return {
            success: false,
            error: ApiErrorCode.VALIDATION_FAILED,
            message: 'AI response has empty or invalid narrative',
            details: {
              prompt: gameContext,
              aiResponse: aiResponseText,
              transformedResponse: transformedResponse,
              validationErrors: [{ message: 'Narrative is empty or invalid' }],
              timestamp: new Date().toISOString()
            }
          };
        }
        
        if (transformedResponse.narrative.trim().length < 10) {
          console.error('[TURNS_SERVICE] AI response narrative is too short');
          return {
            success: false,
            error: ApiErrorCode.VALIDATION_FAILED,
            message: 'AI response narrative is too short',
            details: {
              prompt: gameContext,
              aiResponse: aiResponseText,
              transformedResponse: transformedResponse,
              validationErrors: [{ message: 'Narrative is too short' }],
              timestamp: new Date().toISOString()
            }
          };
        }
        
        // Add debug information if available
        if (aiResult && aiResult.debug) {
          transformedResponse.debug = aiResult.debug;
        }
        
        const validationResult = TurnResponseSchema.safeParse(transformedResponse);
        
        if (!validationResult.success) {
          console.error('[TURNS_SERVICE] AI response validation failed:', validationResult.error);
          console.error('[TURNS_SERVICE] Raw AI response:', aiResponseText);
          console.error('[TURNS_SERVICE] Transformed response:', JSON.stringify(transformedResponse, null, 0));
          return {
            success: false,
            error: ApiErrorCode.VALIDATION_FAILED,
            message: 'AI response validation failed',
            details: {
              prompt: gameContext,
              aiResponse: aiResponseText,
              transformedResponse: transformedResponse,
              validationErrors: validationResult.error.errors,
              timestamp: new Date().toISOString()
            }
          };
        }
        
        console.log('[TURNS_SERVICE] Successfully validated AI response schema');
        
        aiResponse = validationResult.data;
      } catch (error) {
        console.error('Invalid AI response JSON:', error);
        return {
          success: false,
          error: ApiErrorCode.VALIDATION_FAILED,
          message: 'Invalid AI response format',
          details: {
            prompt: gameContext,
            aiResponse: aiResponseText,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
          }
        };
      }

      // Apply turn to game state with comprehensive turn data
      const turnRecord = await gamesService.applyTurn(gameId, aiResponse, optionId, {
        userInput: userInput || optionId,
        userInputType: userInputType || 'choice',
        promptData: promptData,
        promptMetadata: promptMetadata,
        aiResponseMetadata: aiResponseMetadata,
        processingTimeMs: Date.now() - turnStartTime
      });
        
      
      // Log state changes to debug service
      const hasStateChanges = aiResponse.worldStateChanges || aiResponse.relationshipDeltas || aiResponse.factionDeltas;
      if (hasStateChanges) {
        const currentState = await gameStateService.loadGameState(gameId);
        const beforeState = game.state_snapshot;
        const afterState = currentState || {};
          
        
        // Extract changes from the response
        const changes = [];
        if (aiResponse.worldStateChanges) {
          changes.push({ type: 'world_state', changes: aiResponse.worldStateChanges });
        }
        if (aiResponse.relationshipDeltas) {
          changes.push({ type: 'relationships', changes: aiResponse.relationshipDeltas });
        }
        if (aiResponse.factionDeltas) {
          changes.push({ type: 'factions', changes: aiResponse.factionDeltas });
        }
          
        
        debugService.logStateChanges(
          gameId,
          game.turn_count,
          'response-id', // TODO: Get actual response ID
          [], // No actions in current schema
          changes,
          beforeState,
          afterState
        );
      }


      // Spend casting stones (only after successful turn)
      const spendResult = await WalletService.spendCastingStones(
        owner,
        turnCost,
        idempotencyKey,
        gameId,
        `TURN_SPEND`,
        isGuest
      );


      if (!spendResult.success) {
        // This should not happen since we checked balance earlier
        console.error('Unexpected spend failure after successful turn:', spendResult);
        // Continue anyway since turn was successful
      }


      // Create Turn DTO
      const turnDTO = await this.createTurnDTO(turnRecord, aiResponse, game, wallet.castingStones - turnCost, aiResult.debug?.promptText);


      // Store idempotency record
      const requestHash = IdempotencyService.createRequestHash({ optionId });
      await IdempotencyService.storeIdempotencyRecord(
        idempotencyKey,
        owner,
        gameId,
        'turn',
        requestHash,
        turnDTO,
        'completed'
      );


      return {
        success: true,
        turnDTO,
        details: {
          prompt: gameContext,
          aiResponse: aiResponseText,
          transformedResponse: aiResponse,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Unexpected error in runBufferedTurn:', error);
      return {
        success: false,
        error: ApiErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
        details: {
          prompt: gameContext || null,
          aiResponse: aiResponseText || null,
          transformedResponse: null,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Ensure initial game state exists for the game
   * @param game - Game data
   */
  private async ensureInitialGameState(game: any): Promise<void> {
    try {
      // Check if game state already has content
      if (game.state_snapshot && Object.keys(game.state_snapshot).length > 0) {
        console.log(`[TURNS] Game ${game.id} already has state snapshot, skipping initialization`);
        return;
      }

      console.log(`[TURNS] Initializing game state for game ${game.id}`);
      
      // Load character data if available
      let characterData = {};
      if (game.character_id) {
        try {
          const characterResult = await supabaseAdmin
            .from('characters')
            .select('*')
            .eq('id', game.character_id)
            .single();
          
          if (characterResult.data) {
            characterData = {
              id: characterResult.data.id,
              name: characterResult.data.name,
              traits: characterResult.data.traits || {},
              skills: characterResult.data.skills || {},
              inventory: characterResult.data.inventory || []
            };
            console.log(`[TURNS] Loaded character data for ${characterResult.data.name}`);
          }
        } catch (error) {
          console.error('Error loading character data:', error);
        }
      }

      // Load adventure data if available
      let adventureData = {};
      if (game.adventure_id) {
        try {
          const adventureResult = await supabaseAdmin
            .from('adventures')
            .select('*')
            .eq('id', game.adventure_id)
            .single();
          
          if (adventureResult.data) {
            adventureData = {
              id: adventureResult.data.id,
              name: adventureResult.data.name,
              description: adventureResult.data.description,
              scenes: adventureResult.data.scenes || [],
              objectives: adventureResult.data.objectives || [],
              npcs: adventureResult.data.npcs || [],
              places: adventureResult.data.places || []
            };
            console.log(`[TURNS] Loaded adventure data for ${adventureResult.data.name}`);
          }
        } catch (error) {
          console.error('Error loading adventure data:', error);
        }
      }

      // Create initial state snapshot
      const initialState = {
        currentScene: 'forest_meet', // Use default starting scene
        character: characterData,
        adventure: adventureData,
        flags: {
          'game.initialized': true,
          'game.world': game.world_slug,
          'game.adventure': game.adventure_id || null
        },
        ledgers: {
          'game.turns': 0,
          'game.scenes_visited': ['forest_meet'],
          'game.actions_taken': []
        },
        presence: 'present',
        lastActs: [],
        styleHint: 'neutral'
      };

      // Update the game with the initial state
      const { error: updateError } = await supabaseAdmin
        .from('games')
        .update({ 
          state_snapshot: initialState,
          updated_at: new Date().toISOString()
        })
        .eq('id', game.id);

      if (updateError) {
        console.error('Error updating game state snapshot:', updateError);
        throw new Error(`Failed to update game state: ${updateError.message}`);
      }

      console.log(`[TURNS] Created initial game state for game ${game.id}`);
    } catch (error) {
      console.error('Error ensuring initial game state:', error);
      // Don't fail the turn for this error, just log it
    }
  }

  /**
   * Create initial AI prompt for games with no turns, including adventure start JSON
   * @param game - Game data
   * @returns Turn data and AI response
   */
  private async createInitialAIPrompt(game: any): Promise<{
    turnRecord: any;
    aiResponse: string;
    transformedResponse: any;
    initialPrompt: string;
  } | null> {
    let updatedGame: any = null;
    let adventureName: string | null = null;
    let awfBundleEnabled = false;
    let promptAttemptContext: Record<string, unknown> | null = null;

    try {
      console.log(`[TURNS] Creating initial AI prompt for game ${game.id} with adventure start JSON`);
      
      // Check if initialize narrative already exists
      const existingNarrative = await gamesService.getInitializeNarrative(game.id);
      if (existingNarrative) {
        console.log(`[TURNS] Initialize narrative already exists for game ${game.id}, skipping AI generation`);
        
        // Return existing turn data
        const existingTurns = await gamesService.getSessionTurns(game.id);
        const initTurn = existingTurns.find(turn => turn.is_initialization);
        
        if (initTurn) {
          return {
            turnRecord: initTurn,
            aiResponse: JSON.stringify({ narrative: existingNarrative }),
            transformedResponse: { narrative: existingNarrative },
            initialPrompt: 'cached'
          };
        }
      }
      
      // Ensure initial game state exists before creating prompt
      await this.ensureInitialGameState(game);
      
      // Reload game to get updated state_snapshot
      const updatedGame = await gamesService.loadGame(game.id);
      if (!updatedGame) {
        throw new Error('Game not found after state initialization');
      }
      
      console.log(`[TURNS] Game state after initialization:`, {
        hasStateSnapshot: !!updatedGame.state_snapshot,
        stateSnapshotKeys: Object.keys(updatedGame.state_snapshot || {}),
        hasAdventure: !!(updatedGame.state_snapshot?.adventure),
        hasCharacter: !!(updatedGame.state_snapshot?.character)
      });
      
      // Build game context for initial prompt
      const gameContext = {
        id: updatedGame.id,
        world_id: updatedGame.world_slug,
        character_id: updatedGame.character_id,
        state_snapshot: updatedGame.state_snapshot,
        turn_index: 0,
        current_scene: updatedGame.state_snapshot?.currentScene || 'forest_meet',
        character: updatedGame.state_snapshot?.character || {},
        adventure: updatedGame.state_snapshot?.adventure || {},
      };
      adventureName = gameContext.adventure?.slug || gameContext.adventure?.name || gameContext.current_scene || null;

      // Check AWF bundle feature flag for initial prompt
      const { isAwfBundleEnabled } = await import('../utils/feature-flags.js');
      awfBundleEnabled = isAwfBundleEnabled({ sessionId: game.id });
      
      if (awfBundleEnabled) {
        console.log(`[TURNS] AWF bundle path would be used for initial prompt in game ${game.id} (Phase 0 stub)`);
        // TODO Phase 3+: call assembleBundle()
        // For now, fall through to legacy path
      } else {
        console.log(`[TURNS] Legacy markdown path in use for initial prompt in game ${game.id}`);
      }

      // Generate AI response for the initial prompt using the same system as regular turns
      // The AI service will handle prompt building internally and return the prompt data
      promptAttemptContext = {
        gameId: updatedGame.id,
        worldSlug: updatedGame.world_slug,
        characterId: updatedGame.character_id,
        optionId: 'game_start',
        turnCount: updatedGame.turn_count,
        hasStateSnapshot: Boolean(updatedGame.state_snapshot),
        stateSnapshotKeys: Object.keys(updatedGame.state_snapshot || {}),
        hasAdventure: Boolean(updatedGame.state_snapshot?.adventure),
        hasCharacter: Boolean(updatedGame.state_snapshot?.character),
        currentScene: updatedGame.state_snapshot?.current_scene || updatedGame.state_snapshot?.currentScene,
        awfBundleEnabled,
      };
      const aiResult = await aiService.generateTurnResponse(
        gameContext, 
        'game_start', 
        [], // No choices for initial prompt
        process.env.NODE_ENV === 'development' || process.env.ENABLE_AI_DEBUG === 'true'
      );

      // Use the prompt data returned by the AI service
      const promptData = (aiResult as any).promptData;
      const promptMetadata = (aiResult as any).promptMetadata;

      // Parse and validate the AI response
      const aiResponse = JSON.parse(aiResult.response);
      const transformedResponse = await this.transformAWFToTurnResponse(aiResponse);

      // Apply the initial turn to the game with comprehensive turn data
      const turnRecord = await gamesService.applyTurn(updatedGame.id, transformedResponse, 'game_start', {
        userInput: 'game_start',
        userInputType: 'action',
        promptData: promptData,
        promptMetadata: promptMetadata,
        aiResponseMetadata: {
          model: (aiResult as any).model || 'unknown',
          responseTime: 0, // Initial prompt has no timing
          tokenCount: (aiResult as any).tokenCount || null,
          promptId: (aiResult as any).promptId || 'initial-prompt',
          validationPassed: true,
          timestamp: new Date().toISOString()
        },
        processingTimeMs: 0
      });
      
      console.log(`[TURNS] Initial AI prompt created and applied for game ${updatedGame.id}`);
      
      // Log the initial prompt creation
      debugService.logAiResponse(
        updatedGame.id,
        0,
        'initial-prompt',
        aiResult.response,
        0 // No timing for initial prompt
      );
      
      // Return the turn data for the frontend
      return {
        turnRecord,
        aiResponse: aiResult.response,
        transformedResponse,
        initialPrompt: promptData // Use the prompt data from AI service
      };
      
    } catch (error) {
      console.error('Error creating initial AI prompt:', error);
      console.error('[TURNS] Initial prompt failure diagnostics:', {
        gameId: game?.id,
        worldSlug: game?.world_slug,
        awfBundleEnabled,
        adventureName,
        updatedGameState: updatedGame ? {
          id: updatedGame.id,
          worldSlug: updatedGame.world_slug,
          hasStateSnapshot: Boolean(updatedGame.state_snapshot),
          stateSnapshotKeys: Object.keys(updatedGame.state_snapshot || {}),
          hasAdventure: Boolean(updatedGame.state_snapshot?.adventure),
          hasCharacter: Boolean(updatedGame.state_snapshot?.character),
          currentScene: updatedGame.state_snapshot?.current_scene || updatedGame.state_snapshot?.currentScene,
        } : null,
        promptAttemptContext,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      // Return null to indicate failure
      return null;
    }
  }

  /**
   * Build prompt for AI request (server-only)
   * @param game - Game data
   * @param optionId - Selected option ID
   * @returns Prompt string
   */
  private async buildPrompt(game: any, optionId: string): Promise<string> {
    // Use the new prompt assembly system
    const gameContext = {
      id: game.id,
      world_id: game.world_slug,
      character_id: game.character_id,
      state_snapshot: game.state_snapshot,
      turn_index: game.turn_count,
    };

    return await promptsService.buildPrompt(gameContext, optionId);
  }

  /**
   * Create Turn DTO from turn record and AI response
   * @param turnRecord - Turn record from database
   * @param aiResponse - AI response
   * @param game - Game data
   * @param newBalance - New casting stones balance
   * @param debugPrompt - Full prompt that was sent to AI (for debugging)
   * @returns Turn DTO
   */
  private async createTurnDTO(
    turnRecord: any,
    aiResponse: TurnResponse,
    game: any,
    newBalance: number,
    debugPrompt?: string
  ): Promise<TurnDTO> {
    // Calculate token count for the prompt
    const promptTokenCount = debugPrompt ? promptsService.calculateTokenCount(debugPrompt) : undefined;

    // Build separate debug fields
    const debugFields = await this.buildSeparateDebugFields(game, aiResponse);

    return {
      id: turnRecord.id,
      gameId: game.id,
      turnCount: game.turn_count + 1,
      narrative: aiResponse.narrative,
      emotion: aiResponse.emotion,
      choices: aiResponse.choices || [],
      npcResponses: aiResponse.npcResponses,
      relationshipDeltas: aiResponse.relationshipDeltas,
      factionDeltas: aiResponse.factionDeltas,
      castingStonesBalance: newBalance,
      createdAt: turnRecord.created_at,
      debugPrompt: debugPrompt, // Keep original prompt for debugging
      promptTokenCount: promptTokenCount,
      ...debugFields, // Spread the separate debug fields
    };
  }

  /**
   * Build separate debug fields for character and state information
   */
  private async buildSeparateDebugFields(game: any, aiResponse: TurnResponse): Promise<any> {
    // Load the actual character data from the database
    let characterData = null;
    if (game.character_id) {
      try {
        const { data, error } = await supabaseAdmin
          .from('characters')
          .select('*')
          .eq('id', game.character_id)
          .single();
        
        if (!error && data) {
          characterData = data;
        }
      } catch (error) {
        console.error('Error loading character for debug:', error);
      }
    }

    // Extract PlayerV3 data if available
    const playerV3 = characterData?.world_data?.playerV3;
    
    // Determine if this is a PlayerV3 character or legacy character
    const isPlayerV3 = !!playerV3;
    
    // Build skills object - handle both PlayerV3 and legacy formats
    let skills = {};
    if (isPlayerV3 && playerV3.skills) {
      skills = playerV3.skills;
    } else if (characterData?.skills) {
      // Convert legacy skills array to object format
      if (Array.isArray(characterData.skills)) {
        skills = characterData.skills.reduce((acc: any, skill: any) => {
          acc[skill] = 50; // Default skill value
          return acc;
        }, {});
      } else if (typeof characterData.skills === 'object') {
        skills = characterData.skills;
      }
    }
    
    // Build inventory array - handle both formats
    let inventory = [];
    if (isPlayerV3 && playerV3.inventory) {
      inventory = playerV3.inventory;
    } else if (characterData?.inventory) {
      if (Array.isArray(characterData.inventory)) {
        inventory = characterData.inventory.map((item: any) => 
          typeof item === 'string' ? item : item.name || item
        );
      }
    }
    
    return {
      debugCharacter: {
        id: game.character_id,
        name: characterData?.name || 'Unknown',
        race: characterData?.race || 'Unknown',
        // PlayerV3 specific fields (with better fallbacks)
        role: playerV3?.role || characterData?.class || 'Adventurer',
        essence: playerV3?.essence || [],
        age: playerV3?.age || 'Unknown',
        build: playerV3?.build || 'Unknown',
        eyes: playerV3?.eyes || 'Unknown',
        traits: playerV3?.traits || [],
        backstory: playerV3?.backstory || characterData?.backstory || 'No backstory available',
        motivation: playerV3?.motivation || 'No motivation set',
        // Skills and abilities
        skills: skills,
        inventory: inventory,
        relationships: playerV3?.relationships || characterData?.relationships || {},
        goals: playerV3?.goals || {},
        flags: playerV3?.flags || characterData?.flags || {},
        reputation: playerV3?.reputation || {},
        // Legacy fields for compatibility
        level: characterData?.level || 1,
        health: {
          current: characterData?.current_health || 100,
          max: characterData?.max_health || 100,
        },
        attributes: characterData?.attributes || {},
        // Debug info to help identify character type
        characterType: isPlayerV3 ? 'PlayerV3' : 'Legacy',
        hasPlayerV3Data: isPlayerV3,
      },
      debugGameState: {
        currentScene: game.state_snapshot?.current_scene || 'unknown',
        currentPhase: game.state_snapshot?.current_phase || 'unknown',
        time: game.state_snapshot?.time || {},
        weather: game.state_snapshot?.weather || {},
        flags: game.state_snapshot?.flags || {},
        party: game.state_snapshot?.party || [],
        lastOutcome: game.state_snapshot?.last_outcome || null,
      },
      debugWorld: {
        id: game.world_id,
        name: game.world_name || 'Unknown World',
      },
      debugTurn: {
        index: game.turn_count,
        optionId: game.state_snapshot?.last_option_id || 'unknown',
      },
      debugAiResponse: {
        hasChoices: (aiResponse.choices?.length || 0) > 0,
        choiceCount: aiResponse.choices?.length || 0,
        hasNpcResponses: (aiResponse.npcResponses?.length || 0) > 0,
        npcResponseCount: aiResponse.npcResponses?.length || 0,
        hasRelationshipDeltas: Object.keys(aiResponse.relationshipDeltas || {}).length > 0,
        hasFactionDeltas: Object.keys(aiResponse.factionDeltas || {}).length > 0,
      }
    };
  }

  /**
   * Get turn cost based on configuration and world
   * @param config - Configuration object
   * @param worldId - World ID for world-specific pricing
   * @returns Cost in casting stones
   */
  private getTurnCost(config: any, worldId: string): number {
    // Check for world-specific pricing
    if (config.pricing?.turn_cost_by_world?.[worldId]) {
      return config.pricing.turn_cost_by_world[worldId];
    }

    // Use default cost
    return config.pricing?.turn_cost_default || 2;
  }

  /**
   * Transform AWF (Adventure World Format) response to TurnResponseSchema format
   * @param awfResponse - Raw AWF response from AI
   * @returns Transformed response matching TurnResponseSchema
   */
  private async transformAWFToTurnResponse(awfResponse: any): Promise<any> {
    const { v4: uuidv4 } = await import('uuid');
    
    // Extract narrative from txt field
    const narrative = awfResponse.txt || '';
    
    // Default emotion to neutral if not provided
    const emotion = 'neutral';
    
    // Transform choices from AWF format to TurnResponseSchema format
    const choices = [];
    if (awfResponse['optional choices'] && Array.isArray(awfResponse['optional choices'])) {
      for (const choice of awfResponse['optional choices']) {
        if (typeof choice === 'object' && choice.choice) {
          choices.push({
            id: uuidv4(),
            label: choice.choice,
            description: choice.outcome || undefined
          });
        }
      }
    }
    
    // If no choices provided, add default choices
    if (choices.length === 0) {
      choices.push(
        { id: uuidv4(), label: 'Continue forward' },
        { id: uuidv4(), label: 'Look around' },
        { id: uuidv4(), label: 'Wait and observe' }
      );
    }
    
    // Extract world state changes from optional val
    const worldStateChanges = awfResponse['optional val'] || {};
    
    // Build the transformed response
    const transformedResponse = {
      narrative,
      emotion,
      choices,
      worldStateChanges: Object.keys(worldStateChanges).length > 0 ? worldStateChanges : undefined,
      // Optional fields
      npcResponses: undefined,
      relationshipDeltas: undefined,
      factionDeltas: undefined
    };
    
    console.log('[TURNS_SERVICE] AWF transformation complete:', {
      narrativeLength: narrative.length,
      choiceCount: choices.length,
      hasWorldStateChanges: !!worldStateChanges
    });
    
    return transformedResponse;
  }
}

export const turnsService = new TurnsService();
