import { describe, it, expect, beforeEach, vi } from 'vitest';
import { turnsService } from './turns.service.js';
import { walletService } from './wallet.service.js';
import { promptsService } from './prompts.service.js';
import { gamesService } from './games.service.js';
import { stoneLedgerService } from './stoneLedger.service.js';
import { aiWrapper } from '../wrappers/ai.js';
import { ApiErrorCode } from 'shared';

// Mock dependencies
vi.mock('./wallet.service.js');
vi.mock('./prompts.service.js');
vi.mock('./games.service.js');
vi.mock('./stoneLedger.service.js');
vi.mock('../wrappers/ai.js');

describe('TurnsService', () => {
  const mockWalletService = vi.mocked(walletService);
  const mockPromptsService = vi.mocked(promptsService);
  const mockGamesService = vi.mocked(gamesService);
  const mockStoneLedgerService = vi.mocked(stoneLedgerService);
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
        worldId: 'world-123',
        characterId: 'char-456',
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
      mockAiWrapper.generateBuffered.mockResolvedValue(JSON.stringify(mockAiResponse));
      mockWalletService.spendCasting.mockResolvedValue({
        success: true,
        newBalance: 40,
        ledgerEntryId: 'ledger-123',
      });
      mockGamesService.applyTurn.mockResolvedValue(mockTurnResult);
      mockStoneLedgerService.append.mockResolvedValue('ledger-123');

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
      expect(mockAiWrapper.generateBuffered).toHaveBeenCalledWith(mockPrompt);
      expect(mockWalletService.spendCasting).toHaveBeenCalledWith(owner, expect.any(Number), idempotencyKey, gameId, expect.any(String));
      expect(mockGamesService.applyTurn).toHaveBeenCalledWith(gameId, mockAiResponse);
      expect(mockStoneLedgerService.append).toHaveBeenCalledWith({
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
        worldId: 'world-123',
        characterId: 'char-456',
        state_snapshot: { currentScene: 'tavern' },
        turn_index: 5,
      };

      // Mock insufficient stones
      mockGamesService.loadGame.mockResolvedValue(mockGame);
      mockWalletService.spendCasting.mockResolvedValue({
        success: false,
        error: ApiErrorCode.INSUFFICIENT_STONES,
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
      expect(mockAiWrapper.generateBuffered).not.toHaveBeenCalled();
      expect(mockGamesService.applyTurn).not.toHaveBeenCalled();
    });

    it('should fail with VALIDATION_FAILED for invalid AI response JSON', async () => {
      const gameId = 'game-123';
      const optionId = 'option-456';
      const owner = 'user-789';
      const idempotencyKey = 'key-abc';

      const mockGame = {
        id: gameId,
        worldId: 'world-123',
        characterId: 'char-456',
        state_snapshot: { currentScene: 'tavern' },
        turn_index: 5,
      };

      const mockPrompt = 'You are in a tavern. What do you do?';

      // Mock services
      mockGamesService.loadGame.mockResolvedValue(mockGame);
      mockPromptsService.buildPrompt.mockResolvedValue(mockPrompt);
      mockWalletService.spendCasting.mockResolvedValue({
        success: true,
        newBalance: 40,
        ledgerEntryId: 'ledger-123',
      });

      // Mock invalid AI response
      mockAiWrapper.generateBuffered.mockResolvedValue('invalid json response');

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
        worldId: 'world-123',
        characterId: 'char-456',
        state_snapshot: { currentScene: 'tavern' },
        turn_index: 5,
      };

      const mockPrompt = 'You are in a tavern. What do you do?';

      // Mock services
      mockGamesService.loadGame.mockResolvedValue(mockGame);
      mockPromptsService.buildPrompt.mockResolvedValue(mockPrompt);
      mockWalletService.spendCasting.mockResolvedValue({
        success: true,
        newBalance: 40,
        ledgerEntryId: 'ledger-123',
      });

      // Mock AI response missing required fields
      const invalidResponse = {
        narrative: 'You approach the bartender.',
        // Missing required 'emotion' field
      };
      mockAiWrapper.generateBuffered.mockResolvedValue(JSON.stringify(invalidResponse));

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
      expect(mockWalletService.spendCasting).not.toHaveBeenCalled();
      expect(mockAiWrapper.generateBuffered).not.toHaveBeenCalled();
    });

    it('should handle AI service errors gracefully', async () => {
      const gameId = 'game-123';
      const optionId = 'option-456';
      const owner = 'user-789';
      const idempotencyKey = 'key-abc';

      const mockGame = {
        id: gameId,
        worldId: 'world-123',
        characterId: 'char-456',
        state_snapshot: { currentScene: 'tavern' },
        turn_index: 5,
      };

      const mockPrompt = 'You are in a tavern. What do you do?';

      // Mock services
      mockGamesService.loadGame.mockResolvedValue(mockGame);
      mockPromptsService.buildPrompt.mockResolvedValue(mockPrompt);
      mockWalletService.spendCasting.mockResolvedValue({
        success: true,
        newBalance: 40,
        ledgerEntryId: 'ledger-123',
      });

      // Mock AI service error
      mockAiWrapper.generateBuffered.mockRejectedValue(new Error('AI service unavailable'));

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
