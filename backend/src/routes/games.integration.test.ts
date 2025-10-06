import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { supabaseAdmin } from '../services/supabase.js';
import { GamesService } from '../services/games.service.js';
import { CharactersService } from '../services/characters.service.js';
import { ApiErrorCode } from '@shared';

// Mock dependencies
vi.mock('../services/supabase.js');
vi.mock('../services/games.service.js');
vi.mock('../services/characters.service.js');

const mockSupabaseAdmin = vi.mocked(supabaseAdmin);
const mockGamesService = vi.mocked(GamesService);
const mockCharactersService = vi.mocked(CharactersService);

describe('Games API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/games', () => {
    it('should spawn a game successfully for authenticated user', async () => {
      const mockGameDTO = {
        id: 'game-123',
        adventureId: 'adventure-123',
        adventureTitle: 'The Mystika Tutorial',
        adventureDescription: 'Learn the basics of magic',
        characterId: 'character-123',
        characterName: 'Test Hero',
        worldSlug: 'mystika',
        worldName: 'Mystika',
        turnCount: 0,
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        lastPlayedAt: '2024-01-01T00:00:00Z',
      };

      const mockSpawnResult = {
        success: true,
        game: mockGameDTO
      };

      // Mock the games service
      const mockSpawn = vi.fn().mockResolvedValue(mockSpawnResult);
      mockGamesService.prototype.spawn = mockSpawn;

      const response = await request(app)
        .post('/api/games')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          adventureSlug: 'mystika-tutorial',
          characterId: 'character-123'
        });

      expect(response.status).toBe(201);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toEqual(mockGameDTO);
      expect(response.body.meta.traceId).toBeDefined();

      expect(mockSpawn).toHaveBeenCalledWith({
        adventureSlug: 'mystika-tutorial',
        characterId: 'character-123',
        ownerId: expect.any(String),
        isGuest: false
      });
    });

    it('should spawn a game successfully for guest user', async () => {
      const mockGameDTO = {
        id: 'game-123',
        adventureId: 'adventure-123',
        adventureTitle: 'The Mystika Tutorial',
        adventureDescription: 'Learn the basics of magic',
        characterId: 'character-123',
        characterName: 'Test Hero',
        worldSlug: 'mystika',
        worldName: 'Mystika',
        turnCount: 0,
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        lastPlayedAt: '2024-01-01T00:00:00Z',
      };

      const mockSpawnResult = {
        success: true,
        game: mockGameDTO
      };

      // Mock the games service
      const mockSpawn = vi.fn().mockResolvedValue(mockSpawnResult);
      mockGamesService.prototype.spawn = mockSpawn;

      const response = await request(app)
        .post('/api/games')
        .set('Cookie', 'guest-cookie-id=guest-123')
        .send({
          adventureSlug: 'mystika-tutorial',
          characterId: 'character-123'
        });

      expect(response.status).toBe(201);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toEqual(mockGameDTO);

      expect(mockSpawn).toHaveBeenCalledWith({
        adventureSlug: 'mystika-tutorial',
        characterId: 'character-123',
        ownerId: expect.any(String),
        isGuest: true
      });
    });

    it('should return 422 for invalid request data', async () => {
      const response = await request(app)
        .post('/api/games')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          adventureSlug: '', // Invalid empty string
          characterId: 'invalid-uuid'
        });

      expect(response.status).toBe(422);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.VALIDATION_FAILED);
      expect(response.body.error.message).toBe('Invalid request data');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .post('/api/games')
        .send({
          adventureSlug: 'mystika-tutorial',
          characterId: 'character-123'
        });

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.UNAUTHORIZED);
    });

    it('should return 404 when adventure not found', async () => {
      const mockSpawnResult = {
        success: false,
        error: ApiErrorCode.NOT_FOUND,
        message: 'Adventure not found'
      };

      // Mock the games service
      const mockSpawn = vi.fn().mockResolvedValue(mockSpawnResult);
      mockGamesService.prototype.spawn = mockSpawn;

      const response = await request(app)
        .post('/api/games')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          adventureSlug: 'nonexistent-adventure',
          characterId: 'character-123'
        });

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.NOT_FOUND);
    });

    it('should return 409 when character is already active', async () => {
      const mockSpawnResult = {
        success: false,
        error: ApiErrorCode.CONFLICT,
        message: 'Character is already active in another game'
      };

      // Mock the games service
      const mockSpawn = vi.fn().mockResolvedValue(mockSpawnResult);
      mockGamesService.prototype.spawn = mockSpawn;

      const response = await request(app)
        .post('/api/games')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          adventureSlug: 'mystika-tutorial',
          characterId: 'character-123'
        });

      expect(response.status).toBe(409);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.CONFLICT);
    });
  });

  describe('GET /api/games/:id', () => {
    it('should return game DTO for authenticated user', async () => {
      const mockGameDTO = {
        id: 'game-123',
        adventureId: 'adventure-123',
        adventureTitle: 'The Mystika Tutorial',
        adventureDescription: 'Learn the basics of magic',
        characterId: 'character-123',
        characterName: 'Test Hero',
        worldSlug: 'mystika',
        worldName: 'Mystika',
        turnCount: 5,
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        lastPlayedAt: '2024-01-01T00:00:00Z',
      };

      // Mock the games service
      const mockGetGameById = vi.fn().mockResolvedValue(mockGameDTO);
      mockGamesService.prototype.getGameById = mockGetGameById;

      const response = await request(app)
        .get('/api/games/game-123')
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toEqual(mockGameDTO);
      expect(response.body.meta.traceId).toBeDefined();

      expect(mockGetGameById).toHaveBeenCalledWith('game-123', expect.any(String), false);
    });

    it('should return 404 when game not found', async () => {
      // Mock the games service
      const mockGetGameById = vi.fn().mockResolvedValue(null);
      mockGamesService.prototype.getGameById = mockGetGameById;

      const response = await request(app)
        .get('/api/games/nonexistent-game')
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.NOT_FOUND);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/games/game-123');

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.UNAUTHORIZED);
    });

    it('should return 422 for invalid game ID', async () => {
      const response = await request(app)
        .get('/api/games/invalid-uuid')
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(response.status).toBe(422);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.VALIDATION_FAILED);
    });
  });

  describe('GET /api/games', () => {
    it('should return games list for authenticated user', async () => {
      const mockGamesList = [
        {
          id: 'game-123',
          adventureTitle: 'The Mystika Tutorial',
          characterName: 'Test Hero',
          worldName: 'Mystika',
          turnCount: 5,
          status: 'active',
          lastPlayedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'game-456',
          adventureTitle: 'Forest of Whispers',
          characterName: 'Another Hero',
          worldName: 'Mystika',
          turnCount: 10,
          status: 'completed',
          lastPlayedAt: '2024-01-02T00:00:00Z',
        }
      ];

      // Mock the games service
      const mockGetGames = vi.fn().mockResolvedValue(mockGamesList);
      mockGamesService.prototype.getGames = mockGetGames;

      const response = await request(app)
        .get('/api/games')
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toEqual(mockGamesList);
      expect(response.body.meta.traceId).toBeDefined();

      expect(mockGetGames).toHaveBeenCalledWith(expect.any(String), false, 20, 0);
    });

    it('should return games list with custom pagination', async () => {
      const mockGamesList = [
        {
          id: 'game-123',
          adventureTitle: 'The Mystika Tutorial',
          characterName: 'Test Hero',
          worldName: 'Mystika',
          turnCount: 5,
          status: 'active',
          lastPlayedAt: '2024-01-01T00:00:00Z',
        }
      ];

      // Mock the games service
      const mockGetGames = vi.fn().mockResolvedValue(mockGamesList);
      mockGamesService.prototype.getGames = mockGetGames;

      const response = await request(app)
        .get('/api/games?limit=10&offset=20')
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toEqual(mockGamesList);

      expect(mockGetGames).toHaveBeenCalledWith(expect.any(String), false, 10, 20);
    });

    it('should return empty array when no games found', async () => {
      // Mock the games service
      const mockGetGames = vi.fn().mockResolvedValue([]);
      mockGamesService.prototype.getGames = mockGetGames;

      const response = await request(app)
        .get('/api/games')
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/games');

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.UNAUTHORIZED);
    });
  });
});
