// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Chimera Compile API Routes
 * Phase 4: Compiler endpoint for creating CompiledStory records
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getChimeraSupabaseClient } from '../db/supabase-client.js';
import { RulesetsRepository } from '../db/repos/rulesets.repo.js';
import { WorldsRepository } from '../db/repos/worlds.repo.js';
import { EntitiesRepository } from '../db/repos/entities.repo.js';
import { CompiledStoriesRepository } from '../db/repos/compiled-stories.repo.js';
import { CompilerService } from '../services/compile/compiler.service.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared/types/api.js';

const router = Router();

// Request body validation schema
const CompileSelectionSchema = z.object({
  worldId: z.string().uuid(),
  rulesetIds: z.array(z.string()).min(1, 'At least one ruleset is required'),
  entityIds: z.array(z.string().uuid()).default([]),
});

/**
 * POST /api/chimera/compile
 * Compile a story from a selection of world, rulesets, and entities
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validated = CompileSelectionSchema.parse(req.body);

    const supabase = getChimeraSupabaseClient(req);

    // Initialize repositories
    const rulesetsRepo = new RulesetsRepository(supabase);
    const worldsRepo = new WorldsRepository(supabase);
    const entitiesRepo = new EntitiesRepository(supabase);
    const compiledStoriesRepo = new CompiledStoriesRepository(supabase);

    // Initialize compiler service
    const compilerService = new CompilerService(
      rulesetsRepo,
      worldsRepo,
      entitiesRepo,
      compiledStoriesRepo
    );

    // Compile the story
    const compiledStoryId = await compilerService.compile(validated);

    return sendSuccess(res, { id: compiledStoryId }, req, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid compile selection',
        req,
        error.errors
      );
    }

    // Handle specific error cases
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();

      // Map "not found" errors to NOT_FOUND status
      if (errorMessage.includes('not found')) {
        // Extract entity type from error message
        if (errorMessage.includes('world')) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.WORLD_NOT_FOUND,
            error.message,
            req
          );
        }
        if (errorMessage.includes('ruleset')) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.RULESET_NOT_FOUND,
            error.message,
            req
          );
        }
        if (errorMessage.includes('entity')) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            error.message,
            req
          );
        }
        // Generic not found
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          error.message,
          req
        );
      }

      // Handle dependency/exclusion validation errors
      if (errorMessage.includes('depends on') || errorMessage.includes('exclusion')) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          error.message,
          req
        );
      }
    }

    console.error('[Chimera Compile] Error compiling story:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to compile story',
      req
    );
  }
});

/**
 * GET /api/chimera/compile/:storyId
 * Get the latest compiled story for a given Draft Story ID
 */
router.get('/:storyId', async (req: Request, res: Response) => {
  try {
    const { storyId } = req.params;
    const userId = req.ctx?.userId;

    if (!userId) {
      return sendErrorWithStatus(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', req);
    }

    const supabase = getChimeraSupabaseClient(req);
    const compiledStoriesRepo = new CompiledStoriesRepository(supabase);

    // TODO: strictly we should check chimera_stories ownership here first
    // For now, we rely on the repo finding the story by ID.
    // Ideally we join or do a separate check.
    // Let's do a quick check on chimera_stories to ensure user access
    const { data: story, error: storyError } = await supabase
      .from('chimera_stories')
      .select('owner_user_id, visibility')
      .eq('id', storyId)
      .single();

    if (storyError || !story) {
      return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'Story not found', req);
    }

    if (story.owner_user_id !== userId && story.visibility !== 'public') {
      return sendErrorWithStatus(res, ApiErrorCode.FORBIDDEN, 'Access denied', req);
    }

    // specific method to find by Draft ID (key)
    const compiledStory = await compiledStoriesRepo.findByKey(storyId);

    if (!compiledStory) {
      return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'Compiled story not found. Please compile the story first.', req);
    }

    return sendSuccess(res, compiledStory, req);
  } catch (error) {
    console.error('[Chimera Compile] Error fetching compiled story:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to fetch compiled story',
      req
    );
  }
});

export default router;

