// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Chimera Play API Routes
 * Handles game loop execution and session initialization
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getChimeraSupabaseClient } from '../db/supabase-client.js';
import { GameLoopService } from '../services/runtime/game-loop.service.js';
import { StoriesRepository } from '../db/repos/stories.repo.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared/types/api';
import { requireAuth } from '../middleware/auth.unified.js';

const router = Router();

// Request body validation schemas
// Request body validation schemas
const CastStoneRequestSchema = z.object({
  text_input: z.string().min(1, 'User text is required'),
});

const StartSessionRequestSchema = z.object({
  compiledStoryId: z.string().uuid('Invalid compiled story ID'),
});

/**
 * GET /api/chimera/play/:gameStateId
 * Get the current game state
 */
router.get(
  '/:gameStateId',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { gameStateId } = req.params;

      if (!gameStateId || !z.string().uuid().safeParse(gameStateId).success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid game state ID',
          req
        );
      }

      const supabase = getChimeraSupabaseClient(req);
      const storiesRepo = new StoriesRepository(supabase);

      const gameState = await storiesRepo.loadGameState(gameStateId);

      if (!gameState) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Game state not found',
          req
        );
      }

      return sendSuccess(res, gameState, req);
    } catch (error) {
      console.error('[Chimera Play] Error loading game state:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to load game state',
        req
      );
    }
  }
);

/**
 * POST /api/chimera/play/:gameStateId/cast-stone
 * Execute the game loop: process player input through GameTurnService (Mock/Prod)
 */
router.post(
  '/:gameStateId/cast-stone',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { gameStateId } = req.params;
      const validated = CastStoneRequestSchema.parse(req.body);
      const userId = (req as any).user?.id;

      if (!gameStateId || !z.string().uuid().safeParse(gameStateId).success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid game state ID',
          req
        );
      }

      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'User ID not found in request',
          req
        );
      }

      const supabase = getChimeraSupabaseClient(req);
      // Use the GameTurnService that implements the Mock Router logic
      const { GameTurnService } = await import('../services/game/game-turn.service.js');
      const gameTurnService = new GameTurnService(supabase);

      const result = await gameTurnService.processTurn(gameStateId, validated.text_input, userId);

      // Map TurnResult to CastStoneResponse expected by frontend
      const responseHelper = {
        ripple_narrative: result.output || '',
        debug_info: {
          // Mock debug info to satisfy the type
          mas_1_input: validated.text_input,
          mas_1_output: {
            actionDto: { action: 'mock_action' },
            resolvedQuery: 'mock_query',
            detectedSentiment: { tone: 'neutral', intensity: 0.5 }
          },
          engine_outcome: {
            success: result.success,
            message: result.message
          },
          mas_2_response: {
            ripple_narrative: result.output || '',
            mutations: []
          },
          final_mutations: []
        }
      };

      return sendSuccess(res, responseHelper, req);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid request body',
          req,
          error.errors
        );
      }

      console.error('[Chimera Play] Error casting stone:', error);
      const apiErrorCode = (error instanceof Error && (error.cause as ApiErrorCode)) || ApiErrorCode.INTERNAL_ERROR;

      return sendErrorWithStatus(
        res,
        apiErrorCode,
        error instanceof Error ? error.message : 'Failed to cast stone',
        req
      );
    }
  }
);

/**
 * POST /api/chimera/play/start
 * Initialize a new game session from a compiled story
 */
router.post(
  '/start',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const validated = StartSessionRequestSchema.parse(req.body);
      const userId = (req as any).user?.id;

      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'User ID not found in request',
          req
        );
      }

      const supabase = getChimeraSupabaseClient(req);
      const storiesRepo = new StoriesRepository(supabase);
      const gameLoopService = new GameLoopService(storiesRepo);

      const gameStateId = await gameLoopService.initializeSession(validated.compiledStoryId, userId);

      return sendSuccess(res, { gameStateId }, req, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid request body',
          req,
          error.errors
        );
      }

      console.error('[Chimera Play] Error starting session:', error);
      const apiErrorCode = (error instanceof Error && (error.cause as ApiErrorCode)) || ApiErrorCode.INTERNAL_ERROR;

      return sendErrorWithStatus(
        res,
        apiErrorCode,
        error instanceof Error ? error.message : 'Failed to start session',
        req
      );
    }
  }
);

export default router;
