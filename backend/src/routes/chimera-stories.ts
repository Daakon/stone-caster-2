/**
 * @swagger
 * tags:
 *   - name: Chimera V2 Stories
 *     description: User-facing CRUD endpoints for Chimera stories
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth.unified.js';
import { validateRequest } from '../middleware/validation.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { supabaseAdmin } from '../services/supabase.js';
import { rebuildStory } from '../services/chimera/rebuild-service.js';
import { StoryCompilerService } from '../services/compiler/compiler.service.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Custom schema for text-based IDs (not UUIDs)
const TextIdParamSchema = z.object({
  id: z.string().min(1).max(200),
});

// Zod schemas for validation
const VisibilitySchema = z.enum(['private', 'pending_approval', 'public']);

const CreateStorySchema = z.object({
  display_name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  description_short: z.string().max(500).optional().nullable(),
  content_rating: z.enum(['safe', 'mature', 'explicit']).default('safe'),
  world_id: z.string().min(1).optional().nullable(),
  ruleset_template_ids: z.array(z.string()).default([]),
  pack_ids: z.array(z.string()).default([]),
  entity_ids: z.array(z.string()).default([]),
  image_url: z.string().url().optional().nullable(),
  genesis_config: z.record(z.unknown()).optional(),
});

const UpdateStorySchema = CreateStorySchema.partial().extend({
  visibility: VisibilitySchema.optional(),
  story_definition: z.record(z.unknown()).optional(),
  protagonist_id: z.string().uuid().optional().nullable(),
  cast_ids: z.array(z.string().uuid()).optional(),
  active_ruleset_ids: z.array(z.string()).optional(), // Array of UUIDs
  status: z.enum(['draft', 'compiled', 'bound']).optional(),
  title: z.string().optional(),
  description: z.string().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  genesis_config: z.record(z.unknown()).optional(),
});

const UpdateStoryDefinitionSchema = z.object({
  story_definition: z.record(z.unknown()),
});

// Generate UUID for story ID (database expects UUID)
function generateId(): string {
  return randomUUID();
}

/**
 * GET /api/v2/chimera/stories/my-creations
 * Get all stories owned by the current user
 */
