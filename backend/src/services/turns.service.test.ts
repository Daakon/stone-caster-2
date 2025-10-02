import { describe, it, expect, beforeEach, vi } from 'vitest';
import { turnsService } from './turns.service.js';
import { WalletService } from './wallet.service.js';
import { promptsService } from './prompts.service.js';
import { gamesService } from './games.service.js';
import { StoneLedgerService } from './stoneLedger.service.js';
import { aiWrapper } from '../wrappers/ai.js';
import { ApiErrorCode } from 'shared';

// Mock dependencies
vi.mock('./wallet.service.js');
vi.mock('./prompts.service.js');
vi.mock('./games.service.js');
vi.mock('./stoneLedger.service.js');
vi.mock('../wrappers/ai.js');

describe('TurnsService', () => {
  const mockWalletService = vi.mocked(WalletService);
  const mockPromptsService = vi.mocked(promptsService);
  const mockGamesService = vi.mocked(gamesService);
  const mockStoneLedgerService = vi.mocked(StoneLedgerService);
  const mockAiWrapper = vi.mocked(aiWrapper);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runBufferedTurn', () => {
    it('should successfully process a valid turn', async () => {
      const gameId = 'game-123';
      const optionId = 'option-456';
      const owner = 'user-789';
      const idempotencyKey = 'key-abc';

      const mockGame = {
        id: gameId,
        adventure_id: 'adventure-123',
        character_id: 'char-456',
        user_id: owner,
        world_id: 'world-123',
        created_at: '2023-01-01T00:00:00Z',
        state_snapshot: { currentScene: 'tavern' },
        turn_index: 5,
      };

      const mockPrompt = 'You are in a tavern. What do you do?';
      const mockAiResponse = {
        narrative: 'You approach the bartender and ask for information.',
        emotion: 'neutral',
        suggestedActions: ['Ask about rumors', 'Order a drink', 'Look around'],
        worldStateChanges: { tavern_visited: true },
      };

      const mockTurnResult = {
        id: 'turn-123',
        game_id: gameId,
        option_id: optionId,
        ai_response: mockAiResponse,
        created_at: '2023-01-01T00:00:00Z',
      };

      // Mock service calls
      mockGamesService.loadGame.mockResolvedValue(mockGame);
      mockPromptsService.buildPrompt.mockResolvedValue(mockPrompt);
      mockAiWrapper.generateResponse.mockResolvedValue({
        content: JSON.stringify(mockAiResponse),
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
      });
      mockWalletService.spendCastingStones.mockResolvedValue({
        success: true,
        newBalance: 40,
      });
      mockGamesService.applyTurn.mockResolvedValue(mockTurnResult);
      mockStoneLedgerService.appendEntry.mockResolvedValue({
        id: 'ledger-123',
        userId: owner,
        createdAt: '2023-01-01T00:00:00Z',
        walletId: 'wallet-id',
        transactionType: 'spend' as const,
        deltaCastingStones: -2,
        deltaInventoryShard: 0,
        deltaInventoryCrystal: 0,
        deltaInventoryRelic: 0,
        reason: 'TURN_SPEND',
        metadata: {},
      });

      const result = await turnsService.runBufferedTurn({
        gameId,
        optionId,
        owner,
        idempotencyKey,
      });

      expect(result).toEqual({
        success: true,
        turnResult: expect.objectContaining({
          id: 'turn-123',
          game_id: gameId,
          option_id: optionId,
          // Should not include internal fields
          ai_response: expect.not.objectContaining({
            state_snapshot: expect.anything(),
            prompt_text: expect.anything(),
          }),
        }),
      });

      // Verify all services were called correctly
      expect(mockGamesService.loadGame).toHaveBeenCalledWith(gameId);
      expect(mockPromptsService.buildPrompt).toHaveBeenCalledWith(mockGame, optionId);
      expect(mockAiWrapper.generateResponse).toHaveBeenCalledWith({ prompt: mockPrompt });
      expect(mockWalletService.spendCastingStones).toHaveBeenCalledWith(owner, expect.any(Number), idempotencyKey, gameId, expect.any(String));
      expect(mockGamesService.applyTurn).toHaveBeenCalledWith(gameId, mockAiResponse);
      expect(mockStoneLedgerService.appendEntry).toHaveBeenCalledWith({
        owner,
        delta: expect.any(Number),
        reason: 'TURN_SPEND',
        game_id: gameId,
        turn_id: expect.any(String),
      });
    });

    it('should fail with INSUFFICIENT_STONES when wallet spend fails', async () => {
      const gameId = 'game-123';
      const optionId = 'option-456';
      const owner = 'user-789';
      const idempotencyKey = 'key-abc';

      const mockGame = {
        id: gameId,
        adventure_id: 'adventure-123',
        character_id: 'char-456',
        user_id: owner,
        world_id: 'world-123',
        created_at: '2023-01-01T00:00:00Z',
        state_snapshot: { currentScene: 'tavern' },
        turn_index: 5,
      };

      // Mock insufficient stones
      mockGamesService.loadGame.mockResolvedValue(mockGame);
      mockWalletService.spendCastingStones.mockResolvedValue({
        success: false,
        newBalance: 0,
        error: 'INSUFFICIENT_INVENTORY',
        message: 'Insufficient casting stones',
      });

      const result = await turnsService.runBufferedTurn({
        gameId,
        optionId,
        owner,
        idempotencyKey,
      });

      expect(result).toEqual({
        success: false,
        error: ApiErrorCode.INSUFFICIENT_STONES,
        message: 'Insufficient casting stones',
      });

      // Verify AI was not called
      expect(mockAiWrapper.generateResponse).not.toHaveBeenCalled();
      expect(mockGamesService.applyTurn).not.toHaveBeenCalled();
    });

    it('should fail with VALIDATION_FAILED for invalid AI response JSON', async () => {
      const gameId = 'game-123';
      const optionId = 'option-456';
      const owner = 'user-789';
      const idempotencyKey = 'key-abc';

      const mockGame = {
        id: gameId,
        adventure_id: 'adventure-123',
        character_id: 'char-456',
        user_id: owner,
        world_id: 'world-123',
        created_at: '2023-01-01T00:00:00Z',
        state_snapshot: { currentScene: 'tavern' },
        turn_index: 5,
      };

      const mockPrompt = 'You are in a tavern. What do you do?';

      // Mock services
      mockGamesService.loadGame.mockResolvedValue(mockGame);
      mockPromptsService.buildPrompt.mockResolvedValue(mockPrompt);
      mockWalletService.spendCastingStones.mockResolvedValue({
        success: true,
        newBalance: 40,
      });

      // Mock invalid AI response
      mockAiWrapper.generateResponse.mockResolvedValue({
        content: 'invalid json response',
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
      });

      const result = await turnsService.runBufferedTurn({
        gameId,
        optionId,
        owner,
        idempotencyKey,
      });

      expect(result).toEqual({
        success: false,
        error: ApiErrorCode.VALIDATION_FAILED,
        message: 'Invalid AI response format',
      });

      // Verify turn was not applied
      expect(mockGamesService.applyTurn).not.toHaveBeenCalled();
    });

    it('should fail with VALIDATION_FAILED for AI response missing required fields', async () => {
      const gameId = 'game-123';
      const optionId = 'option-456';
      const owner = 'user-789';
      const idempotencyKey = 'key-abc';

      const mockGame = {
        id: gameId,
        adventure_id: 'adventure-123',
        character_id: 'char-456',
        user_id: owner,
        world_id: 'world-123',
        created_at: '2023-01-01T00:00:00Z',
        state_snapshot: { currentScene: 'tavern' },
        turn_index: 5,
      };

      const mockPrompt = 'You are in a tavern. What do you do?';

      // Mock services
      mockGamesService.loadGame.mockResolvedValue(mockGame);
      mockPromptsService.buildPrompt.mockResolvedValue(mockPrompt);
      mockWalletService.spendCastingStones.mockResolvedValue({
        success: true,
        newBalance: 40,
      });

      // Mock AI response missing required fields
      const invalidResponse = {
        narrative: 'You approach the bartender.',
        // Missing required 'emotion' field
      };
      mockAiWrapper.generateResponse.mockResolvedValue({
        content: JSON.stringify(invalidResponse),
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
      });

      const result = await turnsService.runBufferedTurn({
        gameId,
        optionId,
        owner,
        idempotencyKey,
      });

      expect(result).toEqual({
        success: false,
        error: ApiErrorCode.VALIDATION_FAILED,
        message: 'AI response validation failed',
      });

      // Verify turn was not applied
      expect(mockGamesService.applyTurn).not.toHaveBeenCalled();
    });

    it('should handle game not found', async () => {
      const gameId = 'nonexistent-game';
      const optionId = 'option-456';
      const owner = 'user-789';
      const idempotencyKey = 'key-abc';

      // Mock game not found
      mockGamesService.loadGame.mockResolvedValue(null);

      const result = await turnsService.runBufferedTurn({
        gameId,
        optionId,
        owner,
        idempotencyKey,
      });

      expect(result).toEqual({
        success: false,
        error: ApiErrorCode.NOT_FOUND,
        message: 'Game not found',
      });

      // Verify no other services were called
      expect(mockWalletService.spendCastingStones).not.toHaveBeenCalled();
      expect(mockAiWrapper.generateResponse).not.toHaveBeenCalled();
    });

    it('should handle AI service errors gracefully', async () => {
      const gameId = 'game-123';
      const optionId = 'option-456';
      const owner = 'user-789';
      const idempotencyKey = 'key-abc';

      const mockGame = {
        id: gameId,
        adventure_id: 'adventure-123',
        character_id: 'char-456',
        user_id: owner,
        world_id: 'world-123',
        created_at: '2023-01-01T00:00:00Z',
        state_snapshot: { currentScene: 'tavern' },
        turn_index: 5,
      };

      const mockPrompt = 'You are in a tavern. What do you do?';

      // Mock services
      mockGamesService.loadGame.mockResolvedValue(mockGame);
      mockPromptsService.buildPrompt.mockResolvedValue(mockPrompt);
      mockWalletService.spendCastingStones.mockResolvedValue({
        success: true,
        newBalance: 40,
      });

      // Mock AI service error
      mockAiWrapper.generateResponse.mockRejectedValue(new Error('AI service unavailable'));

      const result = await turnsService.runBufferedTurn({
        gameId,
        optionId,
        owner,
        idempotencyKey,
      });

      expect(result).toEqual({
        success: false,
        error: ApiErrorCode.INTERNAL_ERROR,
        message: 'AI service error',
      });

      // Verify turn was not applied
      expect(mockGamesService.applyTurn).not.toHaveBeenCalled();
    });
  });
});
