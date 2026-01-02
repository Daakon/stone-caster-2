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
import { ApiErrorCode } from '@shared';
import { requireAuth } from '../middleware/auth.unified.js';
import { SupabaseGameStateRepository } from '../services/game/supabase-state.repository.js';

const router = Router();

// Request body validation schema
const InitializeGameRequestSchema = z.object({
  storyId: z.string().uuid('Invalid story ID'),
  characterId: z.string().uuid().optional(), // Allow passing explicit character ID
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
  requireAuth,
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
      const stateRepo = new SupabaseGameStateRepository(supabase);
      const gameInitService = new GameInitService(storiesRepo, stateRepo);

      const gameStateId = await gameInitService.initializeGame(
        validated.storyId,
        validated.playerInput,
        userId,
        validated.characterId
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
 * GET /api/chimera/game/premades
 * Get a list of premade characters for quick start
 */
router.get(
  '/premades',
  async (req: Request, res: Response) => {
    try {
      const supabase = getChimeraSupabaseClient(req);

      const { data: premades, error } = await supabase
        .from('premade_characters')
        .select('*')
        .order('sort_order', { ascending: true })
        .limit(20);

      if (error) {
        // If table doesn't exist or other error, return empty list gracefully to fall back to frontend defaults
        console.warn('[Chimera Game Init] Failed to fetch premades (returning empty):', error.message);
        return sendSuccess(res, [], req);
      }

      return sendSuccess(res, premades || [], req);
    } catch (error) {
      console.error('[Chimera Game Init] Unexpected error fetching premades:', error);
      return sendSuccess(res, [], req); // Fail gracefully
    }
  }
);

/**
 * GET /api/chimera/stories/:id
 * Get a compiled story by ID
 */
router.get(
  '/stories/:id',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Allow any string ID/Key, validation happens via lookup
      if (!id || typeof id !== 'string') {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid story ID',
          req
        );
      }

      const supabase = getChimeraSupabaseClient(req);
      const storiesRepo = new StoriesRepository(supabase);

      let compiledStory = await storiesRepo.getCompiledStory(id);

      // If not found by key, and it's a valid UUID, try by ID
      if (!compiledStory && z.string().uuid().safeParse(id).success) {
        compiledStory = await storiesRepo.getCompiledStoryById(id);
      }

      // If still not found, try by Draft Story ID (most likely case from frontend URL)
      if (!compiledStory && z.string().uuid().safeParse(id).success) {
        compiledStory = await storiesRepo.getCompiledStoryByDraftId(id);
      }

      if (!compiledStory) {
        // Check if it exists as a draft to give a better error message
        const { data: draft } = await supabase
          .from('chimera_stories')
          .select('id')
          .or(`id.eq.${id},key.eq.${id}`)
          .maybeSingle();

        if (draft) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Story exists as a draft but has not been compiled. Please compile it in the Story Editor.',
            req
          );
        }

        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Story not found.',
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

