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
import { PerformanceTimer } from '../utils/timing.js';

export type UserIntent =
  | { t: 'choice'; text: string }  // Choice text from frontend
  | { t: 'text'; text: string };  // Free-form text input

export interface TurnRequest {
  gameId: string;
  optionId: string; // Legacy: UUID for choice lookup. New format: can be 'user_input' when userIntent is provided
  owner: string;
  idempotencyKey: string;
  isGuest: boolean;
  userInput?: string; // Legacy field
  userInputType?: 'choice' | 'text' | 'action'; // Legacy field
  userIntent?: UserIntent; // New field: frontend sends choice/text directly
  includeDebugMetadata?: boolean; // Optional flag to include debug metadata
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
  debugMetadata?: {
    assembler: {
      prompt: string;
      pieces: Array<{ scope: string; slug: string; version?: string; tokens?: number }>;
      meta: any;
    };
    ai?: {
      request?: any;
      rawResponse?: any;
      transformed?: any;
    };
    timings?: {
      assembleMs?: number;
      aiMs?: number;
      totalMs?: number;
    };
  };
}

export class TurnsService {
  /**
   * Execute a buffered turn with AI generation and validation
   * @param request - Turn request parameters
   * @returns Turn result with success status and data
   */
  async runBufferedTurn(request: TurnRequest): Promise<TurnResult> {
    const timer = new PerformanceTimer();
    timer.start('totalMs');
    
    const { gameId, optionId, owner, idempotencyKey, isGuest, userInput, userInputType } = request;
    
      // Declare variables at method level for error handling
    let gameContext: any = null;
    let aiResponseText: string | null = null;
    const turnStartTime = Date.now();
    let promptData: any = null;
    let promptMetadata: any = null;
    let aiResponseMetadata: any = null;
    let assembleStartTime: number | null = null;
    let assembleEndTime: number | null = null;
    let aiStartTime: number | null = null;
    let aiEndTime: number | null = null;
    let assemblerResult: any = null;
    let aiRequestData: any = null;
    let aiRawResponse: any = null;

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

      // Check if this is the first turn (turn_count = 0 and no turns exist) and create initial prompt
      // Always create initial prompt for turn_count = 0, regardless of entry point type
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
              timestamp: new Date().toISOString()
            }
          };
        }
      }

      // Generate AI response using new wrapper system
      let aiResult: any = null;
      aiStartTime = Date.now();
      
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
          console.log(`[TURNS] Using V2 prompt assembler for ongoing turn ${game.turn_count + 1}`);

          try {
            // Legacy isolation: Guard against legacy assembler usage when AWF is enabled
            // This should never happen due to feature flag, but fail loudly if it does
            const currentAwfCheck = isAwfEnabled({ sessionId: gameId });
            if (currentAwfCheck) {
              const errorMsg = `ILLEGAL_LEGACY_ASSEMBLER_PATH: AWF enabled but legacy buildPromptV2 called for session ${gameId}`;
              console.error(`[TURNS] ${errorMsg}`);
              // Log metric for monitoring
              console.error(`[METRICS] legacy_assembler_called_when_awf_enabled: { sessionId: ${gameId}, gameId: ${gameId}, turn: ${game.turn_count} }`);
              throw new Error(errorMsg);
            }
            
            // Phase 4.2: Use V2 assembler for ongoing turns
            timer.start('assemblerMs');
            const assembleResult = await this.buildPromptV2(game, optionId);
            timer.end('assemblerMs');
            assembleStartTime = timer.getDuration('assemblerMs') ? Date.now() - (timer.getDuration('assemblerMs') || 0) : Date.now();
            assembleEndTime = Date.now();
            
            // Capture assembler result for debug if requested
            if (request.includeDebugMetadata) {
              assemblerResult = {
                prompt: assembleResult.prompt,
                pieces: assembleResult.pieces,
                meta: assembleResult.meta,
              };
            }
            
            // Use AI service with the assembled prompt
            timer.start('aiMs');
            aiStartTime = Date.now();
            const { OpenAIService } = await import('./openai.service.js');
            const openaiService = new OpenAIService();
            const aiResponseObj = await openaiService.generateBufferedResponse(assembleResult.prompt);
            timer.end('aiMs');
            aiEndTime = Date.now();
            
            // Capture AI request/response for debug if requested
            if (request.includeDebugMetadata) {
              aiRequestData = {
                model: assembleResult.meta.model,
                messages: [{ role: 'system', content: assembleResult.prompt }], // Simplified
              };
              aiRawResponse = aiResponseObj;
            }
            
            // Parse AI response
            const parsed = JSON.parse(aiResponseObj.content);
            aiResponseText = JSON.stringify(parsed);
            
            // Capture v3 prompt metadata
            promptData = assembleResult.prompt;
            promptMetadata = {
              phase: 'turn',
              pieces: assembleResult.pieces,
              meta: assembleResult.meta,
              version: 'v3',
              source: 'entry-point',
              assembledAt: new Date().toISOString(),
            };
            
            aiResponseMetadata = {
              model: assembleResult.meta.model,
              responseTime: aiEndTime - (aiStartTime || Date.now()),
              tokenCount: aiResponseObj.usage?.total_tokens || null,
              promptId: `prompt-v2-${Date.now()}`,
              validationPassed: true,
              timestamp: new Date().toISOString(),
            };
            
            // Increment v3 usage metric
            const { MetricsService } = await import('./metrics.service.js');
            MetricsService.increment('prompt_v3_used_total', {
              phase: 'turn',
              policy: (assembleResult.meta.policy || []).join(','),
            });
            
            // Logging moved to after turnRecord is created (see below)
            
            // Log AI response to debug service
            debugService.logAiResponse(
              gameId,
              game.turn_count,
              aiResponseMetadata.promptId || 'prompt-v2',
              aiResponseText,
              Date.now() - aiStartTime
            );
            
            // Set aiResult for compatibility with existing code
            aiResult = {
              response: aiResponseText,
              model: assembleResult.meta.model,
              tokenCount: aiResponseObj.usage?.total_tokens || null,
              promptId: aiResponseMetadata.promptId,
              promptData,
              promptMetadata,
            };
          } catch (v2Error) {
            console.error('V2 prompt assembler or AI service error:', v2Error);
            if (v2Error instanceof Error && v2Error.message === 'AI timeout') {
              return {
                success: false,
                error: ApiErrorCode.UPSTREAM_TIMEOUT,
                message: 'AI service timeout',
                details: {
                  prompt: gameContext,
                  aiResponse: null,
                  error: v2Error.message,
                  timestamp: new Date().toISOString()
                }
              };
            }
            return {
              success: false,
              error: ApiErrorCode.INTERNAL_ERROR,
              message: v2Error instanceof Error ? v2Error.message : 'Turn processing error',
              details: {
                prompt: gameContext,
                aiResponse: null,
                error: v2Error instanceof Error ? v2Error.message : String(v2Error),
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

      // Parse and normalize AI response using ai-adapter
      let turnDTO: TurnDTO;
      let parsedAi: unknown;
      try {
        if (!aiResponseText) {
          throw new Error('AI response text is null or undefined');
        }
        
        console.log(`[TURNS_SERVICE] Parsing AI response (${aiResponseText.length} characters)`);
        
        // Parse JSON once
        parsedAi = JSON.parse(aiResponseText);
        console.log('[TURNS_SERVICE] Successfully parsed JSON, normalizing with ai-adapter...');
        
        // Calculate turn number before creating turn record
        const nextTurnCount = game.turn_count + 1;
        const newBalance = wallet.castingStones - turnCost;
        
        // Normalize AI response to TurnDTO using adapter
        // Note: We'll get the actual turn ID and createdAt from the persisted turn record
        // For now, use placeholder values that will be replaced after persistence
        const { aiToTurnDTO, AiNormalizationError } = await import('../ai/ai-adapter.js');
        try {
          turnDTO = await aiToTurnDTO(parsedAi, {
            id: 0, // Placeholder - will be set from turnRecord
            gameId,
            turnCount: nextTurnCount,
            createdAt: new Date().toISOString(), // Placeholder - will be set from turnRecord
            castingStonesBalance: newBalance,
          });
        } catch (normalizationError) {
          if (normalizationError instanceof AiNormalizationError) {
            console.error('[TURNS_SERVICE] AI normalization failed:', normalizationError.message);
            console.error('[TURNS_SERVICE] Normalization details:', normalizationError.details);
            
            // Log WARN with structured data
            console.warn(JSON.stringify({
              event: 'ai_normalization_fail',
              gameId,
              turnCount: nextTurnCount,
              reason: normalizationError.message,
              timestamp: new Date().toISOString(),
            }));
            
            // Return 502 error per spec
            return {
              success: false,
              error: ApiErrorCode.INTERNAL_ERROR, // 502 equivalent
              message: 'AI output invalid',
              details: {
                code: 'AI_NORMALIZE_FAILED',
                message: normalizationError.message,
                timestamp: new Date().toISOString()
              }
            };
          }
          throw normalizationError;
        }
        
        console.log('[TURNS_SERVICE] Successfully normalized AI response to TurnDTO', {
          hasNarrative: !!turnDTO.narrative,
          narrativeLength: turnDTO.narrative.length,
          choicesCount: turnDTO.choices.length,
        });
        
      } catch (error) {
        console.error('[TURNS_SERVICE] Invalid AI response JSON or normalization failed:', error);
        return {
          success: false,
          error: ApiErrorCode.VALIDATION_FAILED,
          message: 'Invalid AI response format',
          details: {
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
          }
        };
      }

      // Convert TurnDTO to TurnResponse format for applyTurn (temporary bridge)
      const turnResponseForApply: TurnResponse = {
        narrative: turnDTO.narrative,
        emotion: turnDTO.emotion as 'neutral' | 'happy' | 'sad' | 'angry' | 'fearful' | 'surprised' | 'excited',
        choices: turnDTO.choices,
        npcResponses: turnDTO.npcResponses,
        relationshipDeltas: turnDTO.relationshipDeltas,
        factionDeltas: turnDTO.factionDeltas,
        worldStateChanges: undefined, // Not in TurnDTO spec, but applyTurn might expect it
      };

      // Apply turn to game state with comprehensive turn data
      timer.start('persistMs');
      const turnRecord = await gamesService.applyTurn(gameId, turnResponseForApply, optionId, {
        userInput: userInput || optionId,
        userInputType: userInputType || 'choice',
        promptData: promptData,
        promptMetadata: promptMetadata,
        aiResponseMetadata: aiResponseMetadata,
        processingTimeMs: Date.now() - turnStartTime
      });
      timer.end('persistMs');
      
      // Update turnDTO with actual turn record fields
      turnDTO.id = turnRecord.turn_number || turnDTO.turnCount;
      // Ensure createdAt is ISO string format
      if (turnRecord.created_at) {
        turnDTO.createdAt = turnRecord.created_at instanceof Date
          ? turnRecord.created_at.toISOString()
          : typeof turnRecord.created_at === 'string'
            ? turnRecord.created_at.endsWith('Z') || turnRecord.created_at.includes('+')
              ? turnRecord.created_at
              : new Date(turnRecord.created_at).toISOString()
            : turnDTO.createdAt; // Keep existing if conversion fails
      }

      // Phase 6: Structured logging for turn creation
      const turnNumber = turnRecord.turn_number || game.turn_count + 1;
      console.log(JSON.stringify({
        event: 'turn.created',
        gameId,
        turnNumber,
        tokenPct: assemblerResult?.meta?.tokenEst?.pct || promptMetadata?.meta?.tokenEst?.pct || 0,
        policy: assemblerResult?.meta?.policy || promptMetadata?.meta?.policy || [],
        model: assemblerResult?.meta?.model || promptMetadata?.meta?.model || 'unknown',
        version: 'v3',
        source: 'entry-point',
      }));

      // Phase 7: Write prompt trace (if enabled and user is admin)
      if (assemblerResult && owner) {
        const ownerId = typeof owner === 'string' ? owner : ((owner as any).id || (owner as any).auth_user_id);
        if (ownerId) {
          try {
            // Check role via Supabase directly
            const { supabaseAdmin } = await import('./supabase.js');
            const { data: profile } = await supabaseAdmin
              .from('user_profiles')
              .select('role')
              .eq('auth_user_id', ownerId)
              .single();
            
            const userRole = profile?.role || null;
            
            if (userRole === 'admin') {
              const { writePromptTrace } = await import('./prompt-trace.service.js');
              await writePromptTrace({
                gameId,
                turnId: turnRecord.id || turnRecord.turn_id || '',
                turnNumber,
                phase: 'turn',
                assembler: {
                  prompt: assemblerResult.prompt,
                  pieces: assemblerResult.pieces,
                  meta: assemblerResult.meta,
                },
                timings: {
                  assembleMs: assemblerResult.meta?.timings?.assembleMs || undefined,
                  aiMs: aiResponseMetadata?.responseTime || undefined,
                  totalMs: Date.now() - turnStartTime,
                },
              });
            }
          } catch (error) {
            // Fail silently - tracing must not break the turn
            console.error('[TURNS_SERVICE] Failed to write prompt trace:', error);
          }
        }
      }
        
      
      // Log state changes to debug service
      const hasStateChanges = turnDTO.relationshipDeltas || turnDTO.factionDeltas;
      if (hasStateChanges) {
        const currentState = await gameStateService.loadGameState(gameId);
        const beforeState = game.state_snapshot;
        const afterState = currentState || {};
          
        
        // Extract changes from TurnDTO
        const changes = [];
        if (turnDTO.relationshipDeltas) {
          changes.push({ type: 'relationships', changes: turnDTO.relationshipDeltas });
        }
        if (turnDTO.factionDeltas) {
          changes.push({ type: 'factions', changes: turnDTO.factionDeltas });
        }
          
        
        debugService.logStateChanges(
          gameId,
          game.turn_count,
          'response-id', // TODO: Get actual response ID
          turnDTO.actions || [], // Use actions from TurnDTO
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


      // TurnDTO already created above with actual turn record fields updated
      // No need to recreate it


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


      const result: TurnResult = {
        success: true,
        turnDTO,
        // Note: details removed per spec - no debug leakage in user responses
        // Debug info only available via ?debug=1 (admin only)
      };

      // Add debug metadata if requested
      if (request.includeDebugMetadata && assemblerResult) {
        result.debugMetadata = {
          assembler: assemblerResult,
          timings: {
            assembleMs: assembleStartTime && assembleEndTime ? assembleEndTime - assembleStartTime : undefined,
            aiMs: aiStartTime && aiEndTime ? aiEndTime - aiStartTime : undefined,
            totalMs: Date.now() - turnStartTime,
          },
        };

        // Add AI data if available
        if (aiRequestData || aiRawResponse || aiResponse) {
          result.debugMetadata.ai = {
            request: aiRequestData,
            rawResponse: aiRawResponse ? {
              content: aiRawResponse.content,
              usage: aiRawResponse.usage,
              model: aiRawResponse.model,
            } : undefined,
            transformed: aiResponse ? {
              narrative: aiResponse.narrative,
              emotion: aiResponse.emotion,
              choices: aiResponse.choices,
            } : undefined,
          };
        }
      }

      return result;
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
      // Check if game state already has proper character and adventure data
      // Don't skip just because metadata exists - we need character data
      const hasCharacter = game.state_snapshot?.character && 
                          Object.keys(game.state_snapshot.character).length > 0;
      const hasAdventure = game.state_snapshot?.adventure && 
                          Object.keys(game.state_snapshot.adventure).length > 0;
      
      // If we have both character and adventure data, we're good
      // OR if we don't have a character_id, then character data isn't needed
      if ((hasCharacter && hasAdventure) || (!game.character_id && hasAdventure)) {
        console.log(`[TURNS] Game ${game.id} already has complete state snapshot, skipping initialization`);
        return;
      }

      console.log(`[TURNS] Initializing/updating game state for game ${game.id}`);
      
      // Load character data if available and not already present
      let characterData = game.state_snapshot?.character || {};
      if (game.character_id && !hasCharacter) {
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
              race: characterResult.data.race,
              class: characterResult.data.class,
              level: characterResult.data.level,
              experience: characterResult.data.experience || 0,
              attributes: characterResult.data.attributes || {},
              traits: characterResult.data.traits || {},
              skills: characterResult.data.skills || [],
              inventory: characterResult.data.inventory || [],
              world_data: characterResult.data.world_data || {},
              current_health: characterResult.data.current_health,
              max_health: characterResult.data.max_health,
            };
            console.log(`[TURNS] Loaded character data for ${characterResult.data.name}`);
          }
        } catch (error) {
          console.error('Error loading character data:', error);
        }
      }

      // Load entry point data if available (games use entry_point_id, not adventure_id)
      let adventureData = game.state_snapshot?.adventure || {};
      if (game.entry_point_id && !hasAdventure) {
        try {
          const entryPointResult = await supabaseAdmin
            .from('entry_points')
            .select('id, name, title, slug, description, synopsis, type, world_id')
            .eq('id', game.entry_point_id)
            .single();
          
          if (entryPointResult.data) {
            adventureData = {
              id: entryPointResult.data.id,
              name: entryPointResult.data.name || entryPointResult.data.title,
              slug: entryPointResult.data.slug,
              description: entryPointResult.data.description,
              synopsis: entryPointResult.data.synopsis,
              type: entryPointResult.data.type,
            };
            console.log(`[TURNS] Loaded entry point data for ${entryPointResult.data.name || entryPointResult.data.title}`);
          }
        } catch (error) {
          console.error('Error loading entry point data:', error);
        }
      }

      // Merge with existing state_snapshot, preserving metadata and other fields
      const existingState = game.state_snapshot || {};
      const initialState = {
        ...existingState, // Preserve existing metadata and other fields
        character: characterData,
        adventure: adventureData,
        flags: {
          ...existingState.flags,
          'game.initialized': true,
          'game.world': game.world_slug,
          'game.entry_point': game.entry_point_id || null,
        },
        ledgers: {
          ...existingState.ledgers,
          'game.turns': existingState.ledgers?.['game.turns'] || 0,
          'game.scenes_visited': existingState.ledgers?.['game.scenes_visited'] || [],
          'game.actions_taken': existingState.ledgers?.['game.actions_taken'] || [],
        },
        runtimeTicks: existingState.runtimeTicks || 0,
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

      // Build prompt using v3 assembler (same as ongoing turns)
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

      // Use buildPromptV2 to assemble the prompt with v3 assembler
      const assembleResult = await this.buildPromptV2(updatedGame, 'game_start');
      const prompt = assembleResult.prompt;
      const promptMetadata = {
        meta: assembleResult.meta,
        pieces: assembleResult.pieces,
      };
      const promptData = prompt;

      // Call OpenAI directly with the assembled prompt
      const { OpenAIService } = await import('./openai.service.js');
      const openaiService = new OpenAIService();
      const aiResponseRaw = await openaiService.generateBufferedResponse(prompt);

      // Parse and validate response (handles markdown code blocks)
      let parsed: any;
      try {
        parsed = openaiService.parseAIResponse(aiResponseRaw.content);
      } catch (parseError) {
        // If parsing fails, try repair
        console.warn('[TURNS] Initial AI response parse failed, attempting repair...');
        try {
          parsed = await openaiService.repairJSONResponse(aiResponseRaw.content, prompt);
        } catch (repairError) {
          console.error('[TURNS] JSON repair also failed:', repairError);
          throw new Error(`Failed to parse AI response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        }
      }
      
      // Validate critical response fields
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('AI response is not a valid JSON object');
      }

      // Transform the response to TurnResponse format (handle both AWF v1 and v2 formats)
      const aiResponse = {
        narrative: parsed.txt || parsed.narrative || '',
        emotion: parsed.emotion || 'neutral',
        choices: parsed.choices || [],
        npcResponses: parsed.npcResponses || {},
        scene: parsed.scn?.id || parsed.scene || updatedGame.state_snapshot?.currentScene || 'forest_meet',
      };
      const transformedResponse = await this.transformAWFToTurnResponse(aiResponse);

      // Apply the initial turn to the game with comprehensive turn data
      const turnRecord = await gamesService.applyTurn(updatedGame.id, transformedResponse, 'game_start', {
        userInput: 'game_start',
        userInputType: 'action',
        promptData: promptData,
        promptMetadata: promptMetadata,
        aiResponseMetadata: {
          model: 'gpt-4o-mini',
          responseTime: 0, // Initial prompt has no timing
          tokenCount: aiResponseRaw.usage?.total_tokens || null,
          promptId: 'initial-prompt-' + Date.now(),
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
        JSON.stringify(aiResponse),
        0 // No timing for initial prompt
      );
      
      // Return the turn data for the frontend
      return {
        turnRecord,
        aiResponse: JSON.stringify(aiResponse),
        transformedResponse,
        initialPrompt: promptData
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
   * Phase 4.2: Build prompt using V2 assembler for ongoing turns
   * @param game - Game data with entry_point_id, world_id, etc.
   * @param optionId - Selected option ID
   * @returns V2 assembler result with prompt, pieces, and meta
   */
  private async buildPromptV2(game: any, optionId: string): Promise<{
    prompt: string;
    pieces: any[];
    meta: {
      included: string[];
      dropped: string[];
      policy?: string[];
      model: string;
      worldId: string;
      rulesetSlug: string;
      scenarioSlug?: string | null;
      entryStartSlug: string;
      tokenEst: { input: number; budget: number; pct: number };
    };
  }> {
    const { config } = await import('../config/index.js');
    const { supabaseAdmin } = await import('./supabase.js');

    // Extract game context for v3 assembler
    // Get entry point ID (required for v3)
    let entryPointId: string;
    let entryStartSlug: string | undefined;

    if (game.entry_point_id) {
      entryPointId = game.entry_point_id;
      
      // Load entry point to get entry_start_slug from doc if needed
      const { data: entryPoint } = await supabaseAdmin
        .from('entry_points')
        .select('id, content')
        .eq('id', entryPointId)
        .single();

      if (entryPoint) {
        // Extract from doc or use slug
        entryStartSlug = entryPoint.content?.doc?.entryStartSlug ||
                        entryPoint.content?.entryStartSlug ||
                        undefined;
      }
    } else {
      // Legacy game without entry_point_id - cannot use v3 assembler
      throw new Error('Game missing entry_point_id; v3 assembler requires entry point');
    }

    const { EntryPointAssemblerV3 } = await import('../prompts/entry-point-assembler-v3.js');

    const assembler = new EntryPointAssemblerV3();

    const budgetTokens = config.prompt.tokenBudgetDefault;
    const model = config.prompt.modelDefault;

    // Assemble prompt using v3 assembler (ongoing turn)
    const assembleResult = await assembler.assemble({
      entryPointId,
      entryStartSlug,
      model,
      budgetTokens,
    });

    return assembleResult;
  }

  /**
   * Helper to check if string is a valid UUID
   */
  private isValidUuid(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  /**
   * @deprecated Use buildPromptV2() instead. This method is kept for compatibility only.
   * Build prompt for AI request (server-only) - Legacy path
   * @param game - Game data
   * @param optionId - Selected option ID
   * @returns Prompt string
   */
  private async buildPrompt(game: any, optionId: string): Promise<string> {
    // Legacy path - should not be called for ongoing turns anymore
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
