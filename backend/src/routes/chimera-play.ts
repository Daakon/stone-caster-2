/**
 * @swagger
 * tags:
 *   - name: Chimera V2 Play
 *     description: Play engine endpoints for starting and managing game sessions
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { supabaseAdmin } from '../services/supabase.js';
import { createInitialState } from '../services/play/state-factory.js';
import type { CompiledStoryJson } from '../services/chimera/rebuild-service.js';
import { parseAction } from '../services/play/action-parser.js';
import { resolveAction } from '../services/play/action-resolver.js';
import { generateNarrative } from '../services/play/mas-context-provider.js';
import { validateMutations } from '../services/play/mutation-validator.js';
import { processEngineRequests } from '../services/play/engine-request-processor.js';
import { applyMutations } from '../services/play/mutation-applier.js';
import type { ChimeraGameState } from '../services/play/state-factory.js';
import type { GameStateTiers } from '../services/play/action-parser.js';
import type { Mas1ResponseDto } from '../services/play/action-parser.js';
import type { Mas2ResponseDto } from '../services/play/mas-context-provider.js';
import type { MutationDto } from '../services/play/action-resolver.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Custom schema for text-based IDs (not UUIDs)
const TextIdParamSchema = z.object({
  storyId: z.string().min(1).max(200),
});

// Schema for UUID game state ID
const GameStateIdParamSchema = z.object({
  gameStateId: z.string().uuid(),
});

// Schema for cast-stone request body
const CastStoneBodySchema = z.object({
  text_input: z.string().min(1).max(5000),
});

// Schema for character finalization request body
const FinalizeCharacterBodySchema = z.object({
  character_data: z.record(z.unknown()),
});

/**
 * GET /api/v2/play/:gameStateId
 * Get a game state by ID
 * 
 * Requires:
 * - Authenticated user
 * - Game state must exist and belong to user
 */
router.get(
  '/:gameStateId',
  validateRequest(GameStateIdParamSchema, 'params'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.ctx?.userId;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { gameStateId } = req.params;

      const { data: gameState, error: gameStateError } = await supabaseAdmin
        .from('chimera_game_states')
        .select('*')
        .eq('id', gameStateId)
        .single();

      if (gameStateError) {
        if (gameStateError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Game state not found',
            req
          );
        }
        console.error('[Chimera Play] Error fetching game state:', gameStateError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch game state',
          req
        );
      }

      // Verify ownership
      if (gameState.user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'You do not have permission to access this game state',
          req
        );
      }

      return res.status(200).json({
        ok: true,
        data: gameState,
      });
    } catch (error) {
      console.error('[Chimera Play] Unexpected error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Internal server error',
        req
      );
    }
  }
);

/**
 * POST /api/v2/play/:storyId/start
 * Start a new game session (Story Space) for a story
 * 
 * Requires:
 * - Authenticated user
 * - Story must exist and have a compiled ruleset
 */
