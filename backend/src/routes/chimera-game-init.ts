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

// Validation schema for GET /validate
const ValidateSessionSchema = z.object({
  storyId: z.string().uuid('Invalid story ID'),
});

/**
 * GET /api/chimera/game/init/validate
 * Validate session integrity and determine status (ready vs needs_genesis)
 */
router.get(
  '/validate',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const storyId = req.query.storyId as string;

      // Manual validation since it's a query param
      if (!storyId || !z.string().uuid().safeParse(storyId).success) {
        return sendErrorWithStatus(res, ApiErrorCode.VALIDATION_FAILED, 'Invalid story ID', req);
      }

      const userId = (req as any).user?.id;
      if (!userId) {
        return sendErrorWithStatus(res, ApiErrorCode.UNAUTHORIZED, 'User ID missing', req);
      }

      const supabase = getChimeraSupabaseClient(req);

      // 1. Load Context (Story + World)
      const { data: story, error: sErr } = await supabase
        .from('chimera_stories')
        .select('*, world:chimera_worlds(*)')
        .eq('id', storyId)
        .single();

      if (sErr || !story) {
        return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, sErr?.message || 'Story not found', req);
      }

      const world = (story as any).world;
      if (!world) {
        return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'Linked World not found', req);
      }

      // 2. Load Actor (Player Character)
      const protagonistId = story.protagonist_id;
      if (!protagonistId) {
        // Return explicit error status via JSON, or HTTP 400?
        // User validator returned { status: 'error', error: ... }
        // We'll return 200 OK with status: 'error' to match expected logic, or stricter 400.
        // Let's stick to standard API response: Success=true, Data={ status: 'error', error: ...}
        return sendSuccess(res, {
          status: 'error',
          error: 'Player Character missing. Please create one.',
          context: { story: { id: story.id, title: story.title }, world: { id: world.id, name: world.name } }
        }, req);
      }

      const { data: player, error: pErr } = await supabase
        .from('chimera_player_characters')
        .select('*')
        .eq('id', protagonistId)
        .single();

      if (pErr || !player) {
        return sendSuccess(res, {
          status: 'error',
          error: 'Player Character record not found.',
          context: { story: { id: story.id, title: story.title }, world: { id: world.id, name: world.name } }
        }, req);
      }

      // 3. Check for Active Game State (instead of chimera_turns)
      // If we have an active game state, we are "ready".
      const { count } = await supabase
        .from('chimera_active_games') // or chimera_game_states if legacy
        .select('*', { count: 'exact', head: true })
        .eq('story_id', storyId)
        .eq('player_id', userId); // Ensure it's THEIR game

      // If count > 0, we are ready.
      // If count == 0, check chimera_game_states (backend persistence table) just in case
      // Note: `supabase-state.repository` writes to `chimera_game_states`.
      // Let's check `chimera_game_states` as primary.
      const { count: stateCount } = await supabase
        .from('chimera_game_states')
        .select('*', { count: 'exact', head: true })
        .eq('story_id', storyId)
        .eq('player_id', userId);

      const status = (stateCount && stateCount > 0) ? 'ready' : 'needs_genesis';

      const context = {
        story: { id: story.id, title: story.title, world_id: story.world_id },
        world: { id: world.id, name: world.name || world.title },
        player: { id: player.id, name: player.name }
      };

      return sendSuccess(res, { status, context }, req);

    } catch (error) {
      console.error('[Session Verify] Error:', error);
      return sendErrorWithStatus(res, ApiErrorCode.INTERNAL_ERROR, 'Validation failed', req);
    }
  }
);
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