router.get('/my-creations', async (req: Request, res: Response) => {
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

    const { data: stories, error } = await supabaseAdmin
      .from('chimera_stories')
      .select(`
        *,
        world:chimera_worlds(id, definition)
      `)
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Chimera Stories] Error fetching user stories:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch stories',
        req
      );
    }

    // Map world name from definition JSONB
    const formattedStories = (stories || []).map((story: any) => ({
      ...story,
      world: story.world ? {
        id: story.world.id,
        name: story.world.definition?.name || 'Untitled World',
        description_short: story.world.definition?.description_short || null,
      } : null,
    }));

    return sendSuccess(res, formattedStories, req);
  } catch (error) {
    console.error('[Chimera Stories] Unexpected error:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

/**
 * POST /api/v2/chimera/stories
 * Create a new story
 */
router.post(
  '/',
  validateRequest(CreateStorySchema),
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

      const storyData = req.body;
      const id = generateId();

      // Validate world_id if provided
      if (storyData.world_id) {
        const { data: world, error: worldError } = await supabaseAdmin
          .from('chimera_worlds')
          .select('id, owner_user_id')
          .eq('id', storyData.world_id)
          .single();

        if (worldError || !world) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'World not found',
            req
          );
        }

        // Check ownership or public visibility
        const { data: worldWithVisibility } = await supabaseAdmin
          .from('chimera_worlds')
          .select('id, owner_user_id, visibility')
          .eq('id', storyData.world_id)
          .single();

        if (worldWithVisibility && worldWithVisibility.owner_user_id !== userId && worldWithVisibility.visibility !== 'public') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.FORBIDDEN,
            'You do not have permission to use this world',
            req
          );
        }
      }

      // Validate ruleset_template_ids if provided
      if (storyData.ruleset_template_ids && storyData.ruleset_template_ids.length > 0) {
        const { data: templates, error: templatesError } = await supabaseAdmin
          .from('chimera_ruleset_templates')
          .select('id')
          .in('id', storyData.ruleset_template_ids);

        if (templatesError) {
          console.error('[Chimera Stories] Error validating ruleset templates:', templatesError);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to validate ruleset templates',
            req
          );
        }

        if (!templates || templates.length !== storyData.ruleset_template_ids.length) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.VALIDATION_FAILED,
            'One or more ruleset template IDs are invalid',
            req
          );
        }
      }

      // Validate pack_ids if provided
      if (storyData.pack_ids && storyData.pack_ids.length > 0) {
        const { data: packs, error: packsError } = await supabaseAdmin
          .from('chimera_content_packs')
          .select('id, owner_user_id, visibility')
          .in('id', storyData.pack_ids);

        if (packsError) {
          console.error('[Chimera Stories] Error validating content packs:', packsError);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to validate content packs',
            req
          );
        }

        if (!packs || packs.length !== storyData.pack_ids.length) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.VALIDATION_FAILED,
            'One or more content pack IDs are invalid',
            req
          );
        }

        // Check ownership or public visibility for packs
        const invalidPacks = packs.filter(
          (p) => p.owner_user_id !== userId && p.visibility !== 'public'
        );
        if (invalidPacks.length > 0) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.FORBIDDEN,
            'You do not have permission to use one or more content packs',
            req
          );
        }
      }

      // Build configuration JSONB from Casting Circle state
      const configuration = {
        worldId: storyData.world_id || '',
        rulesetIds: storyData.ruleset_template_ids || [],
        entityIds: storyData.entity_ids || [],
      };

      // Create the story - always set visibility to 'private' for new stories
      const { data: story, error: storyError } = await supabaseAdmin
        .from('chimera_stories')
        .insert({
          id,
          owner_user_id: userId,
          display_name: storyData.display_name || `Untitled Story ${id.slice(0, 8)}`,
          description_short: storyData.description_short,
          description: storyData.description,
          image_url: storyData.image_url,
          content_rating: storyData.content_rating || 'safe',
          world_id: storyData.world_id || null,
          visibility: 'private', // Always private for new stories
          configuration: configuration,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'draft',
          title: storyData.display_name || `Untitled Story ${id.slice(0, 8)}`
        })
        .select()
        .single();

      if (storyError) {
        console.error('[Chimera Stories] Error creating story:', storyError);
        if (storyError.code === '23505') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.CONFLICT,
            'A story with this name already exists',
            req
          );
        }
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to create story',
          req
        );
      }

      // Note: Ruleset, pack, and entity links are now stored in the configuration JSONB field
      // Junction tables (chimera_story_links, chimera_story_entity_links) are deprecated
      // The configuration field already contains rulesetIds and entityIds

      // Fetch the complete story (configuration field contains Casting Circle state)
      const { data: completeStory, error: fetchError } = await supabaseAdmin
        .from('chimera_stories')
        .select(`
          *,
          world:chimera_worlds(id, definition)
        `)
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('[Chimera Stories] Error fetching created story:', fetchError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Story created but failed to fetch',
          req
        );
      }

      // Map world name from definition JSONB
      const formattedStory = completeStory ? {
        ...completeStory,
        world: completeStory.world ? {
          id: completeStory.world.id,
          name: completeStory.world.definition?.name || 'Untitled World',
          description_short: completeStory.world.definition?.description_short || null,
        } : null,
      } : completeStory;

      return sendSuccess(res, formattedStory, req);
    } catch (error) {
      console.error('[Chimera Stories] Unexpected error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Internal server error',
        req
      );
    }
  }
);

/**
 * GET /api/v2/chimera/stories/:id
 * Get a single story with all relations (owner-only or public)
 */