router.post(
  '/:storyId/start',
  validateRequest(TextIdParamSchema, 'params'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.ctx?.userId;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { storyId } = req.params;

      // Step 1: Verify story exists
      const { data: story, error: storyError } = await supabaseAdmin
        .from('chimera_stories')
        .select('id, visibility')
        .eq('id', storyId)
        .single();

      if (storyError) {
        if (storyError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Story not found',
            req
          );
        }
        console.error('[Chimera Play] Error fetching story:', storyError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch story',
          req
        );
      }

      // Step 2: Fetch the compiled story JSON
      const { data: compiledRuleset, error: compiledError } = await supabaseAdmin
        .from('chimera_story_compiled_ruleset')
        .select('compiled_json')
        .eq('story_id', storyId)
        .single();

      if (compiledError) {
        if (compiledError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.VALIDATION_FAILED,
            'Story has not been compiled yet. Please rebuild the story first.',
            req
          );
        }
        console.error('[Chimera Play] Error fetching compiled ruleset:', compiledError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch compiled story',
          req
        );
      }

      if (!compiledRuleset?.compiled_json) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Story has not been compiled yet. Please rebuild the story first.',
          req
        );
      }

      const compiledStory = compiledRuleset.compiled_json as CompiledStoryJson;

      // Step 3: Security Gate - Explicit COUNT Check
      // Query counts linked Player Characters that meet ALL three conditions simultaneously:
      // a) story_id = current story ID
      // b) owner_user_id = current user ID (via join to chimera_entity_templates)
      // c) entity_type = 'NPC' (player characters are stored as NPCs)
      try {
        // Use a join query to check all conditions in a single database operation
        // This ensures atomicity and efficiency
        const { data: playerEntities, error: countError } = await supabaseAdmin
          .from('chimera_story_entity_links')
          .select(`
            entity_template_id,
            entity:chimera_entity_templates!entity_template_id(id, owner_user_id, entity_type)
          `)
          .eq('story_id', storyId);

        if (countError) {
          console.error('[Chimera Play] Error counting player entities:', {
            error: countError,
            code: countError.code,
            message: countError.message,
            details: countError.details,
            hint: countError.hint,
            storyId,
            userId,
          });
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            `Failed to check player character: ${countError.message || 'Database query failed'}`,
            req,
            {
              error_code: countError.code,
              story_id: storyId,
              user_id: userId,
            }
          );
        }

        // Count entities that meet all three conditions:
        // (a) Link exists (already filtered by story_id)
        // (b) Entity type is 'NPC'
        // (c) Entity is owned by the current user
        const playerEntityCount = (playerEntities || []).filter((link: any) => {
          const entity = link.entity;
          return (
            entity &&
            entity.owner_user_id === userId && // Condition (c): Ownership
            entity.entity_type === 'NPC' // Condition (b): NPC type (player character)
          );
        }).length;

        // Step 4: Security Gate - If count is 0, return 403 FORBIDDEN
        if (playerEntityCount === 0) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.FORBIDDEN,
            'Error: Player character entity is required to start the game.',
            req
          );
        }

        // If count > 0, proceed to StateFactory
      } catch (error) {
        console.error('[Chimera Play] Unexpected error checking player entity:', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          storyId,
          userId,
        });
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          `Unexpected error while checking player character: ${error instanceof Error ? error.message : 'Unknown error'}`,
          req,
          {
            story_id: storyId,
            user_id: userId,
          }
        );
      }

      // Step 5: Check if game state exists, if not create it
      let gameState: ChimeraGameState;
      let isNewGameState = false; // Track if we created a new game state
      
      try {
        // Verify story_id and user_id are valid before querying
        if (!storyId || typeof storyId !== 'string' || storyId.trim().length === 0) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.VALIDATION_FAILED,
            'Invalid story ID provided',
            req,
            { story_id: storyId }
          );
        }

        if (!userId || typeof userId !== 'string') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.UNAUTHORIZED,
            'Invalid user ID',
            req
          );
        }

        const { data: existingGameState, error: gameStateCheckError } = await supabaseAdmin
          .from('chimera_game_states')
          .select('id')
          .eq('story_id', storyId)
          .eq('user_id', userId)
          .single();

        if (gameStateCheckError) {
          // PGRST116 means no rows found (expected when creating new game state)
          if (gameStateCheckError.code === 'PGRST116') {
            // No game state exists, create it
            try {
              gameState = await createInitialState(storyId, compiledStory, userId);
              isNewGameState = true;
            } catch (createError) {
              console.error('[Chimera Play] Error creating initial game state:', {
                error: createError instanceof Error ? createError.message : String(createError),
                stack: createError instanceof Error ? createError.stack : undefined,
                storyId,
                userId,
              });
              return sendErrorWithStatus(
                res,
                ApiErrorCode.INTERNAL_ERROR,
                `Failed to create game state: ${createError instanceof Error ? createError.message : 'Unknown error'}`,
                req,
                {
                  story_id: storyId,
                  user_id: userId,
                }
              );
            }
          } else {
            // Other database errors
            console.error('[Chimera Play] Error checking game state:', {
              error: gameStateCheckError,
              code: gameStateCheckError.code,
              message: gameStateCheckError.message,
              details: gameStateCheckError.details,
              hint: gameStateCheckError.hint,
              storyId,
              userId,
            });
            return sendErrorWithStatus(
              res,
              ApiErrorCode.INTERNAL_ERROR,
              `Failed to check game state: ${gameStateCheckError.message || 'Database query failed'}. Code: ${gameStateCheckError.code || 'unknown'}`,
              req,
              {
                error_code: gameStateCheckError.code,
                error_message: gameStateCheckError.message,
                error_details: gameStateCheckError.details,
                error_hint: gameStateCheckError.hint,
                story_id: storyId,
                user_id: userId,
              }
            );
          }
        } else {
          // Game state exists, fetch the full record
          if (!existingGameState || !existingGameState.id) {
            console.error('[Chimera Play] Game state query returned null/undefined ID:', {
              existingGameState,
              storyId,
              userId,
            });
            return sendErrorWithStatus(
              res,
              ApiErrorCode.INTERNAL_ERROR,
              'Game state query returned invalid data',
              req,
              {
                story_id: storyId,
                user_id: userId,
              }
            );
          }

          const { data: fullGameState, error: fetchError } = await supabaseAdmin
            .from('chimera_game_states')
            .select('*')
            .eq('id', existingGameState.id)
            .single();

          if (fetchError) {
            console.error('[Chimera Play] Error fetching full game state:', {
              error: fetchError,
              code: fetchError.code,
              message: fetchError.message,
              details: fetchError.details,
              hint: fetchError.hint,
              gameStateId: existingGameState.id,
              storyId,
              userId,
            });
            return sendErrorWithStatus(
              res,
              ApiErrorCode.INTERNAL_ERROR,
              `Failed to fetch game state: ${fetchError.message || 'Database query failed'}. Code: ${fetchError.code || 'unknown'}`,
              req,
              {
                error_code: fetchError.code,
                error_message: fetchError.message,
                error_details: fetchError.details,
                error_hint: fetchError.hint,
                game_state_id: existingGameState.id,
                story_id: storyId,
                user_id: userId,
              }
            );
          }

          if (!fullGameState) {
            console.error('[Chimera Play] Full game state query returned null:', {
              gameStateId: existingGameState.id,
              storyId,
              userId,
            });
            return sendErrorWithStatus(
              res,
              ApiErrorCode.INTERNAL_ERROR,
              'Game state not found after initial check',
              req,
              {
                game_state_id: existingGameState.id,
                story_id: storyId,
                user_id: userId,
              }
            );
          }

          gameState = fullGameState as ChimeraGameState;
        }
      } catch (error) {
        console.error('[Chimera Play] Unexpected error in game state check:', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          storyId,
          userId,
        });
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          `Unexpected error while checking game state: ${error instanceof Error ? error.message : 'Unknown error'}`,
          req,
          {
            story_id: storyId,
            user_id: userId,
          }
        );
      }

      // Step 6: Return the game state (201 Created for new, 200 OK for existing)
      return res.status(isNewGameState ? 201 : 200).json({
        ok: true,
        data: gameState,
      });
    } catch (error) {
      console.error('[Chimera Play] Unexpected error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Internal server error',
        req
      );
    }
  }
);

