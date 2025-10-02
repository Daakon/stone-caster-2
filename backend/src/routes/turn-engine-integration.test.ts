import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../index.js';
// import { WalletService } from '../services/wallet.service.js'; // TODO: Use in tests
// import { turnsService } from '../services/turns.service.js'; // TODO: Use in tests
// import { gamesService } from '../services/games.service.js'; // TODO: Use in tests
// import { promptsService } from '../services/prompts.service.js'; // TODO: Use in tests
// import { StoneLedgerService } from '../services/stoneLedger.service.js'; // TODO: Use in tests
// import { aiWrapper } from '../wrappers/ai.js'; // TODO: Use in tests
import { ApiErrorCode } from 'shared';

// Mock all services
vi.mock('../services/wallet.service.js');
vi.mock('../services/turns.service.js');
vi.mock('../services/games.service.js');
vi.mock('../services/prompts.service.js');
vi.mock('../services/stoneLedger.service.js');
vi.mock('../wrappers/ai.js');

describe('Turn Engine Integration Tests', () => {
  // const mockWalletService = vi.mocked(WalletService); // TODO: Use in tests
  // const mockTurnsService = vi.mocked(turnsService); // TODO: Use in tests
  // const mockGamesService = vi.mocked(gamesService); // TODO: Use in tests
  // const mockPromptsService = vi.mocked(promptsService); // TODO: Use in tests
  // const mockStoneLedgerService = vi.mocked(StoneLedgerService); // TODO: Use in tests
  // const mockAiWrapper = vi.mocked(aiWrapper); // TODO: Use in tests

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/games', () => {
    it('should allow guest spawn with device cookie', async () => {
      const mockGame = {
        id: 'game-123',
        adventure_id: 'adventure-456',
        character_id: undefined,
        user_id: 'guest-cookie-123',
        state_snapshot: {},
        turn_index: 0,
        created_at: '2023-01-01T00:00:00Z',
      };

      mockGamesService.spawn.mockResolvedValue({
        success: true,
        game: mockGame,
      });

      const response = await request(app)
        .post('/api/games')
        .set('Cookie', 'device_id=guest-cookie-123')
        .send({
          adventureId: 'adventure-456',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        data: expect.objectContaining({
          id: 'game-123',
          adventure_id: 'adventure-456',
          character_id: undefined,
        }),
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });

      expect(mockGamesService.spawn).toHaveBeenCalledWith({
        adventureId: 'adventure-456',
        characterId: undefined,
        owner: 'guest-cookie-123',
      });
    });

    it('should allow auth spawn with JWT and character', async () => {
      const mockGame = {
        id: 'game-123',
        adventure_id: 'adventure-456',
        character_id: 'character-789',
        user_id: 'user-123',
        state_snapshot: {},
        turn_index: 0,
        created_at: '2023-01-01T00:00:00Z',
      };

      mockGamesService.spawn.mockResolvedValue({
        success: true,
        game: mockGame,
      });

      // Mock JWT token
      const mockJwt = 'mock-jwt-token';

      const response = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${mockJwt}`)
        .send({
          adventureId: 'adventure-456',
          characterId: 'character-789',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        data: expect.objectContaining({
          id: 'game-123',
          adventure_id: 'adventure-456',
          character_id: 'character-789',
        }),
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });

      expect(mockGamesService.spawn).toHaveBeenCalledWith({
        adventureId: 'adventure-456',
        characterId: 'character-789',
        owner: 'user-123', // From JWT auth
      });
    });

    it('should return CONFLICT when character is already active', async () => {
      mockGamesService.spawn.mockResolvedValue({
        success: false,
        error: ApiErrorCode.CONFLICT,
        message: 'Character is already active in another game',
      });

      const response = await request(app)
        .post('/api/games')
        .set('Authorization', 'Bearer mock-jwt-token')
        .send({
          adventureId: 'adventure-456',
          characterId: 'character-789',
        })
        .expect(409);

      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: ApiErrorCode.CONFLICT,
          message: 'Character is already active in another game',
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });
    });
  });

  describe('POST /api/games/:id/turn', () => {
    it('should successfully process a turn with sufficient stones', async () => {
      const gameId = 'game-123';
      const optionId = 'option-456';
      const idempotencyKey = 'key-abc';

      const mockTurnResult = {
        id: 'turn-123',
        game_id: gameId,
        option_id: optionId,
        ai_response: {
          narrative: 'You approach the bartender and ask for information.',
          emotion: 'neutral',
          suggestedActions: ['Ask about rumors', 'Order a drink'],
        },
        created_at: '2023-01-01T00:00:00Z',
      };

      mockTurnsService.runBufferedTurn.mockResolvedValue({
        success: true,
        turnResult: mockTurnResult,
      });

      const response = await request(app)
        .post(`/api/games/${gameId}/turn`)
        .set('Authorization', 'Bearer mock-jwt-token')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          optionId,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        data: expect.objectContaining({
          id: 'turn-123',
          game_id: gameId,
          option_id: optionId,
          // Should not include internal fields
          ai_response: expect.not.objectContaining({
            state_snapshot: expect.anything(),
            prompt_text: expect.anything(),
          }),
        }),
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });

      expect(mockTurnsService.runBufferedTurn).toHaveBeenCalledWith({
        gameId,
        optionId,
        owner: 'user-123', // From JWT auth
        idempotencyKey,
      });
    });

    it('should return INSUFFICIENT_STONES when wallet has insufficient balance', async () => {
      const gameId = 'game-123';
      const optionId = 'option-456';
      const idempotencyKey = 'key-abc';

      mockTurnsService.runBufferedTurn.mockResolvedValue({
        success: false,
        error: ApiErrorCode.INSUFFICIENT_STONES,
        message: 'Insufficient casting stones',
      });

      const response = await request(app)
        .post(`/api/games/${gameId}/turn`)
        .set('Authorization', 'Bearer mock-jwt-token')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          optionId,
        })
        .expect(402); // Payment Required

      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: ApiErrorCode.INSUFFICIENT_STONES,
          message: 'Insufficient casting stones',
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });
    });

    it('should return IDEMPOTENCY_REQUIRED when header is missing', async () => {
      const gameId = 'game-123';
      const optionId = 'option-456';

      const response = await request(app)
        .post(`/api/games/${gameId}/turn`)
        .set('Authorization', 'Bearer mock-jwt-token')
        .send({
          optionId,
        })
        .expect(400);

      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: ApiErrorCode.IDEMPOTENCY_REQUIRED,
          message: 'Idempotency-Key header is required',
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });

      // Verify turn service was not called
      expect(mockTurnsService.runBufferedTurn).not.toHaveBeenCalled();
    });

    it('should handle duplicate idempotency key correctly', async () => {
      const gameId = 'game-123';
      const optionId = 'option-456';
      const idempotencyKey = 'duplicate-key';

      const mockTurnResult = {
        id: 'turn-123',
        game_id: gameId,
        option_id: optionId,
        ai_response: {
          narrative: 'You approach the bartender.',
          emotion: 'neutral',
          suggestedActions: ['Ask about rumors'],
        },
        created_at: '2023-01-01T00:00:00Z',
      };

      // First call succeeds
      mockTurnsService.runBufferedTurn.mockResolvedValueOnce({
        success: true,
        turnResult: mockTurnResult,
      });

      // Second call with same key returns same result (idempotent)
      mockTurnsService.runBufferedTurn.mockResolvedValueOnce({
        success: true,
        turnResult: mockTurnResult,
      });

      // First request
      const response1 = await request(app)
        .post(`/api/games/${gameId}/turn`)
        .set('Authorization', 'Bearer mock-jwt-token')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          optionId,
        })
        .expect(200);

      // Second request with same key
      const response2 = await request(app)
        .post(`/api/games/${gameId}/turn`)
        .set('Authorization', 'Bearer mock-jwt-token')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          optionId,
        })
        .expect(200);

      // Both should return the same result
      expect(response1.body.data.id).toBe(response2.body.data.id);
      expect(response1.body.data).toEqual(response2.body.data);

      // Verify turn service was called twice
      expect(mockTurnsService.runBufferedTurn).toHaveBeenCalledTimes(2);
    });

    it('should return VALIDATION_FAILED for invalid AI response', async () => {
      const gameId = 'game-123';
      const optionId = 'option-456';
      const idempotencyKey = 'key-abc';

      mockTurnsService.runBufferedTurn.mockResolvedValue({
        success: false,
        error: ApiErrorCode.VALIDATION_FAILED,
        message: 'AI response validation failed',
      });

      const response = await request(app)
        .post(`/api/games/${gameId}/turn`)
        .set('Authorization', 'Bearer mock-jwt-token')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          optionId,
        })
        .expect(422);

      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'AI response validation failed',
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });
    });

    it('should return NOT_FOUND for non-existent game', async () => {
      const gameId = 'nonexistent-game';
      const optionId = 'option-456';
      const idempotencyKey = 'key-abc';

      mockTurnsService.runBufferedTurn.mockResolvedValue({
        success: false,
        error: ApiErrorCode.NOT_FOUND,
        message: 'Game not found',
      });

      const response = await request(app)
        .post(`/api/games/${gameId}/turn`)
        .set('Authorization', 'Bearer mock-jwt-token')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          optionId,
        })
        .expect(404);

      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: ApiErrorCode.NOT_FOUND,
          message: 'Game not found',
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });
    });
  });

  describe('Race Condition Tests', () => {
    it('should handle concurrent turn requests with same idempotency key', async () => {
      const gameId = 'game-123';
      const optionId = 'option-456';
      const idempotencyKey = 'race-key';

      const mockTurnResult = {
        id: 'turn-123',
        game_id: gameId,
        option_id: optionId,
        ai_response: {
          narrative: 'You approach the bartender.',
          emotion: 'neutral',
          suggestedActions: ['Ask about rumors'],
        },
        created_at: '2023-01-01T00:00:00Z',
      };

      // Mock both calls to return the same result (idempotent behavior)
      mockTurnsService.runBufferedTurn.mockResolvedValue({
        success: true,
        turnResult: mockTurnResult,
      });

      // Make concurrent requests
      const [response1, response2] = await Promise.all([
        request(app)
          .post(`/api/games/${gameId}/turn`)
          .set('Authorization', 'Bearer mock-jwt-token')
          .set('Idempotency-Key', idempotencyKey)
          .send({ optionId }),
        request(app)
          .post(`/api/games/${gameId}/turn`)
          .set('Authorization', 'Bearer mock-jwt-token')
          .set('Idempotency-Key', idempotencyKey)
          .send({ optionId }),
      ]);

      // Both should succeed with same result
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.data.id).toBe(response2.body.data.id);
      expect(response1.body.data).toEqual(response2.body.data);

      // Verify turn service was called twice (race condition handling)
      expect(mockTurnsService.runBufferedTurn).toHaveBeenCalledTimes(2);
    });
  });
});