router.get(
  '/:id',
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

      const { id } = req.params;

      const { data: story, error: storyError } = await supabaseAdmin
        .from('chimera_stories')
        .select(`
          *,
          world:chimera_worlds(id, definition)
        `)
        .eq('id', id)
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
        console.error('[Chimera Stories] Error fetching story:', storyError);
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

      // Check access: user must be owner OR visibility must be public
      // Return 404 (not 403) if visibility check fails to prevent information leakage
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

      // Map world name from definition JSONB
      const formattedStory = {
        ...story,
        world: story.world ? {
          id: story.world.id,
          name: story.world.definition?.name || 'Untitled World',
          description_short: story.world.definition?.description_short || null,
        } : null,
      };

      return sendSuccess(res, formattedStory, req);
    } catch (error) {
      console.error('[Chimera Stories] Unexpected error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Internal server error',
        req
      );
    }
  }
);

/**
 * PUT /api/v2/chimera/stories/:id
 * Update a story (owner-only) and handle diffing rulesets and entities
 */
router.put(
  '/:id',
  validateRequest(TextIdParamSchema, 'params'),
  validateRequest(UpdateStorySchema),
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

      const { id } = req.params;
      const updateData = req.body;

      // Check ownership
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('chimera_stories')
        .select('owner_user_id')
        .eq('id', id)
        .single();

      if (checkError) {
        if (checkError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Story not found',
            req
          );
        }
        console.error('[Chimera Stories] Error checking ownership:', checkError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to verify ownership',
          req
        );
      }

      if (existing.owner_user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'You do not have permission to update this story',
          req
        );
      }

      // Validate world_id if being updated
      let newRulesetIds: string[] = [];
      if (updateData.world_id !== undefined) {
        if (updateData.world_id) {
          const { data: world, error: worldError } = await supabaseAdmin
            .from('chimera_worlds')
            .select('id, owner_user_id, visibility, definition')
            .eq('id', updateData.world_id)
            .single();

          if (worldError || !world) {
            return sendErrorWithStatus(
              res,
              ApiErrorCode.NOT_FOUND,
              'World not found',
              req
            );
          }

          if (world.owner_user_id !== userId && world.visibility !== 'public') {
            return sendErrorWithStatus(
              res,
              ApiErrorCode.FORBIDDEN,
              'You do not have permission to use this world',
              req
            );
          }

          // Auto-inherit rulesets from the new world
          if (world.definition?.ruleset_template_ids) {
            newRulesetIds = world.definition.ruleset_template_ids;
          }
        }
      }

      // Build update payload
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updateData.display_name !== undefined) updatePayload.display_name = updateData.display_name;
      if (updateData.title !== undefined) updatePayload.title = updateData.title; // Legacy/Alias
      if (updateData.description_short !== undefined) updatePayload.description_short = updateData.description_short;
      if (updateData.description !== undefined) updatePayload.description = updateData.description; // Legacy long desc
      if (updateData.opening_text !== undefined) updatePayload.opening_text = updateData.opening_text;

      if (updateData.image_url !== undefined) updatePayload.image_url = updateData.image_url;
      if (updateData.world_id !== undefined) updatePayload.world_id = updateData.world_id || null;
      if (updateData.visibility !== undefined) updatePayload.visibility = updateData.visibility;
      if (updateData.story_definition !== undefined) updatePayload.story_definition = updateData.story_definition;
      if (updateData.status !== undefined) updatePayload.status = updateData.status;
      if (updateData.entity_ids !== undefined) updatePayload.entity_ids = updateData.entity_ids;
      if (updateData.genesis_config !== undefined) updatePayload.genesis_config = updateData.genesis_config;

      // Handle rulesets - Source of Truth is now the active_ruleset_ids column
      // Priority 1: Direct update via active_ruleset_ids
      if (updateData.active_ruleset_ids !== undefined) {
        updatePayload.active_ruleset_ids = updateData.active_ruleset_ids;
      }
      // Priority 2: Legacy/World Inheritance (only if active not explicit)
      else if (newRulesetIds.length > 0) {
        // If we switched worlds and got new defaults, apply them to the column
        updatePayload.active_ruleset_ids = newRulesetIds;
      }
      else if (updateData.ruleset_template_ids !== undefined) {
        // Fallback for legacy calls
        updatePayload.active_ruleset_ids = updateData.ruleset_template_ids;
      }

      // Update the story
      const { error: updateError } = await supabaseAdmin
        .from('chimera_stories')
        .update(updatePayload)
        .eq('id', id);

      if (updateError) {
        console.error('[Chimera Stories] Error updating story:', updateError);
        if (updateError.code === '23505') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.CONFLICT,
            'A story with this name already exists',
            req
          );
        }
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to update story',
          req
        );
      }

      // ---------------------------------------------------------
      // Configuration JSONB Cleanup
      // We no longer write worldId or rulesetIds keys to configuration.
      // entityIds are now stored in their own column (chimera_stories.entity_ids).
      // ---------------------------------------------------------
      // Note: Pack links are still handled via junction table (chimera_story_content_pack_links)

      // Note: Pack links are still handled via junction table (chimera_story_content_pack_links)
      // Entity links are now in configuration JSONB (handled above)
      if (updateData.pack_ids !== undefined) {
        // Get current links
        const { data: currentPackLinks, error: currentPackLinksError } = await supabaseAdmin
          .from('chimera_story_content_pack_links')
          .select('pack_id')
          .eq('story_id', id);

        if (currentPackLinksError) {
          console.error('[Chimera Stories] Error fetching current pack links:', currentPackLinksError);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to fetch current pack links',
            req
          );
        }

        const currentPackIds = new Set((currentPackLinks || []).map((l) => l.pack_id));
        const newPackIds = new Set(updateData.pack_ids);

        // Find IDs to add
        const toAdd = Array.from(newPackIds).filter((id) => !currentPackIds.has(id));
        // Find IDs to remove
        const toRemove = Array.from(currentPackIds).filter((id) => !newPackIds.has(id));

        // Remove old links
        if (toRemove.length > 0) {
          const { error: deleteError } = await supabaseAdmin
            .from('chimera_story_content_pack_links')
            .delete()
            .eq('story_id', id)
            .in('pack_id', Array.from(toRemove));

          if (deleteError) {
            console.error('[Chimera Stories] Error deleting pack links:', deleteError);
            return sendErrorWithStatus(
              res,
              ApiErrorCode.INTERNAL_ERROR,
              'Failed to update pack links',
              req
            );
          }
        }

        // Add new links
        if (toAdd.length > 0) {
          const newLinks = toAdd.map((packId) => ({
            story_id: id,
            pack_id: packId,
          }));

          const { error: insertError } = await supabaseAdmin
            .from('chimera_story_content_pack_links')
            .insert(newLinks);

          if (insertError) {
            console.error('[Chimera Stories] Error inserting pack links:', insertError);
            return sendErrorWithStatus(
              res,
              ApiErrorCode.INTERNAL_ERROR,
              'Failed to update pack links',
              req
            );
          }
        }
      }

      // Fetch the complete updated story (configuration field contains Casting Circle state)
      const { data: updatedStory, error: fetchError } = await supabaseAdmin
        .from('chimera_stories')
        .select(`
          *,
          world:chimera_worlds(id, definition)
        `)
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('[Chimera Stories] Error fetching updated story:', fetchError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Story updated but failed to fetch',
          req
        );
      }

      // Map world name from definition JSONB
      const formattedStory = updatedStory ? {
        ...updatedStory,
        world: updatedStory.world ? {
          id: updatedStory.world.id,
          name: updatedStory.world.definition?.name || 'Untitled World',
          description_short: updatedStory.world.definition?.description_short || null,
        } : null,
      } : updatedStory;

      return sendSuccess(res, formattedStory, req);
    } catch (error) {
      console.error('[Chimera Stories] Unexpected error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Internal server error',
        req
      );
    }
  }
);