/**
 * CastStoneResponseDto - Final API Response
 */
interface CastStoneResponseDto {
  ripple_narrative: string;
  debug_info?: {
    mas_1_input: string;
    mas_1_output: Mas1ResponseDto;
    engine_outcome: {
      success: boolean;
      message?: string;
      details?: Record<string, unknown>;
    };
    mas_2_response: Mas2ResponseDto;
    final_mutations: MutationDto[];
  };
}

/**
 * POST /api/v2/play/:gameStateId/cast-stone
 * Execute a player action and generate narrative response
 * 
 * This is the main play loop orchestrator that:
 * 1. Parses user input (MAS 1)
 * 2. Resolves action mechanically (Engine)
 * 3. Generates narrative (MAS 2)
 * 4. Validates and applies mutations (Security)
 * 5. Saves updated state
 * 
 * Requires:
 * - Authenticated user
 * - Game state must exist and belong to user
 * - Story must have a compiled ruleset
 */
router.post(
  '/:gameStateId/cast-stone',
  validateRequest(GameStateIdParamSchema, 'params'),
  validateRequest(CastStoneBodySchema, 'body'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.ctx?.userId;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { gameStateId } = req.params;
      const { text_input } = req.body;

      // Step 1: Load game state and compiled story
      const { data: gameState, error: gameStateError } = await supabaseAdmin
        .from('chimera_game_states')
        .select('*')
        .eq('id', gameStateId)
        .single();

      if (gameStateError) {
        if (gameStateError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Game state not found',
            req
          );
        }
        console.error('[Cast Stone] Error fetching game state:', gameStateError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch game state',
          req
        );
      }

      // Verify ownership
      if (gameState.user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'You do not have permission to access this game state',
          req
        );
      }

      // Verify game is active
      if (gameState.status !== 'active') {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Game is not active',
          req
        );
      }

      // Fetch compiled story
      const { data: compiledRuleset, error: compiledError } = await supabaseAdmin
        .from('chimera_story_compiled_ruleset')
        .select('compiled_json')
        .eq('story_id', gameState.story_id)
        .single();

      if (compiledError || !compiledRuleset?.compiled_json) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Story has not been compiled yet. Please rebuild the story first.',
          req
        );
      }

      const compiledStory = compiledRuleset.compiled_json as CompiledStoryJson;
      const currentState = gameState.current_game_state as GameStateTiers;

      // Step 2: MAS 1 (Intent & Sentiment)
      const mas1Response: Mas1ResponseDto = await parseAction(
        text_input,
        compiledStory.parser_context_json,
        currentState
      );

      // Step 3: Engine (Calculation)
      const { outcome, mutations: engine_mutations } = await resolveAction(
        mas1Response.actionDto,
        currentState,
        compiledStory.action_context_json
      );

      // Step 4: MAS 2 (Narrative & Request)
      const mas2Response: Mas2ResponseDto = await generateNarrative(
        outcome,
        currentState,
        compiledStory.narrative_context_json,
        mas1Response
      );

      // Step 5: Security 1 (Tier 0 Validation)
      const validated_ai_t0_mutations = validateMutations(mas2Response.mutations);

      // Step 6: Security 2 (Tier 1/2 Validation)
      const validated_engine_t1_t2_mutations = mas2Response.engine_requests
        ? processEngineRequests(
            mas2Response.engine_requests,
            compiledStory.action_context_json
          )
        : [];

      // Step 7: Combine & Apply all mutations
      const allMutations: MutationDto[] = [
        ...engine_mutations,
        ...validated_ai_t0_mutations,
        ...validated_engine_t1_t2_mutations,
      ];

      // Create a deep copy of the current state to apply mutations
      const newState = JSON.parse(JSON.stringify(currentState)) as GameStateTiers;
      applyMutations(newState as unknown as Record<string, unknown>, allMutations);

      // Step 8: Save updated state
      const { error: updateError } = await supabaseAdmin
        .from('chimera_game_states')
        .update({
          current_game_state: newState,
          turn_count: gameState.turn_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', gameStateId);

      if (updateError) {
        console.error('[Cast Stone] Error updating game state:', updateError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to save game state',
          req
        );
      }

      // Step 9: Build response
      const response: CastStoneResponseDto = {
        ripple_narrative: mas2Response.ripple_narrative,
      };

      // Include debug info if requested (via query param or env var)
      const includeDebug = req.query.debug === 'true' || process.env.DEBUG_MAS === 'true';
      if (includeDebug) {
        response.debug_info = {
          mas_1_input: text_input,
          mas_1_output: mas1Response,
          engine_outcome: outcome,
          mas_2_response: mas2Response,
          final_mutations: allMutations,
        };
      }

      return res.status(200).json({
        ok: true,
        data: response,
      });
    } catch (error) {
      console.error('[Cast Stone] Unexpected error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Internal server error',
        req
      );
    }
  }
);

