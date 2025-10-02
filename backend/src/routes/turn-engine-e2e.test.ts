import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { ApiErrorCode } from 'shared';

// Mock all the services to return predictable results
vi.mock('../services/wallet.service.js', () => ({
  walletService: {
    spendCasting: vi.fn(),
    getBalance: vi.fn(),
  },
}));

vi.mock('../services/turns.service.js', () => ({
  turnsService: {
    runBufferedTurn: vi.fn(),
  },
}));

vi.mock('../services/games.service.js', () => ({
  gamesService: {
    spawn: vi.fn(),
    loadGame: vi.fn(),
    applyTurn: vi.fn(),
  },
}));

vi.mock('../services/prompts.service.js', () => ({
  promptsService: {
    buildPrompt: vi.fn(),
  },
}));

vi.mock('../services/stoneLedger.service.js', () => ({
  stoneLedgerService: {
    append: vi.fn(),
  },
}));

vi.mock('../wrappers/ai.js', () => ({
  generateBuffered: vi.fn(),
}));

// Mock auth middleware to avoid Supabase connection issues
vi.mock('../middleware/auth.js', () => ({
  optionalAuth: (req: any, res: any, next: any) => {
    // Set up mock context based on cookies or auth headers
    if (req.headers.cookie && req.headers.cookie.includes('device_id=guest-cookie-123')) {
      req.ctx = { userId: 'guest-cookie-123', isGuest: true };
    } else if (req.headers.authorization && req.headers.authorization.includes('Bearer mock-jwt-token')) {
      req.ctx = { userId: 'user-123', isGuest: false };
    } else {
      req.ctx = { userId: null, isGuest: true };
    }
    next();
  },
  jwtAuth: (req: any, res: any, next: any) => {
    if (req.headers.authorization && req.headers.authorization.includes('Bearer mock-jwt-token')) {
      req.ctx = { userId: 'user-123', isGuest: false };
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  },
  requireAuth: (req: any, res: any, next: any) => {
    if (req.ctx?.userId) {
      next();
    } else {
      res.status(401).json({ error: 'Authentication required' });
    }
  },
}));

describe('Turn Engine E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Stone Economy Flow', () => {
    it('should handle guest spawn and turn flow', async () => {
      // Mock successful game spawn
      const { gamesService } = await import('../services/games.service.js');
      vi.mocked(gamesService.spawn).mockResolvedValue({
        success: true,
        game: {
          id: 'game-123',
          adventure_id: '123e4567-e89b-12d3-a456-426614174456',
          character_id: undefined,
          user_id: 'user-123',
          state_snapshot: {
            currentScene: 'tavern',
            history: [],
            npcs: [],
            worldState: {},
          },
          turn_index: 0,
          world_id: '123e4567-e89b-12d3-a456-426614174456',
          created_at: '2023-01-01T00:00:00Z',
        },
      });

      // Mock successful turn processing
      const { turnsService } = await import('../services/turns.service.js');
      vi.mocked(turnsService.runBufferedTurn).mockResolvedValue({
        success: true,
        turnResult: {
          id: 'turn-123',
          game_id: 'game-123',
          option_id: 'option-456',
          ai_response: {
            narrative: 'You approach the bartender and ask for information.',
            emotion: 'neutral',
            suggestedActions: ['Ask about rumors', 'Order a drink'],
          },
          created_at: '2023-01-01T00:00:00Z',
        },
      });

      // Test game spawn
      const spawnResponse = await request(app)
        .post('/api/games')
        .set('Cookie', 'device_id=guest-cookie-123')
        .send({
          adventureId: '123e4567-e89b-12d3-a456-426614174456',
        })
        .expect(201);

      expect(spawnResponse.body).toMatchObject({
        ok: true,
        data: expect.objectContaining({
          id: 'game-123',
          adventureId: '123e4567-e89b-12d3-a456-426614174456',
          character_id: undefined,
        }),
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });

      // Test turn submission
      const turnResponse = await request(app)
        .post('/api/games/123e4567-e89b-12d3-a456-426614174123/turn')
        .set('Cookie', 'device_id=guest-cookie-123')
        .set('Idempotency-Key', 'test-key-123')
        .send({
          optionId: '123e4567-e89b-12d3-a456-426614174789',
        })
        .expect(200);

      expect(turnResponse.body).toMatchObject({
        ok: true,
        data: expect.objectContaining({
          id: 'turn-123',
          game_id: '123e4567-e89b-12d3-a456-426614174123',
          option_id: '123e4567-e89b-12d3-a456-426614174789',
          ai_response: expect.objectContaining({
            narrative: expect.any(String),
            emotion: 'neutral',
            suggestedActions: expect.any(Array),
          }),
        }),
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });

      // Verify services were called correctly
      expect(gamesService.spawn).toHaveBeenCalledWith({
        adventureId: '123e4567-e89b-12d3-a456-426614174456',
        characterId: undefined,
        owner: 'guest-cookie-123',
      });

      expect(turnsService.runBufferedTurn).toHaveBeenCalledWith({
        gameId: '123e4567-e89b-12d3-a456-426614174123',
        optionId: '123e4567-e89b-12d3-a456-426614174789',
        owner: 'guest-cookie-123',
        idempotencyKey: 'test-key-123',
      });
    });

    it('should handle insufficient stones error', async () => {
      // Mock insufficient stones error
      const { turnsService } = await import('../services/turns.service.js');
      vi.mocked(turnsService.runBufferedTurn).mockResolvedValue({
        success: false,
        error: ApiErrorCode.INSUFFICIENT_STONES,
        message: 'Insufficient casting stones',
      });

      const response = await request(app)
        .post('/api/games/123e4567-e89b-12d3-a456-426614174123/turn')
        .set('Cookie', 'device_id=guest-cookie-123')
        .set('Idempotency-Key', 'test-key-123')
        .send({
          optionId: '123e4567-e89b-12d3-a456-426614174789',
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

    it('should handle character constraint violation', async () => {
      // Mock character already active error
      const { gamesService } = await import('../services/games.service.js');
      vi.mocked(gamesService.spawn).mockResolvedValue({
        success: false,
        error: ApiErrorCode.CONFLICT,
        message: 'Character is already active in another game',
      });

      const response = await request(app)
        .post('/api/games')
        .set('Authorization', 'Bearer mock-jwt-token')
        .send({
          adventureId: '123e4567-e89b-12d3-a456-426614174456',
          characterId: '123e4567-e89b-12d3-a456-426614174789',
        })
        .expect(409); // Conflict

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

    it('should require idempotency key for turns', async () => {
      const response = await request(app)
        .post('/api/games/123e4567-e89b-12d3-a456-426614174123/turn')
        .set('Cookie', 'device_id=guest-cookie-123')
        .send({
          optionId: '123e4567-e89b-12d3-a456-426614174789',
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
    });
  });
});
