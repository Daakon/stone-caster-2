import { WalletService } from './wallet.service.js';
import { promptsService } from './prompts.service.js';
import { gamesService } from './games.service.js';
import { StoneLedgerService } from './stoneLedger.service.js';
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
      const pricingConfig = configService.getPricing();
      const turnCost = this.getTurnCost(pricingConfig, game.world_slug || '');

      // Spend casting stones (with idempotency check)
      const spendResult = await WalletService.spendCastingStones(
        owner,
        turnCost,
        idempotencyKey,
        gameId,
        `turn-${Date.now()}` // Generate turn ID
      );

      if (!spendResult.success) {
        return {
          success: false,
          error: ApiErrorCode.INSUFFICIENT_INVENTORY,
          message: spendResult.message!,
        };
      }

      // Build prompt (server-only)
      const gameContext = {
        id: game.id,
        world_id: game.world_slug || '',
        character_id: game.character_id,
        state_snapshot: game.state_snapshot,
        turn_index: game.turn_count,
      };
      const prompt = await promptsService.buildPrompt(gameContext, optionId);

      // Generate AI response
      let aiResponseText: string;
      try {
        const aiResponse = await aiWrapper.generateResponse({ prompt });
        aiResponseText = aiResponse.content;
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
      await StoneLedgerService.appendEntry({
        walletId: 'wallet-id', // This should be the actual wallet ID
        userId: owner,
        transactionType: 'spend',
        deltaCastingStones: -turnCost,
        deltaInventoryShard: 0,
        deltaInventoryCrystal: 0,
        deltaInventoryRelic: 0,
        reason: 'TURN_SPEND',
        metadata: { game_id: gameId, turn_id: turnResult.id },
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
