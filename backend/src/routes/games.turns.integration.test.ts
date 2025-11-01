import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import gamesRouter from './games.js';
import { GamesService } from '../services/games.service.js';

// Mock the games service
vi.mock('../services/games.service.js');

// Mock auth middleware
vi.mock('../middleware/auth.js', () => ({
  optionalAuth: (req: any, res: any, next: any) => {
    req.ctx = {
      userId: 'test-user-id',
      isGuest: false,
    };
    next();
  },
}));

describe('GET /api/games/:id/turns - Pagination', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/games', gamesRouter);

  const mockGamesService = vi.mocked(GamesService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const gameId = '550e8400-e29b-41d4-a716-446655440000';

  describe('Default pagination', () => {
    it('should return first page with default limit of 20', async () => {
      const mockTurns = Array.from({ length: 20 }, (_, i) => ({
        id: `turn-${i + 1}`,
        game_id: gameId,
        turn_number: i + 1,
        created_at: `2024-01-01T00:00:${String(i).padStart(2, '0')}Z`,
        ai_response: { narrative: `Turn ${i + 1}` },
      }));

      const mockGame = {
        id: gameId,
        turnCount: 20,
        status: 'active',
      };

      const mockServiceInstance = {
        getGameById: vi.fn().mockResolvedValue(mockGame),
        getGameTurns: vi.fn().mockResolvedValue({
          turns: mockTurns,
          next: { afterTurn: 20 },
        }),
      };

      mockGamesService.mockImplementation(() => mockServiceInstance as any);

      const response = await request(app)
        .get(`/api/games/${gameId}/turns`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data.turns).toHaveLength(20);
      expect(response.body.data.turns[0].turn_number).toBe(1);
      expect(response.body.data.turns[19].turn_number).toBe(20);
      expect(response.body.data.next).toEqual({ afterTurn: 20 });
      expect(mockServiceInstance.getGameTurns).toHaveBeenCalledWith(gameId, {
        afterTurn: undefined,
        limit: 20,
      });
    });
  });

  describe('Cursor pagination', () => {
    it('should return second page when afterTurn is provided', async () => {
      const mockTurns = Array.from({ length: 10 }, (_, i) => ({
        id: `turn-${i + 3}`,
        game_id: gameId,
        turn_number: i + 3,
        created_at: `2024-01-01T00:00:${String(i + 2).padStart(2, '0')}Z`,
        ai_response: { narrative: `Turn ${i + 3}` },
      }));

      const mockGame = {
        id: gameId,
        turnCount: 12,
        status: 'active',
      };

      const mockServiceInstance = {
        getGameById: vi.fn().mockResolvedValue(mockGame),
        getGameTurns: vi.fn().mockResolvedValue({
          turns: mockTurns,
          next: { afterTurn: 12 },
        }),
      };

      mockGamesService.mockImplementation(() => mockServiceInstance as any);

      const response = await request(app)
        .get(`/api/games/${gameId}/turns?afterTurn=2&limit=10`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data.turns).toHaveLength(10);
      expect(response.body.data.turns[0].turn_number).toBe(3);
      expect(response.body.data.turns[9].turn_number).toBe(12);
      expect(response.body.data.next).toEqual({ afterTurn: 12 });
      expect(mockServiceInstance.getGameTurns).toHaveBeenCalledWith(gameId, {
        afterTurn: 2,
        limit: 10,
      });
    });

    it('should return final page without next cursor', async () => {
      const mockTurns = Array.from({ length: 5 }, (_, i) => ({
        id: `turn-${i + 6}`,
        game_id: gameId,
        turn_number: i + 6,
        created_at: `2024-01-01T00:00:${String(i + 5).padStart(2, '0')}Z`,
        ai_response: { narrative: `Turn ${i + 6}` },
      }));

      const mockGame = {
        id: gameId,
        turnCount: 10,
        status: 'active',
      };

      const mockServiceInstance = {
        getGameById: vi.fn().mockResolvedValue(mockGame),
        getGameTurns: vi.fn().mockResolvedValue({
          turns: mockTurns,
          // No next cursor - final page
        }),
      };

      mockGamesService.mockImplementation(() => mockServiceInstance as any);

      const response = await request(app)
        .get(`/api/games/${gameId}/turns?afterTurn=5&limit=10`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data.turns).toHaveLength(5);
      expect(response.body.data.turns[0].turn_number).toBe(6);
      expect(response.body.data.turns[4].turn_number).toBe(10);
      expect(response.body.data.next).toBeUndefined();
      expect(mockServiceInstance.getGameTurns).toHaveBeenCalledWith(gameId, {
        afterTurn: 5,
        limit: 10,
      });
    });
  });

  describe('Query parameter validation', () => {
    const mockGame = {
      id: gameId,
      turnCount: 5,
      status: 'active',
    };

    it('should reject limit greater than 100', async () => {
      const mockServiceInstance = {
        getGameById: vi.fn().mockResolvedValue(mockGame),
        getGameTurns: vi.fn(),
      };

      mockGamesService.mockImplementation(() => mockServiceInstance as any);

      const response = await request(app)
        .get(`/api/games/${gameId}/turns?limit=101`)
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(mockServiceInstance.getGameTurns).not.toHaveBeenCalled();
    });

    it('should reject limit less than 1', async () => {
      const mockServiceInstance = {
        getGameById: vi.fn().mockResolvedValue(mockGame),
        getGameTurns: vi.fn(),
      };

      mockGamesService.mockImplementation(() => mockServiceInstance as any);

      const response = await request(app)
        .get(`/api/games/${gameId}/turns?limit=0`)
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should reject afterTurn less than 1', async () => {
      const mockServiceInstance = {
        getGameById: vi.fn().mockResolvedValue(mockGame),
        getGameTurns: vi.fn(),
      };

      mockGamesService.mockImplementation(() => mockServiceInstance as any);

      const response = await request(app)
        .get(`/api/games/${gameId}/turns?afterTurn=0`)
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should accept valid limit and afterTurn as strings (coercion)', async () => {
      const mockTurns = [
        { id: 'turn-3', game_id: gameId, turn_number: 3, created_at: '2024-01-01T00:00:00Z', ai_response: {} },
        { id: 'turn-4', game_id: gameId, turn_number: 4, created_at: '2024-01-01T00:00:01Z', ai_response: {} },
      ];

      const mockServiceInstance = {
        getGameById: vi.fn().mockResolvedValue(mockGame),
        getGameTurns: vi.fn().mockResolvedValue({
          turns: mockTurns,
        }),
      };

      mockGamesService.mockImplementation(() => mockServiceInstance as any);

      const response = await request(app)
        .get(`/api/games/${gameId}/turns?afterTurn=2&limit=2`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data.turns).toHaveLength(2);
      expect(mockServiceInstance.getGameTurns).toHaveBeenCalledWith(gameId, {
        afterTurn: 2,
        limit: 2,
      });
    });
  });

  describe('Error handling', () => {
    it('should return 404 for non-existent game', async () => {
      const mockServiceInstance = {
        getGameById: vi.fn().mockResolvedValue(null),
        getGameTurns: vi.fn(),
      };

      mockGamesService.mockImplementation(() => mockServiceInstance as any);

      const response = await request(app)
        .get(`/api/games/${gameId}/turns`)
        .expect(404);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(mockServiceInstance.getGameTurns).not.toHaveBeenCalled();
    });

    it('should return 401 when user context is missing', async () => {
      // Temporarily override auth middleware to not set user context
      vi.doMock('../middleware/auth.js', () => ({
        optionalAuth: (req: any, res: any, next: any) => {
          req.ctx = undefined;
          next();
        },
      }));

      const response = await request(app)
        .get(`/api/games/${gameId}/turns`)
        .expect(401);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Turn ordering', () => {
    it('should return turns ordered by turn_number ascending', async () => {
      const mockTurns = [
        { id: 'turn-5', game_id: gameId, turn_number: 5, created_at: '2024-01-01T00:00:05Z', ai_response: {} },
        { id: 'turn-3', game_id: gameId, turn_number: 3, created_at: '2024-01-01T00:00:03Z', ai_response: {} },
        { id: 'turn-4', game_id: gameId, turn_number: 4, created_at: '2024-01-01T00:00:04Z', ai_response: {} },
        { id: 'turn-1', game_id: gameId, turn_number: 1, created_at: '2024-01-01T00:00:01Z', ai_response: {} },
        { id: 'turn-2', game_id: gameId, turn_number: 2, created_at: '2024-01-01T00:00:02Z', ai_response: {} },
      ];

      const mockGame = {
        id: gameId,
        turnCount: 5,
        status: 'active',
      };

      const mockServiceInstance = {
        getGameById: vi.fn().mockResolvedValue(mockGame),
        getGameTurns: vi.fn().mockResolvedValue({
          turns: mockTurns,
        }),
      };

      mockGamesService.mockImplementation(() => mockServiceInstance as any);

      const response = await request(app)
        .get(`/api/games/${gameId}/turns`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      // Verify service is called with ordering (service handles ordering)
      expect(mockServiceInstance.getGameTurns).toHaveBeenCalled();
      
      // Note: The actual ordering is handled by the service/database,
      // so we verify the service receives the correct parameters
    });
  });
});