/**
 * GET /api/v2/play/:storyId/player-entities
 * Get all player entities (linked to story and owned by user) for selection
 * 
 * Requires:
 * - Authenticated user
 * - Story must exist
 */
router.get(
  '/:storyId/player-entities',
  validateRequest(TextIdParamSchema, 'params'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.ctx?.userId;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { storyId } = req.params;

      // Step 1: Verify story exists and get world_id
      const { data: story, error: storyError } = await supabaseAdmin
        .from('chimera_stories')
        .select('id, owner_user_id, visibility, world_id')
        .eq('id', storyId)
        .single();

      if (storyError) {
        if (storyError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Story not found',
            req
          );
        }
        console.error('[Chimera Play] Error fetching story:', storyError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch story',
          req
        );
      }

      if (!story) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Story not found',
          req
        );
      }

      // Check access
      const isOwner = story.owner_user_id === userId;
      const isPublic = story.visibility === 'public';
      
      if (!isOwner && !isPublic) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Story not found',
          req
        );
      }

      // Step 2: Fetch player entities (NPC type) - both user-owned and system assets
      // System assets must match the story's world_id OR be global (world_id is NULL)
      const worldId = story.world_id;

      // Fetch user-owned player entities
      const { data: userEntities, error: userEntitiesError } = await supabaseAdmin
        .from('chimera_entity_templates')
        .select('id, display_name, description_short, base_state_json, created_at, is_system_asset, world_id, is_quick_start_template')
        .eq('owner_user_id', userId)
        .eq('entity_type', 'NPC') // Player characters are NPCs
        .eq('is_system_asset', false) // Only user-owned
        .order('created_at', { ascending: false });

      if (userEntitiesError) {
        console.error('[Chimera Play] Error fetching user player entities:', userEntitiesError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch player entities',
          req
        );
      }

      // Fetch system assets (premade characters / quick start templates)
      // Criteria: 
      // - is_system_asset = true
      // - is_quick_start_template = true (only playable templates)
      // - entity_type = 'NPC'
      // - world_id matches story's world OR world_id is NULL for global
      let systemEntities: any[] = [];
      
      if (worldId) {
        // Fetch quick start templates for this world OR global quick start templates
        const { data: systemAssets, error: systemError } = await supabaseAdmin
          .from('chimera_entity_templates')
          .select('id, display_name, description_short, base_state_json, created_at, is_system_asset, world_id, is_quick_start_template')
          .eq('is_system_asset', true)
          .eq('is_quick_start_template', true) // Only playable quick start templates
          .eq('entity_type', 'NPC')
          .or(`world_id.eq.${worldId},world_id.is.null`) // Match world OR global
          .order('display_name', { ascending: true });

        if (systemError) {
          console.error('[Chimera Play] Error fetching system assets:', systemError);
          // Don't fail the request if system assets can't be fetched, just log and continue
        } else {
          systemEntities = systemAssets || [];
        }
      } else {
        // If story has no world, only fetch global quick start templates (world_id is NULL)
        const { data: globalAssets, error: globalError } = await supabaseAdmin
          .from('chimera_entity_templates')
          .select('id, display_name, description_short, base_state_json, created_at, is_system_asset, world_id, is_quick_start_template')
          .eq('is_system_asset', true)
          .eq('is_quick_start_template', true) // Only playable quick start templates
          .eq('entity_type', 'NPC')
          .is('world_id', null) // Only global assets
          .order('display_name', { ascending: true });

        if (globalError) {
          console.error('[Chimera Play] Error fetching global system assets:', globalError);
        } else {
          systemEntities = globalAssets || [];
        }
      }

      // Combine user-owned and system assets
      const allEntities = [
        ...(userEntities || []),
        ...systemEntities,
      ];

      return sendSuccess(res, allEntities, req);
    } catch (error) {
      console.error('[Chimera Play] Unexpected error fetching player entities:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Internal server error',
        req
      );
    }
  }
);

