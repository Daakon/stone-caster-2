import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import gamesRouter from '../src/routes/games.js';
import { GamesService } from '../src/services/games.service.js';
import { promptsService } from '../src/services/prompts.service.js';

// Mock dependencies
vi.mock('../src/services/games.service.js', () => ({
  GamesService: vi.fn().mockImplementation(() => ({
    getGameById: vi.fn(),
  })),
}));

vi.mock('../src/services/prompts.service.js', () => ({
  promptsService: {
    createInitialPromptWithApproval: vi.fn(),
    approvePrompt: vi.fn(),
  },
}));

vi.mock('../src/middleware/auth.js', () => ({
  optionalAuth: (req: any, res: any, next: any) => {
    req.ctx = {
      userId: 'test-user-id',
      isGuest: false,
    };
    next();
  },
}));

vi.mock('../src/middleware/validation.js', () => ({
  requireIdempotencyKey: (req: any, res: any, next: any) => {
    req.headers['idempotency-key'] = 'test-idempotency-key';
    next();
  },
}));

describe('Games Routes - Initial Prompt', () => {
  let app: express.Application;
  let mockGamesService: any;
  let mockPromptsService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/games', gamesRouter);

    mockGamesService = new GamesService();
    mockPromptsService = promptsService;
  });

  describe('POST /api/games/:id/initial-prompt', () => {
    it('should create initial prompt for uninitiated game', async () => {
      const gameId = 'test-game-id';
      const mockGame = {
        id: gameId,
        turnCount: 0,
        worldSlug: 'test-world',
        characterId: 'test-character',
      };

      const mockPromptResult = {
        prompt: 'Test initial prompt',
        needsApproval: true,
        promptId: 'test-prompt-id',
        metadata: {
          worldId: 'test-world',
          characterId: 'test-character',
          turnIndex: 0,
          tokenCount: 100,
        },
      };

      vi.mocked(mockGamesService.getGameById).mockResolvedValue(mockGame);
      vi.mocked(mockPromptsService.createInitialPromptWithApproval).mockResolvedValue(mockPromptResult);

      const response = await request(app)
        .post(`/api/games/${gameId}/initial-prompt`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: mockPromptResult,
      });
      expect(mockPromptsService.createInitialPromptWithApproval).toHaveBeenCalledWith(
        gameId,
        'test-world',
        'test-character'
      );
    });

    it('should return 404 for non-existent game', async () => {
      const gameId = 'non-existent-game';
      
      vi.mocked(mockGamesService.getGameById).mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/games/${gameId}/initial-prompt`)
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 for already initiated game', async () => {
      const gameId = 'test-game-id';
      const mockGame = {
        id: gameId,
        turnCount: 5, // Game already has turns
        worldSlug: 'test-world',
        characterId: 'test-character',
      };

      vi.mocked(mockGamesService.getGameById).mockResolvedValue(mockGame);

      const response = await request(app)
        .post(`/api/games/${gameId}/initial-prompt`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(response.body.error.message).toBe('Game has already been initiated');
    });

    it('should return 400 for invalid game ID', async () => {
      const response = await request(app)
        .post('/api/games/invalid-id/initial-prompt')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('POST /api/games/:id/approve-prompt', () => {
    it('should approve a prompt successfully', async () => {
      const gameId = 'test-game-id';
      const mockGame = {
        id: gameId,
        turnCount: 0,
        worldSlug: 'test-world',
        characterId: 'test-character',
      };

      const mockApprovalResult = {
        success: true,
        message: 'Prompt approved successfully',
      };

      vi.mocked(mockGamesService.getGameById).mockResolvedValue(mockGame);
      vi.mocked(mockPromptsService.approvePrompt).mockResolvedValue(mockApprovalResult);

      const response = await request(app)
        .post(`/api/games/${gameId}/approve-prompt`)
        .send({
          promptId: 'test-prompt-id',
          approved: true,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: { message: 'Prompt approved successfully' },
      });
      expect(mockPromptsService.approvePrompt).toHaveBeenCalledWith('test-prompt-id', true);
    });

    it('should reject a prompt successfully', async () => {
      const gameId = 'test-game-id';
      const mockGame = {
        id: gameId,
        turnCount: 0,
        worldSlug: 'test-world',
        characterId: 'test-character',
      };

      const mockApprovalResult = {
        success: true,
        message: 'Prompt rejected successfully',
      };

      vi.mocked(mockGamesService.getGameById).mockResolvedValue(mockGame);
      vi.mocked(mockPromptsService.approvePrompt).mockResolvedValue(mockApprovalResult);

      const response = await request(app)
        .post(`/api/games/${gameId}/approve-prompt`)
        .send({
          promptId: 'test-prompt-id',
          approved: false,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: { message: 'Prompt rejected successfully' },
      });
      expect(mockPromptsService.approvePrompt).toHaveBeenCalledWith('test-prompt-id', false);
    });

    it('should return 400 for invalid request body', async () => {
      const gameId = 'test-game-id';

      const response = await request(app)
        .post(`/api/games/${gameId}/approve-prompt`)
        .send({
          // Missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should return 404 for non-existent game', async () => {
      const gameId = 'non-existent-game';
      
      vi.mocked(mockGamesService.getGameById).mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/games/${gameId}/approve-prompt`)
        .send({
          promptId: 'test-prompt-id',
          approved: true,
        });

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});
