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
import { isMockAiEnabled } from '../config/ai-flags.js';

const router = Router();

// Request body validation schemas
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

      // Mock mode: seed the scripted scenario chips so they're available on
      // first load, before any Director call has populated action_queue
      if (isMockAiEnabled()) {
        gameState.action_queue = [
            "test_combat", "test_social", "test_mixed", "test_travel",
            "test_drunk_combat", "test_protective_combat"
        ];
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

// NOTE: turn submission lives at POST /api/games/:gameId/turn
// (active-game.controller.ts) — the /cast-stone route was an orphaned
// duplicate pipeline and has been removed.

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
