import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { turnsService } from '../services/turns.service.js';
import { ApiErrorCode } from 'shared';
import gamesRouter from './games.js';

// Mock the turns service
vi.mock('../services/turns.service.js');

describe('POST /api/games/:id/turn', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/games', gamesRouter);

  const mockTurnsService = vi.mocked(turnsService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/games/game-123/turn')
        .set('Idempotency-Key', 'test-key-123')
        .send({ optionId: 'option-456' });

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.UNAUTHORIZED);
    });
  });

  describe('Validation', () => {
    it('should require Idempotency-Key header', async () => {
      const response = await request(app)
        .post('/api/games/game-123/turn')
        .set('Authorization', 'Bearer test-token')
        .send({ optionId: 'option-456' });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.IDEMPOTENCY_REQUIRED);
    });

    it('should validate game ID format', async () => {
      const response = await request(app)
        .post('/api/games/invalid-id/turn')
        .set('Authorization', 'Bearer test-token')
        .set('Idempotency-Key', 'test-key-123')
        .send({ optionId: 'option-456' });

      expect(response.status).toBe(422);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.VALIDATION_FAILED);
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/games/game-123/turn')
        .set('Authorization', 'Bearer test-token')
        .set('Idempotency-Key', 'test-key-123')
        .send({ invalidField: 'test' });

      expect(response.status).toBe(422);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.VALIDATION_FAILED);
    });

    it('should validate optionId format', async () => {
      const response = await request(app)
        .post('/api/games/game-123/turn')
        .set('Authorization', 'Bearer test-token')
        .set('Idempotency-Key', 'test-key-123')
        .send({ optionId: 'invalid-uuid' });

      expect(response.status).toBe(422);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.VALIDATION_FAILED);
    });
  });

  describe('Turn Execution', () => {
    const validRequest = {
      gameId: '550e8400-e29b-41d4-a716-446655440000',
      optionId: '550e8400-e29b-41d4-a716-446655440001',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440002'
    };

    it('should execute turn successfully', async () => {
      const mockTurnDTO = {
        id: 'turn-123',
        gameId: validRequest.gameId,
        turnCount: 6,
        narrative: 'You continue your journey...',
        emotion: 'neutral' as const,
        choices: [
          { id: 'choice-1', label: 'Go left', description: 'Take the left path' },
          { id: 'choice-2', label: 'Go right', description: 'Take the right path' }
        ],
        castingStonesBalance: 8,
        createdAt: '2024-01-01T00:00:00Z'
      };

      mockTurnsService.runBufferedTurn.mockResolvedValue({
        success: true,
        turnDTO: mockTurnDTO
      });

      const response = await request(app)
        .post(`/api/games/${validRequest.gameId}/turn`)
        .set('Authorization', 'Bearer test-token')
        .set('Idempotency-Key', validRequest.idempotencyKey)
        .send({ optionId: validRequest.optionId });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toEqual(mockTurnDTO);
      expect(response.body.meta.traceId).toBeDefined();

      expect(mockTurnsService.runBufferedTurn).toHaveBeenCalledWith({
        gameId: validRequest.gameId,
        optionId: validRequest.optionId,
        owner: 'user-123', // Mocked user ID from auth middleware
        idempotencyKey: validRequest.idempotencyKey
      });
    });

    it('should handle insufficient stones error', async () => {
      mockTurnsService.runBufferedTurn.mockResolvedValue({
        success: false,
        error: ApiErrorCode.INSUFFICIENT_STONES,
        message: 'Insufficient casting stones. Have 1, need 2'
      });

      const response = await request(app)
        .post(`/api/games/${validRequest.gameId}/turn`)
        .set('Authorization', 'Bearer test-token')
        .set('Idempotency-Key', validRequest.idempotencyKey)
        .send({ optionId: validRequest.optionId });

      expect(response.status).toBe(402);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.INSUFFICIENT_STONES);
      expect(response.body.error.message).toBe('Insufficient casting stones. Have 1, need 2');
    });

    it('should handle game not found error', async () => {
      mockTurnsService.runBufferedTurn.mockResolvedValue({
        success: false,
        error: ApiErrorCode.NOT_FOUND,
        message: 'Game not found'
      });

      const response = await request(app)
        .post(`/api/games/${validRequest.gameId}/turn`)
        .set('Authorization', 'Bearer test-token')
        .set('Idempotency-Key', validRequest.idempotencyKey)
        .send({ optionId: validRequest.optionId });

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.NOT_FOUND);
      expect(response.body.error.message).toBe('Game not found');
    });

    it('should handle AI validation error', async () => {
      mockTurnsService.runBufferedTurn.mockResolvedValue({
        success: false,
        error: ApiErrorCode.VALIDATION_FAILED,
        message: 'AI response validation failed'
      });

      const response = await request(app)
        .post(`/api/games/${validRequest.gameId}/turn`)
        .set('Authorization', 'Bearer test-token')
        .set('Idempotency-Key', validRequest.idempotencyKey)
        .send({ optionId: validRequest.optionId });

      expect(response.status).toBe(422);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.VALIDATION_FAILED);
      expect(response.body.error.message).toBe('AI response validation failed');
    });

    it('should handle AI timeout error', async () => {
      mockTurnsService.runBufferedTurn.mockResolvedValue({
        success: false,
        error: ApiErrorCode.UPSTREAM_TIMEOUT,
        message: 'AI service timeout'
      });

      const response = await request(app)
        .post(`/api/games/${validRequest.gameId}/turn`)
        .set('Authorization', 'Bearer test-token')
        .set('Idempotency-Key', validRequest.idempotencyKey)
        .send({ optionId: validRequest.optionId });

      expect(response.status).toBe(504);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.UPSTREAM_TIMEOUT);
      expect(response.body.error.message).toBe('AI service timeout');
    });

    it('should handle internal server error', async () => {
      mockTurnsService.runBufferedTurn.mockResolvedValue({
        success: false,
        error: ApiErrorCode.INTERNAL_ERROR,
        message: 'Internal server error'
      });

      const response = await request(app)
        .post(`/api/games/${validRequest.gameId}/turn`)
        .set('Authorization', 'Bearer test-token')
        .set('Idempotency-Key', validRequest.idempotencyKey)
        .send({ optionId: validRequest.optionId });

      expect(response.status).toBe(500);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.INTERNAL_ERROR);
      expect(response.body.error.message).toBe('Internal server error');
    });

    it('should handle unexpected service errors', async () => {
      mockTurnsService.runBufferedTurn.mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app)
        .post(`/api/games/${validRequest.gameId}/turn`)
        .set('Authorization', 'Bearer test-token')
        .set('Idempotency-Key', validRequest.idempotencyKey)
        .send({ optionId: validRequest.optionId });

      expect(response.status).toBe(500);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.INTERNAL_ERROR);
      expect(response.body.error.message).toBe('Internal server error');
    });
  });

  describe('Idempotency', () => {
    const validRequest = {
      gameId: '550e8400-e29b-41d4-a716-446655440000',
      optionId: '550e8400-e29b-41d4-a716-446655440001',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440002'
    };

    it('should return same response for duplicate idempotency key', async () => {
      const mockTurnDTO = {
        id: 'turn-123',
        gameId: validRequest.gameId,
        turnCount: 6,
        narrative: 'You continue your journey...',
        emotion: 'neutral' as const,
        choices: [],
        castingStonesBalance: 8,
        createdAt: '2024-01-01T00:00:00Z'
      };

      // First request
      mockTurnsService.runBufferedTurn.mockResolvedValueOnce({
        success: true,
        turnDTO: mockTurnDTO
      });

      const response1 = await request(app)
        .post(`/api/games/${validRequest.gameId}/turn`)
        .set('Authorization', 'Bearer test-token')
        .set('Idempotency-Key', validRequest.idempotencyKey)
        .send({ optionId: validRequest.optionId });

      expect(response1.status).toBe(200);
      expect(response1.body.data).toEqual(mockTurnDTO);

      // Second request with same idempotency key
      mockTurnsService.runBufferedTurn.mockResolvedValueOnce({
        success: true,
        turnDTO: mockTurnDTO // Same response
      });

      const response2 = await request(app)
        .post(`/api/games/${validRequest.gameId}/turn`)
        .set('Authorization', 'Bearer test-token')
        .set('Idempotency-Key', validRequest.idempotencyKey)
        .send({ optionId: validRequest.optionId });

      expect(response2.status).toBe(200);
      expect(response2.body.data).toEqual(mockTurnDTO);
    });
  });
});
