import { walletService } from './wallet.service.js';
import { promptsService } from './prompts.service.js';
import { gamesService } from './games.service.js';
import { stoneLedgerService } from './stoneLedger.service.js';
import { aiWrapper } from '../wrappers/ai.js';
import { TurnResponseSchema, type TurnResponse } from 'shared';
import { ApiErrorCode } from 'shared';
import { configService } from '../config/index.js';

export interface TurnRequest {
  gameId: string;
  optionId: string;
  owner: string;
  idempotencyKey: string;
}

export interface TurnResult {
  success: boolean;
  turnResult?: any;
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
      const config = await configService.getConfig();
      const turnCost = this.getTurnCost(config, game.worldId);

      // Spend casting stones (with idempotency check)
      const spendResult = await walletService.spendCasting(
        owner,
        turnCost,
        idempotencyKey,
        gameId,
        `turn-${Date.now()}` // Generate turn ID
      );

      if (!spendResult.success) {
        return {
          success: false,
          error: spendResult.error!,
          message: spendResult.message!,
        };
      }

      // Build prompt (server-only)
      const prompt = await promptsService.buildPrompt(game, optionId);

      // Generate AI response
      let aiResponseText: string;
      try {
        aiResponseText = await aiWrapper.generateBuffered(prompt);
      } catch (error) {
        console.error('AI service error:', error);
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
      const turnResult = await gamesService.applyTurn(gameId, aiResponse);

      // Create ledger entry for the spend
      await stoneLedgerService.append({
        owner,
        delta: -turnCost,
        reason: 'TURN_SPEND',
        game_id: gameId,
        turn_id: turnResult.id,
      });

      return {
        success: true,
        turnResult,
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
    return config.pricing?.turn_cost_default || 10;
  }
}

export const turnsService = new TurnsService();
