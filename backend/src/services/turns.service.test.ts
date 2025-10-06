import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TurnsService } from './turns.service.js';
import { IdempotencyService } from './idempotency.service.js';
import { WalletService } from './wallet.service.js';
import { gamesService } from './games.service.js';
import { aiWrapper } from '../wrappers/ai.js';
import { configService } from '../config/index.js';
import { ApiErrorCode } from '@shared';

// Mock dependencies
vi.mock('./idempotency.service.js');
vi.mock('./wallet.service.js');
vi.mock('./games.service.js');
vi.mock('../wrappers/ai.js');
vi.mock('../config/index.js');

describe('TurnsService', () => {
  const mockIdempotencyService = vi.mocked(IdempotencyService);
  const mockWalletService = vi.mocked(WalletService);
  const mockGamesService = vi.mocked(gamesService);
  const mockAiWrapper = vi.mocked(aiWrapper);
  const mockConfigService = vi.mocked(configService);

  const turnsService = new TurnsService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runBufferedTurn', () => {
    const mockRequest = {
      gameId: 'game-123',
      optionId: 'option-456',
      owner: 'user-789',
      idempotencyKey: 'idempotency-key-123'
    };

    const mockGame = {
      id: 'game-123',
      world_slug: 'test-world',
      turn_count: 5,
      state_snapshot: { test: 'state' }
    };

    const mockWallet = {
      id: 'wallet-123',
      castingStones: 10,
      inventoryShard: 0,
      inventoryCrystal: 0,
      inventoryRelic: 0
    };

    const mockAiResponse = {
      narrative: 'You continue your journey...',
      emotion: 'neutral' as const,
      choices: [
        { id: 'choice-1', label: 'Go left', description: 'Take the left path' },
        { id: 'choice-2', label: 'Go right', description: 'Take the right path' }
      ],
      npcResponses: [
        { npcId: 'npc-1', response: 'Hello there!', emotion: 'friendly' }
      ],
      worldStateChanges: { location: 'forest' },
      relationshipDeltas: { 'npc-1': 5 },
      factionDeltas: { 'guild': 2 }
    };

    const mockTurnRecord = {
      id: 'turn-123',
      created_at: '2024-01-01T00:00:00Z'
    };

    it('should execute turn successfully', async () => {
      // Mock idempotency check - no duplicate
      mockIdempotencyService.checkIdempotency.mockResolvedValue({
        isDuplicate: false
      });

      // Mock config
      mockConfigService.getPricing.mockReturnValue({
        turnCostDefault: 2,
        turnCostByWorld: {}
      });

      // Mock game loading
      mockGamesService.loadGame.mockResolvedValue(mockGame);

      // Mock wallet
      mockWalletService.getWallet.mockResolvedValue(mockWallet);

      // Mock AI response
      mockAiWrapper.generateResponse.mockResolvedValue({
        content: JSON.stringify(mockAiResponse)
      });

      // Mock turn application
      mockGamesService.applyTurn.mockResolvedValue(mockTurnRecord);

      // Mock spend stones
      mockWalletService.spendCastingStones.mockResolvedValue({
        success: true,
        newBalance: 8
      });

      // Mock idempotency storage
      mockIdempotencyService.storeIdempotencyRecord.mockResolvedValue({
        id: 'idempotency-123',
        key: 'idempotency-key-123',
        ownerId: 'user-789',
        gameId: 'game-123',
        operation: 'turn',
        requestHash: 'hash-123',
        responseData: {},
        status: 'completed',
        createdAt: '2024-01-01T00:00:00Z'
      });

      const result = await turnsService.runBufferedTurn(mockRequest);

      expect(result.success).toBe(true);
      expect(result.turnDTO).toBeDefined();
      expect(result.turnDTO?.narrative).toBe('You continue your journey...');
      expect(result.turnDTO?.choices).toHaveLength(2);
      expect(result.turnDTO?.castingStonesBalance).toBe(8);
    });

    it('should return cached response for duplicate idempotency key', async () => {
      const cachedResponse = {
        id: 'turn-123',
        gameId: 'game-123',
        turnCount: 6,
        narrative: 'Cached response',
        emotion: 'happy' as const,
        choices: [],
        castingStonesBalance: 8,
        createdAt: '2024-01-01T00:00:00Z'
      };

      mockIdempotencyService.checkIdempotency.mockResolvedValue({
        isDuplicate: true,
        existingRecord: {
          id: 'idempotency-123',
          key: 'idempotency-key-123',
          ownerId: 'user-789',
          gameId: 'game-123',
          operation: 'turn',
          requestHash: 'hash-123',
          responseData: cachedResponse,
          status: 'completed',
          createdAt: '2024-01-01T00:00:00Z'
        }
      });

      const result = await turnsService.runBufferedTurn(mockRequest);

      expect(result.success).toBe(true);
      expect(result.turnDTO).toEqual(cachedResponse);
      // Should not call other services for duplicate requests
      expect(mockGamesService.loadGame).not.toHaveBeenCalled();
      expect(mockAiWrapper.generateResponse).not.toHaveBeenCalled();
    });

    it('should return error when game not found', async () => {
      mockIdempotencyService.checkIdempotency.mockResolvedValue({
        isDuplicate: false
      });

      mockConfigService.getPricing.mockReturnValue({
        turnCostDefault: 2,
        turnCostByWorld: {}
      });

      mockGamesService.loadGame.mockResolvedValue(null);

      const result = await turnsService.runBufferedTurn(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe(ApiErrorCode.NOT_FOUND);
      expect(result.message).toBe('Game not found');
    });

    it('should return error when insufficient stones', async () => {
      mockIdempotencyService.checkIdempotency.mockResolvedValue({
        isDuplicate: false
      });

      mockConfigService.getPricing.mockReturnValue({
        turnCostDefault: 2,
        turnCostByWorld: {}
      });

      mockGamesService.loadGame.mockResolvedValue(mockGame);

      const poorWallet = { ...mockWallet, castingStones: 1 };
      mockWalletService.getWallet.mockResolvedValue(poorWallet);

      const result = await turnsService.runBufferedTurn(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe(ApiErrorCode.INSUFFICIENT_STONES);
      expect(result.message).toContain('Insufficient casting stones');
    });

    it('should return error when AI service times out', async () => {
      mockIdempotencyService.checkIdempotency.mockResolvedValue({
        isDuplicate: false
      });

      mockConfigService.getPricing.mockReturnValue({
        turnCostDefault: 2,
        turnCostByWorld: {}
      });

      mockGamesService.loadGame.mockResolvedValue(mockGame);
      mockWalletService.getWallet.mockResolvedValue(mockWallet);

      // Mock AI timeout
      mockAiWrapper.generateResponse.mockImplementation(
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI timeout')), 100)
        )
      );

      const result = await turnsService.runBufferedTurn(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe(ApiErrorCode.UPSTREAM_TIMEOUT);
      expect(result.message).toBe('AI service timeout');
    });

    it('should return error when AI response is invalid JSON', async () => {
      mockIdempotencyService.checkIdempotency.mockResolvedValue({
        isDuplicate: false
      });

      mockConfigService.getPricing.mockReturnValue({
        turnCostDefault: 2,
        turnCostByWorld: {}
      });

      mockGamesService.loadGame.mockResolvedValue(mockGame);
      mockWalletService.getWallet.mockResolvedValue(mockWallet);

      // Mock invalid JSON response
      mockAiWrapper.generateResponse.mockResolvedValue({
        content: 'invalid json response'
      });

      const result = await turnsService.runBufferedTurn(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe(ApiErrorCode.VALIDATION_FAILED);
      expect(result.message).toBe('Invalid AI response format');
    });

    it('should return error when AI response fails schema validation', async () => {
      mockIdempotencyService.checkIdempotency.mockResolvedValue({
        isDuplicate: false
      });

      mockConfigService.getPricing.mockReturnValue({
        turnCostDefault: 2,
        turnCostByWorld: {}
      });

      mockGamesService.loadGame.mockResolvedValue(mockGame);
      mockWalletService.getWallet.mockResolvedValue(mockWallet);

      // Mock invalid schema response
      const invalidResponse = {
        narrative: 'Test narrative',
        // Missing required fields
      };

      mockAiWrapper.generateResponse.mockResolvedValue({
        content: JSON.stringify(invalidResponse)
      });

      const result = await turnsService.runBufferedTurn(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe(ApiErrorCode.VALIDATION_FAILED);
      expect(result.message).toBe('AI response validation failed');
    });

    it('should use world-specific turn cost when configured', async () => {
      mockIdempotencyService.checkIdempotency.mockResolvedValue({
        isDuplicate: false
      });

      mockConfigService.getPricing.mockReturnValue({
        turnCostDefault: 2,
        turnCostByWorld: {
          'test-world': 5
        }
      });

      mockGamesService.loadGame.mockResolvedValue(mockGame);
      mockWalletService.getWallet.mockResolvedValue(mockWallet);
      mockAiWrapper.generateResponse.mockResolvedValue({
        content: JSON.stringify(mockAiResponse)
      });
      mockGamesService.applyTurn.mockResolvedValue(mockTurnRecord);
      mockWalletService.spendCastingStones.mockResolvedValue({
        success: true,
        newBalance: 5
      });
      mockIdempotencyService.storeIdempotencyRecord.mockResolvedValue({
        id: 'idempotency-123',
        key: 'idempotency-key-123',
        ownerId: 'user-789',
        gameId: 'game-123',
        operation: 'turn',
        requestHash: 'hash-123',
        responseData: {},
        status: 'completed',
        createdAt: '2024-01-01T00:00:00Z'
      });

      const result = await turnsService.runBufferedTurn(mockRequest);

      expect(result.success).toBe(true);
      // Should spend 5 stones (world-specific cost) instead of 2 (default)
      expect(mockWalletService.spendCastingStones).toHaveBeenCalledWith(
        'user-789',
        5, // world-specific cost
        'idempotency-key-123',
        'game-123',
        'TURN_SPEND'
      );
    });
  });
});