// Schema for quick start request body
const QuickStartBodySchema = z.object({
  character_name: z.string().min(1).max(200).optional(),
});

/**
 * POST /api/v2/play/:storyId/quick-start
 * Create a default player character and start the game immediately
 * 
 * Requires:
 * - Authenticated user
 * - User must own the story
 * - Story must have a compiled ruleset
 */
router.post(
  '/:storyId/quick-start',
  validateRequest(TextIdParamSchema, 'params'),
  validateRequest(QuickStartBodySchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.ctx?.userId;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { storyId } = req.params;

      // Step 1: Verify story exists and user owns it
      const { data: story, error: storyError } = await supabaseAdmin
        .from('chimera_stories')
        .select('id, owner_user_id')
        .eq('id', storyId)
        .single();

      if (storyError) {
        if (storyError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Story not found',
            req
          );
        }
        console.error('[Chimera Play] Error fetching story:', storyError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch story',
          req
        );
      }

      if (!story || story.owner_user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'You do not have permission to create a character for this story',
          req
        );
      }

      // Step 2: Get character name from request body or use default
      const { character_name } = req.body;
      const displayName = character_name?.trim() || 'Quick Start Character';

      // Step 3: Create default character data (empty object for now, can be enhanced later)
      const defaultCharacterData: Record<string, unknown> = {};

      // Step 4: Generate entity ID and create player entity
      const playerEntityId = `chimera_entity_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const { data: playerEntity, error: entityError } = await supabaseAdmin
        .from('chimera_entity_templates')
        .insert({
          id: playerEntityId,
          owner_user_id: userId,
          display_name: displayName,
          description_short: 'Quick start character',
          entity_type: 'NPC',
          base_state_json: defaultCharacterData,
          visibility: 'private',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (entityError) {
        console.error('[Chimera Play] Error creating quick start entity:', entityError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to create player character',
          req
        );
      }

      // Step 5: Link the Player Entity to the story
      const { error: linkError } = await supabaseAdmin
        .from('chimera_story_entity_links')
        .insert({
          story_id: storyId,
          entity_template_id: playerEntityId,
        });

      if (linkError) {
        console.error('[Chimera Play] Error linking quick start entity:', linkError);
        await supabaseAdmin.from('chimera_entity_templates').delete().eq('id', playerEntityId);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to link player character to story',
          req
        );
      }

      // Step 6: Fetch compiled story and create game state
      const { data: compiledRuleset, error: compiledError } = await supabaseAdmin
        .from('chimera_story_compiled_ruleset')
        .select('compiled_json')
        .eq('story_id', storyId)
        .single();

      if (compiledError || !compiledRuleset?.compiled_json) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Story has not been compiled yet. Please rebuild the story first.',
          req
        );
      }

      const compiledStory = compiledRuleset.compiled_json as CompiledStoryJson;

      // Step 7: Check if game state exists, if not create it
      const { data: existingGameState, error: gameStateCheckError } = await supabaseAdmin
        .from('chimera_game_states')
        .select('id')
        .eq('story_id', storyId)
        .eq('user_id', userId)
        .single();

      let gameState: ChimeraGameState;

      if (gameStateCheckError && gameStateCheckError.code === 'PGRST116') {
        // No game state exists, create it
        gameState = await createInitialState(storyId, compiledStory, userId);
      } else if (gameStateCheckError) {
        console.error('[Chimera Play] Error checking game state in quick start:', gameStateCheckError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to check game state',
          req
        );
      } else {
        // Fetch the full game state
        const { data: fullGameState, error: fetchError } = await supabaseAdmin
          .from('chimera_game_states')
          .select('*')
          .eq('id', existingGameState!.id)
          .single();

        if (fetchError) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to fetch game state',
            req
          );
        }

        gameState = fullGameState as ChimeraGameState;
      }

      // Step 8: Return game state ID for navigation
      return sendSuccess(
        res,
        {
          player_entity_id: playerEntityId,
          game_state_id: gameState.id,
        },
        req
      );
    } catch (error) {
      console.error('[Chimera Play] Unexpected error in quick start:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Internal server error',
        req
      );
    }
  }
);

// Schema for storyId and entityId params
const StoryEntityParamsSchema = z.object({
  storyId: z.string().min(1).max(200),
  entityId: z.string().min(1).max(200),
});

/**
 * POST /api/v2/play/:storyId/start-with-entity/:entityId
 * Start a game with a specific existing player entity
 * 
 * Requires:
 * - Authenticated user
 * - Entity must be owned by user and linked to story
 */
router.post(
  '/:storyId/start-with-entity/:entityId',
  validateRequest(StoryEntityParamsSchema, 'params'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.ctx?.userId;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { storyId, entityId } = req.params;

      // Step 1: Verify entity exists and is owned by user
      const { data: entity, error: entityError } = await supabaseAdmin
        .from('chimera_entity_templates')
        .select('id, owner_user_id')
        .eq('id', entityId)
        .eq('owner_user_id', userId)
        .single();

      if (entityError || !entity) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Player entity not found or you do not have permission to use it',
          req
        );
      }

      // Step 2: Check if entity is linked to the story, if not link it
      const { data: existingLink, error: linkCheckError } = await supabaseAdmin
        .from('chimera_story_entity_links')
        .select('story_id, entity_template_id')
        .eq('story_id', storyId)
        .eq('entity_template_id', entityId)
        .single();

      // If link doesn't exist, create it
      if (linkCheckError && linkCheckError.code === 'PGRST116') {
        const { error: linkCreateError } = await supabaseAdmin
          .from('chimera_story_entity_links')
          .insert({
            story_id: storyId,
            entity_template_id: entityId,
          });

        if (linkCreateError) {
          console.error('[Chimera Play] Error linking entity to story:', linkCreateError);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to link player entity to story',
            req
          );
        }
      } else if (linkCheckError) {
        // Other database error
        console.error('[Chimera Play] Error checking entity link:', linkCheckError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to check entity link',
          req
        );
      }

      // Step 3: Fetch compiled story
      const { data: compiledRuleset, error: compiledError } = await supabaseAdmin
        .from('chimera_story_compiled_ruleset')
        .select('compiled_json')
        .eq('story_id', storyId)
        .single();

      if (compiledError || !compiledRuleset?.compiled_json) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Story has not been compiled yet. Please rebuild the story first.',
          req
        );
      }

      const compiledStory = compiledRuleset.compiled_json as CompiledStoryJson;

      // Step 4: Check if game state exists, if not create it
      const { data: existingGameState, error: gameStateCheckError } = await supabaseAdmin
        .from('chimera_game_states')
        .select('id')
        .eq('story_id', storyId)
        .eq('user_id', userId)
        .single();

      let gameState: ChimeraGameState;

      if (gameStateCheckError && gameStateCheckError.code === 'PGRST116') {
        // No game state exists, create it
        gameState = await createInitialState(storyId, compiledStory, userId);
      } else if (gameStateCheckError) {
        console.error('[Chimera Play] Error checking game state:', gameStateCheckError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to check game state',
          req
        );
      } else {
        // Fetch the full game state
        const { data: fullGameState, error: fetchError } = await supabaseAdmin
          .from('chimera_game_states')
          .select('*')
          .eq('id', existingGameState!.id)
          .single();

        if (fetchError) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to fetch game state',
            req
          );
        }

        gameState = fullGameState as ChimeraGameState;
      }

      // Step 5: Return game state
      return sendSuccess(res, gameState, req);
    } catch (error) {
      console.error('[Chimera Play] Unexpected error starting with entity:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Internal server error',
        req
      );
    }
  }
);

/**
 * GET /api/v2/play/:storyId/character/schema
 * Get the character creation schema from compiled story
 * 
 * Requires:
 * - Authenticated user
 * - Story must exist and have a compiled ruleset
 */
router.get(
  '/:storyId/character/schema',
  validateRequest(TextIdParamSchema, 'params'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.ctx?.userId;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { storyId } = req.params;

      // Step 1: Verify story exists and user has access
      const { data: story, error: storyError } = await supabaseAdmin
        .from('chimera_stories')
        .select('id, owner_user_id, visibility, world_id')
        .eq('id', storyId)
        .single();

      if (storyError) {
        if (storyError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Story not found',
            req
          );
        }
        console.error('[Chimera Play] Error fetching story:', storyError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch story',
          req
        );
      }

      if (!story) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Story not found',
          req
        );
      }

      // Check access
      const isOwner = story.owner_user_id === userId;
      const isPublic = story.visibility === 'public';
      
      if (!isOwner && !isPublic) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Story not found',
          req
        );
      }

      // Step 2: Fetch compiled story JSON
      const { data: compiledRuleset, error: compiledError } = await supabaseAdmin
        .from('chimera_story_compiled_ruleset')
        .select('compiled_json')
        .eq('story_id', storyId)
        .single();

      if (compiledError || !compiledRuleset?.compiled_json) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Story has not been compiled yet. Please rebuild the story first.',
          req
        );
      }

      const compiledStory = compiledRuleset.compiled_json as CompiledStoryJson;

      // Step 3: Fetch world to get character_schema_contributions
      let worldSchemaContributions: Record<string, unknown> = {};
      if (story.world_id) {
        const { data: world, error: worldError } = await supabaseAdmin
          .from('chimera_worlds')
          .select('character_schema_contributions')
          .eq('id', story.world_id)
          .single();

        if (!worldError && world) {
          worldSchemaContributions = world.character_schema_contributions || {};
        }
      }

      // Step 4: Extract UI schema from rulesets (if available in compiled JSON)
      // For now, we'll merge world contributions with any ruleset UI schemas
      // The compiled JSON structure may need to be extended to include ui_schema_merged
      const uiSchemaMerged: Record<string, unknown> = {
        ...worldSchemaContributions,
        // Ruleset UI schemas would be merged here if available
      };

      // Step 5: Fetch world name for display
      let worldName = 'Unknown World';
      if (story.world_id) {
        const { data: world } = await supabaseAdmin
          .from('chimera_worlds')
          .select('display_name')
          .eq('id', story.world_id)
          .single();

        if (world) {
          worldName = world.display_name;
        }
      }

      return sendSuccess(
        res,
        {
          world_name: worldName,
          ui_schema_merged: uiSchemaMerged,
        },
        req
      );
    } catch (error) {
      console.error('[Chimera Play] Unexpected error in character schema:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Internal server error',
        req
      );
    }
  }
);

/**
 * POST /api/v2/play/:storyId/character/finalize
 * Finalize player character creation and create game state if needed
 * 
 * Requires:
 * - Authenticated user
 * - User must own the story
 * - Story must have a compiled ruleset
 */
router.post(
  '/:storyId/character/finalize',
  validateRequest(TextIdParamSchema, 'params'),
  validateRequest(FinalizeCharacterBodySchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.ctx?.userId;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { storyId } = req.params;
      const { character_data } = req.body;

      // Step 1: Verify story exists and user owns it
      const { data: story, error: storyError } = await supabaseAdmin
        .from('chimera_stories')
        .select('id, owner_user_id')
        .eq('id', storyId)
        .single();

      if (storyError) {
        if (storyError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Story not found',
            req
          );
        }
        console.error('[Chimera Play] Error fetching story:', storyError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch story',
          req
        );
      }

      if (!story || story.owner_user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'You do not have permission to create a character for this story',
          req
        );
      }

      // Step 2: Generate entity ID for player character
      const playerEntityId = `chimera_entity_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Step 3: Create the Player Entity Template
      const { data: playerEntity, error: entityError } = await supabaseAdmin
        .from('chimera_entity_templates')
        .insert({
          id: playerEntityId,
          owner_user_id: userId,
          display_name: 'Player Character',
          description_short: 'Player character for this story',
          entity_type: 'NPC', // Player characters are NPCs
          base_state_json: character_data,
          visibility: 'private',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (entityError) {
        console.error('[Chimera Play] Error creating player entity:', entityError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to create player character',
          req
        );
      }

      // Step 4: Link the Player Entity to the story
      const { error: linkError } = await supabaseAdmin
        .from('chimera_story_entity_links')
        .insert({
          story_id: storyId,
          entity_template_id: playerEntityId,
        });

      if (linkError) {
        console.error('[Chimera Play] Error linking player entity:', linkError);
        // Rollback entity creation
        await supabaseAdmin.from('chimera_entity_templates').delete().eq('id', playerEntityId);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to link player character to story',
          req
        );
      }

      // Step 5: Check if game state exists, if not create it
      const { data: existingGameState, error: gameStateCheckError } = await supabaseAdmin
        .from('chimera_game_states')
        .select('id')
        .eq('story_id', storyId)
        .eq('user_id', userId)
        .single();

      let gameStateId: string;

      if (gameStateCheckError && gameStateCheckError.code === 'PGRST116') {
        // No game state exists, create it
        const { data: compiledRuleset, error: compiledError } = await supabaseAdmin
          .from('chimera_story_compiled_ruleset')
          .select('compiled_json')
          .eq('story_id', storyId)
          .single();

        if (compiledError || !compiledRuleset?.compiled_json) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.VALIDATION_FAILED,
            'Story has not been compiled yet. Please rebuild the story first.',
            req
          );
        }

        const compiledStory = compiledRuleset.compiled_json as CompiledStoryJson;
        const gameState = await createInitialState(storyId, compiledStory, userId);
        gameStateId = gameState.id;
      } else if (gameStateCheckError) {
        console.error('[Chimera Play] Error checking game state:', gameStateCheckError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to check game state',
          req
        );
      } else {
        gameStateId = existingGameState!.id;
      }

      // Step 6: Return player entity ID and game state ID
      return sendSuccess(
        res,
        {
          player_entity_id: playerEntityId,
          game_state_id: gameStateId,
        },
        req
      );
    } catch (error) {
      console.error('[Chimera Play] Unexpected error in character finalize:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Internal server error',
        req
      );
    }
  }
);

export default router;

