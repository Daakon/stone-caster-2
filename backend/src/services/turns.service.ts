import { WalletService } from './wallet.service.js';
import { promptsService } from './prompts.service.js';
import { gamesService } from './games.service.js';
import { StoneLedgerService } from './stoneLedger.service.js';
import { IdempotencyService } from './idempotency.service.js';
import { aiWrapper } from '../wrappers/ai.js';
import { TurnResponseSchema, type TurnResponse, type TurnDTO } from 'shared';
import { ApiErrorCode } from 'shared';
import { configService } from '../config/index.js';
import { v4 as uuidv4 } from 'uuid';

export interface TurnRequest {
  gameId: string;
  optionId: string;
  owner: string;
  idempotencyKey: string;
}

export interface TurnResult {
  success: boolean;
  turnDTO?: TurnDTO;
  error?: ApiErrorCode;
  message?: string;
}

export class TurnsService {
  /**
   * Execute a buffered turn with AI generation and validation
   * @param request - Turn request parameters
   * @returns Turn result with success status and data
   */
  async runBufferedTurn(request: TurnRequest): Promise<TurnResult> {
    const { gameId, optionId, owner, idempotencyKey } = request;

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
      const wallet = await WalletService.getWallet(owner, false); // TODO: determine if guest
      if (wallet.castingStones < turnCost) {
        return {
          success: false,
          error: ApiErrorCode.INSUFFICIENT_STONES,
          message: `Insufficient casting stones. Have ${wallet.castingStones}, need ${turnCost}`,
        };
      }

      // Build prompt (server-only)
      const prompt = await this.buildPrompt(game, optionId);

      // Generate AI response with timeout handling
      let aiResponseText: string;
      try {
        const aiResponse = await Promise.race([
          aiWrapper.generateResponse({ prompt }),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('AI timeout')), 30000) // 30 second timeout
          )
        ]);
        aiResponseText = aiResponse.content;
      } catch (error) {
        console.error('AI service error:', error);
        if (error instanceof Error && error.message === 'AI timeout') {
          return {
            success: false,
            error: ApiErrorCode.UPSTREAM_TIMEOUT,
            message: 'AI service timeout',
          };
        }
        return {
          success: false,
          error: ApiErrorCode.INTERNAL_ERROR,
          message: 'AI service error',
        };
      }

      // Parse and validate AI response
      let aiResponse: TurnResponse;
      try {
        const parsedResponse = JSON.parse(aiResponseText);
        const validationResult = TurnResponseSchema.safeParse(parsedResponse);
        
        if (!validationResult.success) {
          console.error('AI response validation failed:', validationResult.error);
          return {
            success: false,
            error: ApiErrorCode.VALIDATION_FAILED,
            message: 'AI response validation failed',
          };
        }
        
        aiResponse = validationResult.data;
      } catch (error) {
        console.error('Invalid AI response JSON:', error);
        return {
          success: false,
          error: ApiErrorCode.VALIDATION_FAILED,
          message: 'Invalid AI response format',
        };
      }

      // Apply turn to game state
      const turnRecord = await gamesService.applyTurn(gameId, aiResponse, optionId);

      // Spend casting stones (only after successful turn)
      const spendResult = await WalletService.spendCastingStones(
        owner,
        turnCost,
        idempotencyKey,
        gameId,
        `TURN_SPEND`
      );

      if (!spendResult.success) {
        // This should not happen since we checked balance earlier
        console.error('Unexpected spend failure after successful turn:', spendResult);
        // Continue anyway since turn was successful
      }

      // Create Turn DTO
      const turnDTO = await this.createTurnDTO(turnRecord, aiResponse, game, wallet.castingStones - turnCost);

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
      };
    } catch (error) {
      console.error('Unexpected error in runBufferedTurn:', error);
      return {
        success: false,
        error: ApiErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
      };
    }
  }

  /**
   * Build prompt for AI request (server-only)
   * @param game - Game data
   * @param optionId - Selected option ID
   * @returns Prompt string
   */
  private async buildPrompt(game: any, optionId: string): Promise<string> {
    // TODO: Implement proper prompt building from templates
    // For now, return a basic prompt structure
    return `Game: ${game.id}
World: ${game.world_slug}
Turn: ${game.turn_count + 1}
Option: ${optionId}
State: ${JSON.stringify(game.state_snapshot)}

Generate the next turn response following the TurnResponse schema.`;
  }

  /**
   * Create Turn DTO from turn record and AI response
   * @param turnRecord - Turn record from database
   * @param aiResponse - AI response
   * @param game - Game data
   * @param newBalance - New casting stones balance
   * @returns Turn DTO
   */
  private async createTurnDTO(
    turnRecord: any,
    aiResponse: TurnResponse,
    game: any,
    newBalance: number
  ): Promise<TurnDTO> {
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
}

export const turnsService = new TurnsService();