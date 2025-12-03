// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Chimera Game Initialization API Routes
 * Phase 5: Character Creator & Game Initialization
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getChimeraSupabaseClient } from '../db/supabase-client.js';
import { StoriesRepository } from '../db/repos/stories.repo.js';
import { GameInitService } from '../services/game/game-init.service.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared/types/api.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Request body validation schema
const InitializeGameRequestSchema = z.object({
  storyId: z.string().uuid('Invalid story ID'),
  playerInput: z.object({
    identity: z.object({
      name: z.string().min(1, 'Name is required'),
      pronouns: z.string().optional(),
      role: z.string().optional(),
      age: z.number().optional(),
    }),
    appearance: z.record(z.unknown()).optional(),
    backstory: z.string().optional(),
    personality_traits: z.array(z.string()).optional(),
    drive: z.string().optional(),
    flaw: z.string().optional(),
  }).passthrough(), // Allow additional world-specific fields
});

/**
 * POST /api/chimera/game/init
 * Initialize a new game from a compiled story with player character data
 */
router.post(
  '/init',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const validated = InitializeGameRequestSchema.parse(req.body);
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
      const gameInitService = new GameInitService(storiesRepo);

      const gameStateId = await gameInitService.initializeGame(
        validated.storyId,
        validated.playerInput,
        userId
      );

      return sendSuccess(res, { id: gameStateId }, req, 201);
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

      console.error('[Chimera Game Init] Error initializing game:', error);
      
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('not found')) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            error.message,
            req
          );
        }
      }

      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to initialize game',
        req
      );
    }
  }
);

/**
 * GET /api/chimera/stories/:id
 * Get a compiled story by ID
 */
router.get(
  '/stories/:id',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!z.string().uuid().safeParse(id).success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid story ID',
          req
        );
      }

      const supabase = getChimeraSupabaseClient(req);
      const storiesRepo = new StoriesRepository(supabase);

      const compiledStory = await storiesRepo.getCompiledStoryById(id);

      if (!compiledStory) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Compiled story not found',
          req
        );
      }

      return sendSuccess(res, compiledStory, req);
    } catch (error) {
      console.error('[Chimera Game Init] Error fetching compiled story:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to fetch compiled story',
        req
      );
    }
  }
);

export default router;