/**
 * PATCH /api/v2/chimera/stories/:id
 * Partial update for a story (owner-only)
 */
router.patch(
  '/:id',
  validateRequest(TextIdParamSchema, 'params'),
  validateRequest(UpdateStorySchema),
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

      const { id } = req.params;
      const updateData = req.body;

      // Check ownership
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('chimera_stories')
        .select('owner_user_id')
        .eq('id', id)
        .single();

      if (checkError || !existing) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Story not found',
          req
        );
      }

      if (existing.owner_user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'You do not have permission to update this story',
          req
        );
      }

      // Build update payload
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        ...updateData
      };

      // Clean up undefined values
      Object.keys(updatePayload).forEach(key =>
        updatePayload[key] === undefined && delete updatePayload[key]
      );

      // Handle configuration JSONB updates directly if needed
      if (updateData.world_id !== undefined || updateData.ruleset_template_ids !== undefined || updateData.entity_ids !== undefined) {
        const { data: currentStory } = await supabaseAdmin
          .from('chimera_stories')
          .select('configuration')
          .eq('id', id)
          .single();

        const currentConfig = (currentStory?.configuration as any) || {};
        const updatedConfig = {
          ...currentConfig,
          worldId: updateData.world_id !== undefined ? updateData.world_id : currentConfig.worldId,
          rulesetIds: updateData.ruleset_template_ids !== undefined ? updateData.ruleset_template_ids : currentConfig.rulesetIds,
          entityIds: updateData.entity_ids !== undefined ? updateData.entity_ids : currentConfig.entityIds,
        };
        updatePayload.configuration = updatedConfig;
      }

      const { data: updatedStory, error: updateError } = await supabaseAdmin
        .from('chimera_stories')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('[Chimera Stories] Error patching story:', updateError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to update story',
          req
        );
      }

      return sendSuccess(res, updatedStory, req);

    } catch (error) {
      console.error('[Chimera Stories] Unexpected error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Internal server error',
        req
      );
    }
  }
);

