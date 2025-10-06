import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { optionalAuth } from '../middleware/auth.js';
import { requireIdempotencyKey } from '../middleware/validation.js';
import { ApiErrorCode, CreateGameRequestSchema, IdParamSchema, GameTurnRequestSchema } from '@shared';
import { GamesService } from '../services/games.service.js';
import { turnsService } from '../services/turns.service.js';
import { z } from 'zod';

const router = Router();

// POST /api/games - spawn a new game
router.post('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    let userId = req.ctx?.userId;
    let isGuest = req.ctx?.isGuest;

    // If no user context, create a guest user
    if (!userId) {
      // Generate a new guest ID
      const { v4: uuidv4 } = await import('uuid');
      userId = uuidv4();
      isGuest = true;
      
      // Set the guest cookie in the response
      res.cookie('guestId', userId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      });
    }

    // Validate request body
    const validationResult = CreateGameRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid request data',
        req,
        validationResult.error.errors
      );
    }

    const { adventureSlug, characterId } = validationResult.data;

    // Spawn the game
    const gamesService = new GamesService();
    const spawnResult = await gamesService.spawn({
      adventureSlug,
      characterId,
      ownerId: userId,
      isGuest: isGuest || false,
    });

    if (!spawnResult.success) {
      return sendErrorWithStatus(
        res,
        spawnResult.error || ApiErrorCode.INTERNAL_ERROR,
        spawnResult.message || 'Failed to spawn game',
        req
      );
    }

    sendSuccess(res, spawnResult.game, req, 201);
  } catch (error) {
    console.error('Error spawning game:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

// GET /api/games/:id - fetch a single game
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    const isGuest = req.ctx?.isGuest;

    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required',
        req
      );
    }

    // Validate game ID parameter
    const paramValidation = IdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid game ID',
        req,
        paramValidation.error.errors
      );
    }

    const { id: gameId } = paramValidation.data;

    // Get the game
    const gamesService = new GamesService();
    const game = await gamesService.getGameById(gameId, userId, isGuest || false);

    if (!game) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Game not found',
        req
      );
    }

    sendSuccess(res, game, req);
  } catch (error) {
    console.error('Error fetching game:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

// GET /api/games - list user's games (authenticated only)
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    const isGuest = req.ctx?.isGuest;

    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required',
        req
      );
    }

    // Parse query parameters
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    // Get games list
    const gamesService = new GamesService();
    const games = await gamesService.getGames(userId, isGuest || false, limit, offset);

    sendSuccess(res, games, req);
  } catch (error) {
    console.error('Error fetching games list:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

// POST /api/games/:id/turn - take a turn in a game
router.post('/:id/turn', optionalAuth, requireIdempotencyKey, async (req: Request, res: Response) => {
  try {
    let userId = req.ctx?.userId;
    let isGuest = req.ctx?.isGuest;

    // If no user context, create a guest user
    if (!userId) {
      // Generate a new guest ID
      const { v4: uuidv4 } = await import('uuid');
      userId = uuidv4();
      isGuest = true;
      
      // Set the guest cookie in the response
      res.cookie('guestId', userId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      });
    }

    // Validate game ID parameter
    const paramValidation = IdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid game ID',
        req,
        paramValidation.error.errors
      );
    }

    // Validate request body
    const bodyValidation = GameTurnRequestSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid request data',
        req,
        bodyValidation.error.errors
      );
    }

    const { id: gameId } = paramValidation.data;
    const { optionId } = bodyValidation.data;
    const idempotencyKey = req.headers['idempotency-key'] as string;

    // Execute the turn
    const turnResult = await turnsService.runBufferedTurn({
      gameId,
      optionId,
      owner: userId,
      idempotencyKey,
      isGuest: isGuest || false,
    });

    if (!turnResult.success) {
      return sendErrorWithStatus(
        res,
        turnResult.error || ApiErrorCode.INTERNAL_ERROR,
        turnResult.message || 'Failed to execute turn',
        req
      );
    }

    sendSuccess(res, turnResult.turnDTO, req);
  } catch (error) {
    console.error('Error executing turn:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

export default router;