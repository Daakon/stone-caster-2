// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Chimera Play API Routes
 * Handles game loop execution and session initialization
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getChimeraSupabaseClient } from '../db/supabase-client.js';
import { StoriesRepository } from '../db/repos/stories.repo.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared/types/api';
import { requireAuth } from '../middleware/auth.unified.js';
import { resolveLlmRoleConfig } from '../config/llm-config.js';

const router = Router();

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
      if (resolveLlmRoleConfig('director').provider === 'mock') {
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
 * Retired because this route cannot identify and pin a player-owned character.
 */
router.post(
  '/start',
  requireAuth,
  (req: Request, res: Response) => res.status(410).json({
    error: 'Use POST /api/chimera/game/init with a frozen compiled story and player-owned character.',
  })
);

export default router;