/**
 * POST /api/v2/chimera/stories/:id/rebuild
 * Rebuild/compile the story's ruleset by merging all linked ruleset templates
 * Owner-only endpoint
 */
router.post(
  '/:id/rebuild',
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

      const { id: storyId } = req.params;

      // Use the rebuild service to compile the story
      // Use the V3 Compiler Service
      // Update story configuration with new entity IDs if provided
      if (req.body.entity_ids && Array.isArray(req.body.entity_ids)) {
        // We need to fetch current config first to merge
        const { data: currentStory } = await supabaseAdmin
          .from('chimera_stories')
          .select('configuration')
          .eq('id', storyId)
          .single();

        if (currentStory) {
          const currentConfig = (currentStory.configuration as any) || {};
          const updatedConfig = { ...currentConfig, entityIds: req.body.entity_ids };

          await supabaseAdmin
            .from('chimera_stories')
            .update({ configuration: updatedConfig })
            .eq('id', storyId);
        }
      }

      const result = await StoryCompilerService.compileStory(storyId, userId, req.body.entity_ids);

      return sendSuccess(res, result, req);
    } catch (error) {
      console.error('[Chimera Stories] Unexpected error in rebuild:', error);

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message === 'Story not found') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            error.message,
            req
          );
        }
        if (error.message.includes('permission')) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.FORBIDDEN,
            error.message,
            req
          );
        }
        if (error.message.includes('MAIN_SYSTEM')) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.VALIDATION_FAILED,
            error.message,
            req
          );
        }
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          error.message || 'Internal server error',
          req
        );
      }

      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Internal server error',
        req
      );
    }
  }
);

/**
 * PUT /api/v2/chimera/stories/:id/definition
 * Update only the story_definition JSON (for Story Editor tab)
 */
