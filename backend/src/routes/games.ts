import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { optionalAuth } from '../middleware/auth.js';
import { requireIdempotencyKey } from '../middleware/validation.js';
import { ApiErrorCode, CreateGameRequestSchema, IdParamSchema, GameTurnRequestSchema } from '@shared';
import { GamesService } from '../services/games.service.js';
import { turnsService } from '../services/turns.service.js';
import { promptsService } from '../services/prompts.service.js';
import { supabaseAdmin } from '../services/supabase.js';
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

    // Allow both authenticated users and guests
    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User context required',
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
    const { optionId, userInput, userInputType } = bodyValidation.data;
    const idempotencyKey = req.headers['idempotency-key'] as string;

    // Execute the turn
    const turnResult = await turnsService.runBufferedTurn({
      gameId,
      optionId,
      owner: userId,
      idempotencyKey,
      isGuest: isGuest || false,
      userInput,
      userInputType,
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

// GET /api/games/:id/turns - get all turns for a game
router.get('/:id/turns', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    const isGuest = req.ctx?.isGuest;

    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User context required',
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

    // Get the game to validate ownership
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

    // Load turns from database
    const turns = await gamesService.getGameTurns(gameId);

    sendSuccess(res, turns, req);
  } catch (error) {
    console.error('Error loading game turns:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

// POST /api/games/:id/auto-initialize - automatically create initial prompt for games with 0 turns
router.post('/:id/auto-initialize', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    const isGuest = req.ctx?.isGuest;

    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User context required',
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

    // Get the game to validate ownership and get world info
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

    // Only auto-initialize games with 0 turns
    if (game.turnCount > 0) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Game has already been initialized',
        req
      );
    }

    // Double-check by querying turns table directly to prevent race conditions
    const { data: existingTurns, error: turnsError } = await supabaseAdmin
      .from('turns')
      .select('id, turn_number, option_id, created_at')
      .eq('game_id', gameId)
      .order('turn_number', { ascending: true });

    if (turnsError) {
      console.error('Error checking existing turns:', turnsError);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to check game state',
        req
      );
    }

    console.log(`[AUTO-INIT] Checking turns for game ${gameId}:`, {
      gameTurnCount: game.turnCount,
      existingTurnsCount: existingTurns?.length || 0,
      existingTurns: existingTurns
    });

    if (existingTurns && existingTurns.length > 0) {
      console.log(`[AUTO-INIT] Game ${gameId} has data inconsistency: game.turnCount=${game.turnCount} but ${existingTurns.length} turns exist`);
      console.log(`[AUTO-INIT] Existing turns:`, existingTurns);
      
      // If game record shows 0 turns but turns exist, this is a data inconsistency
      // We should trust the game record and allow auto-initialization to proceed
      if (game.turnCount === 0) {
        console.log(`[AUTO-INIT] Data inconsistency detected - game record shows 0 turns but ${existingTurns.length} turns exist in database`);
        console.log(`[AUTO-INIT] Cleaning up orphaned turns and proceeding with auto-initialization`);
        
        // Clean up orphaned turns
        const { error: deleteError } = await supabaseAdmin
          .from('turns')
          .delete()
          .eq('game_id', gameId);
          
        if (deleteError) {
          console.error(`[AUTO-INIT] Error cleaning up orphaned turns:`, deleteError);
          // Continue anyway - the applyTurn method will handle duplicates
        } else {
          console.log(`[AUTO-INIT] Successfully cleaned up ${existingTurns.length} orphaned turns`);
        }
        
        // Continue with auto-initialization to fix the inconsistency
      } else {
        console.log(`[AUTO-INIT] Game ${gameId} already has ${existingTurns.length} turns, skipping auto-initialization`);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Game has already been initialized',
          req
        );
      }
    }

    // Create and process initial prompt automatically by submitting a special "game_start" turn
    const idempotencyKey = `auto-init-${gameId}-${Date.now()}`;
    console.log(`[AUTO-INIT] Creating initial prompt for game ${gameId} with optionId: game_start`);
    
    const turnResult = await turnsService.runBufferedTurn({
      gameId,
      optionId: 'game_start', // Special option ID for initial prompts
      owner: userId,
      idempotencyKey,
      isGuest: isGuest || false,
    });
    
    console.log(`[AUTO-INIT] Turn result:`, turnResult);

    if (!turnResult.success) {
      return sendErrorWithStatus(
        res,
        turnResult.error || ApiErrorCode.INTERNAL_ERROR,
        turnResult.message || 'Failed to create initial prompt',
        req,
        turnResult.details // Include full details in error response
      );
    }

    sendSuccess(res, turnResult.turnDTO, req);
  } catch (error) {
    console.error('Error auto-initializing game:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

// POST /api/games/:id/initial-prompt - create initial AI prompt for a new game
router.post('/:id/initial-prompt', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    const isGuest = req.ctx?.isGuest;

    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User context required',
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

    // Get the game to validate ownership and get world info
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

    // Check if game has already been initiated (has turns)
    if (game.turnCount > 0) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Game has already been initiated',
        req
      );
    }

    // Create initial prompt with approval mechanism
    const promptResult = await promptsService.createInitialPromptWithApproval(
      gameId,
      game.worldSlug,
      game.characterId
    );

    sendSuccess(res, promptResult, req);
  } catch (error) {
    console.error('Error creating initial prompt:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

// POST /api/games/:id/approve-prompt - approve a prompt for AI processing
router.post('/:id/approve-prompt', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    const isGuest = req.ctx?.isGuest;

    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User context required',
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

    // Validate request body
    const bodyValidation = z.object({
      promptId: z.string(),
      approved: z.boolean(),
    }).safeParse(req.body);

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
    const { promptId, approved } = bodyValidation.data;

    // Validate game ownership
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

    // Approve the prompt
    const approvalResult = await promptsService.approvePrompt(promptId, approved);

    if (!approvalResult.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        approvalResult.message,
        req
      );
    }

    sendSuccess(res, { message: approvalResult.message }, req);
  } catch (error) {
    console.error('Error approving prompt:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

export default router;