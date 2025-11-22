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
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Request body validation schemas
const CastStoneRequestSchema = z.object({
  userText: z.string().min(1, 'User text is required'),
});

const StartSessionRequestSchema = z.object({
  compiledStoryId: z.string().uuid('Invalid compiled story ID'),
});

/**
 * POST /api/chimera/play/:gameStateId/cast
 * Execute the game loop: process player input through MAS1 -> Engine -> MAS2
 */
router.post(
  '/:gameStateId/cast',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { gameStateId } = req.params;
      const validated = CastStoneRequestSchema.parse(req.body);

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
      const gameLoopService = new GameLoopService(storiesRepo);

      const result = await gameLoopService.castStone(gameStateId, validated.userText);

      return sendSuccess(res, result, req);
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
  authenticateToken,
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