router.put(
  '/:id/definition',
  validateRequest(TextIdParamSchema, 'params'),
  validateRequest(UpdateStoryDefinitionSchema),
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

      const { id } = req.params;
      const { story_definition } = req.body;

      // Check ownership
      const { data: existingStory, error: fetchError } = await supabaseAdmin
        .from('chimera_stories')
        .select('owner_user_id')
        .eq('id', id)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Story not found',
            req
          );
        }
        console.error('[Chimera Stories] Error checking ownership:', fetchError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to check ownership',
          req
        );
      }

      if (existingStory.owner_user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'Only the owner can update this story',
          req
        );
      }

      // Update only story_definition
      const { error: updateError } = await supabaseAdmin
        .from('chimera_stories')
        .update({
          story_definition,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) {
        console.error('[Chimera Stories] Error updating story definition:', updateError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to update story definition',
          req
        );
      }

      // Fetch updated story
      const { data: updatedStory, error: fetchUpdatedError } = await supabaseAdmin
        .from('chimera_stories')
        .select('id, story_definition, updated_at')
        .eq('id', id)
        .single();

      if (fetchUpdatedError) {
        console.error('[Chimera Stories] Error fetching updated story:', fetchUpdatedError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Story definition updated but failed to fetch',
          req
        );
      }

      return sendSuccess(res, updatedStory, req);
    } catch (error) {
      console.error('[Chimera Stories] Unexpected error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Internal server error',
        req
      );
    }
  }
);

/**
 * DELETE /api/v2/chimera/stories/:id
 * Delete a story (owner-only)
 */
router.delete(
  '/:id',
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

      const { id } = req.params;

      // Check ownership
      const { data: existingStory, error: fetchError } = await supabaseAdmin
        .from('chimera_stories')
        .select('owner_user_id')
        .eq('id', id)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Story not found',
            req
          );
        }
        console.error('[Chimera Stories] Error checking ownership:', fetchError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to check ownership',
          req
        );
      }

      if (existingStory.owner_user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'Only the owner can delete this story',
          req
        );
      }

      // Delete story (cascade will handle links)
      const { error } = await supabaseAdmin
        .from('chimera_stories')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[Chimera Stories] Error deleting story:', error);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to delete story',
          req
        );
      }

      return sendSuccess(res, { id, deleted: true }, req);
    } catch (error) {
      console.error('[Chimera Stories] Unexpected error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Internal server error',
        req
      );
    }
  }
);

/**
 * POST /api/v2/chimera/stories/:id/links/entities
 * Link an entity template to a story
 */
router.post(
  '/:id/links/entities',
  validateRequest(TextIdParamSchema, 'params'),
  validateRequest(z.object({
    entity_template_id: z.string().min(1),
  })),
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

      const { id: story_id } = req.params;
      const { entity_template_id } = req.body;

      // Check story ownership
      const { data: story, error: storyError } = await supabaseAdmin
        .from('chimera_stories')
        .select('owner_user_id')
        .eq('id', story_id)
        .single();

      if (storyError || !story) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Story not found',
          req
        );
      }

      if (story.owner_user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'You do not have permission to modify this story',
          req
        );
      }

      // Verify entity template exists and user has access
      const { data: entity, error: entityError } = await supabaseAdmin
        .from('chimera_entities')
        .select('id, owner_user_id, visibility')
        .eq('id', entity_template_id)
        .single();

      if (entityError || !entity) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Entity template not found',
          req
        );
      }

      // Check ownership or public visibility
      if (entity.owner_user_id !== userId && entity.visibility !== 'public') {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'You do not have permission to use this entity template',
          req
        );
      }

      // Check if link already exists
      const { data: existingLink, error: checkError } = await supabaseAdmin
        .from('chimera_story_entity_links')
        .select('story_id, entity_template_id')
        .eq('story_id', story_id)
        .eq('entity_template_id', entity_template_id)
        .single();

      if (existingLink) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.CONFLICT,
          'Entity is already linked to this story',
          req
        );
      }

      // Create the link
      const { data: link, error: linkError } = await supabaseAdmin
        .from('chimera_story_entity_links')
        .insert({
          story_id,
          entity_template_id,
        })
        .select()
        .single();

      if (linkError) {
        console.error('[Chimera Stories] Error creating entity link:', linkError);
        if (linkError.code === '23505') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.CONFLICT,
            'Entity is already linked to this story',
            req
          );
        }
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to create entity link',
          req
        );
      }

      return sendSuccess(res, link, req);
    } catch (error) {
      console.error('[Chimera Stories] Unexpected error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Internal server error',
        req
      );
    }
  }
);

/**
 * DELETE /api/v2/chimera/stories/:id/links/entities/:entity_id
 * Remove an entity link from a story
 */
router.delete(
  '/:id/links/entities/:entity_id',
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

      const { id: story_id, entity_id: entity_template_id } = req.params;

      // Check story ownership
      const { data: story, error: storyError } = await supabaseAdmin
        .from('chimera_stories')
        .select('owner_user_id')
        .eq('id', story_id)
        .single();

      if (storyError || !story) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Story not found',
          req
        );
      }

      if (story.owner_user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'You do not have permission to modify this story',
          req
        );
      }

      // Delete the link
      const { error: deleteError } = await supabaseAdmin
        .from('chimera_story_entity_links')
        .delete()
        .eq('story_id', story_id)
        .eq('entity_template_id', entity_template_id);

      if (deleteError) {
        console.error('[Chimera Stories] Error deleting entity link:', deleteError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to delete entity link',
          req
        );
      }

      return sendSuccess(res, { story_id, entity_template_id, deleted: true }, req);
    } catch (error) {
      console.error('[Chimera Stories] Unexpected error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Internal server error',
        req
      );
    }
  }
);

/**
 * POST /api/v2/chimera/stories/:id/bind
 * Bind Fate (Compile Story)
 */
router.post(
  '/:id/bind',
  validateRequest(TextIdParamSchema, 'params'),
  async (req: Request, res: Response) => {
    console.log(`[API] Bind Fate triggered for Story ID: ${req.params.id}`);
    try {
      const userId = req.ctx?.userId;
      if (!userId) {
        return sendErrorWithStatus(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', req);
      }
      const { id } = req.params;

      // Ownership check
      const { data: story, error } = await supabaseAdmin
        .from('chimera_stories')
        .select('owner_user_id, configuration')
        .eq('id', id)
        .single();

      if (error || !story) {
        return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'Story not found', req);
      }
      if (story.owner_user_id !== userId) {
        return sendErrorWithStatus(res, ApiErrorCode.FORBIDDEN, 'Access denied', req);
      }

      // Update story configuration with new entity IDs if provided
      if (req.body.entity_ids && Array.isArray(req.body.entity_ids)) {
        console.log(`[API] Bind Fate: Updating entities to ${req.body.entity_ids.length} IDs`);

        const currentConfig = (story.configuration as any) || {};
        const updatedConfig = {
          ...currentConfig,
          entityIds: req.body.entity_ids
        };

        const { error: updateError } = await supabaseAdmin
          .from('chimera_stories')
          .update({ configuration: updatedConfig })
          .eq('id', id);

        if (updateError) {
          console.error('[Chimera Bind] Failed to persist entity IDs:', updateError);
          throw new Error('Failed to update story configuration');
        }
      }

      await StoryCompilerService.compileStory(id, userId, req.body.entity_ids);
      return sendSuccess(res, { success: true }, req);

    } catch (error: any) {
      console.error('[Chimera Bind] Error:', error);
      // Return 400 for validation errors as requested, or 500 otherwise
      // Compiler throws "Validation Error..." strings often, or general Errors
      const status = error.message.includes('Validation') ? ApiErrorCode.VALIDATION_FAILED : ApiErrorCode.INTERNAL_ERROR;

      return sendErrorWithStatus(
        res,
        status === ApiErrorCode.VALIDATION_FAILED ? ApiErrorCode.VALIDATION_FAILED : ApiErrorCode.INTERNAL_ERROR,
        error.message || 'Bind failed',
        req
      );
    }
  }
);

export default router;
