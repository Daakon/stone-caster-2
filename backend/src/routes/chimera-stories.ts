/**
 * @swagger
 * tags:
 *   - name: Chimera V2 Stories
 *     description: User-facing CRUD endpoints for Chimera stories
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { supabaseAdmin } from '../services/supabase.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Custom schema for text-based IDs (not UUIDs)
const TextIdParamSchema = z.object({
  id: z.string().min(1).max(200),
});

// Zod schemas for validation
const VisibilitySchema = z.enum(['private', 'pending_approval', 'public']);

const CreateStorySchema = z.object({
  display_name: z.string().min(1).max(200),
  description_short: z.string().max(500).optional().nullable(),
  world_id: z.string().min(1).optional().nullable(),
  ruleset_template_ids: z.array(z.string()).default([]),
  pack_ids: z.array(z.string()).default([]),
});

const UpdateStorySchema = CreateStorySchema.partial().extend({
  visibility: VisibilitySchema.optional(),
  story_definition: z.record(z.unknown()).optional(),
});

const UpdateStoryDefinitionSchema = z.object({
  story_definition: z.record(z.unknown()),
});

// Generate ID (using simple timestamp-based approach, can be replaced with CUID)
function generateId(): string {
  return `chimera_story_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
        world:chimera_worlds(id, display_name),
        ruleset_links:chimera_story_links(ruleset_template_id),
        entity_links:chimera_story_entity_links(entity_template_id)
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

    return sendSuccess(res, stories || [], req);
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

      // Create the story - always set visibility to 'private' for new stories
      const { data: story, error: storyError } = await supabaseAdmin
        .from('chimera_stories')
        .insert({
          id,
          owner_user_id: userId,
          display_name: storyData.display_name,
          description_short: storyData.description_short,
          world_id: storyData.world_id || null,
          visibility: 'private', // Always private for new stories
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
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

      // Create ruleset links
      if (storyData.ruleset_template_ids && storyData.ruleset_template_ids.length > 0) {
        const rulesetLinks = storyData.ruleset_template_ids.map((rulesetId: string) => ({
          story_id: id,
          ruleset_template_id: rulesetId,
        }));

        const { error: linksError } = await supabaseAdmin
          .from('chimera_story_links')
          .insert(rulesetLinks);

        if (linksError) {
          console.error('[Chimera Stories] Error creating ruleset links:', linksError);
          // Rollback story creation
          await supabaseAdmin.from('chimera_stories').delete().eq('id', id);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to create ruleset links',
            req
          );
        }
      }

      // Create pack links
      if (storyData.pack_ids && storyData.pack_ids.length > 0) {
        const packLinks = storyData.pack_ids.map((packId: string) => ({
          story_id: id,
          pack_id: packId,
        }));

        const { error: packLinksError } = await supabaseAdmin
          .from('chimera_story_content_pack_links')
          .insert(packLinks);

        if (packLinksError) {
          console.error('[Chimera Stories] Error creating pack links:', packLinksError);
          // Rollback story creation and ruleset links
          await supabaseAdmin.from('chimera_story_links').delete().eq('story_id', id);
          await supabaseAdmin.from('chimera_stories').delete().eq('id', id);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to create pack links',
            req
          );
        }
      }

      // Fetch the complete story with relations
      const { data: completeStory, error: fetchError } = await supabaseAdmin
        .from('chimera_stories')
        .select(`
          *,
          world:chimera_worlds(id, display_name),
          ruleset_links:chimera_story_links(ruleset_template_id),
          entity_links:chimera_story_entity_links(entity_template_id)
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

      return sendSuccess(res, completeStory, req);
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
          world:chimera_worlds(id, display_name, description_short),
          ruleset_links:chimera_story_links(ruleset_template_id),
          pack_links:chimera_story_content_pack_links(pack_id)
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

      // Check access: user must be owner OR visibility must be public
      if (story.owner_user_id !== userId && story.visibility !== 'public') {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'You do not have permission to view this story',
          req
        );
      }

      return sendSuccess(res, story, req);
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
      if (updateData.world_id !== undefined) {
        if (updateData.world_id) {
          const { data: world, error: worldError } = await supabaseAdmin
            .from('chimera_worlds')
            .select('id, owner_user_id, visibility')
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
        }
      }

      // Build update payload
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updateData.display_name !== undefined) {
        updatePayload.display_name = updateData.display_name;
      }
      if (updateData.description_short !== undefined) {
        updatePayload.description_short = updateData.description_short;
      }
      if (updateData.world_id !== undefined) {
        updatePayload.world_id = updateData.world_id || null;
      }
      if (updateData.visibility !== undefined) {
        updatePayload.visibility = updateData.visibility;
      }
      if (updateData.story_definition !== undefined) {
        updatePayload.story_definition = updateData.story_definition;
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

      // Handle ruleset links diffing
      if (updateData.ruleset_template_ids !== undefined) {
        // Get current links
        const { data: currentLinks, error: currentLinksError } = await supabaseAdmin
          .from('chimera_story_links')
          .select('ruleset_template_id')
          .eq('story_id', id);

        if (currentLinksError) {
          console.error('[Chimera Stories] Error fetching current ruleset links:', currentLinksError);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to fetch current ruleset links',
            req
          );
        }

        const currentIds = new Set((currentLinks || []).map((l) => l.ruleset_template_id));
        const newIds = new Set(updateData.ruleset_template_ids);

        // Find IDs to add
        const toAdd = Array.from(newIds).filter((id) => !currentIds.has(id));
        // Find IDs to remove
        const toRemove = Array.from(currentIds).filter((id) => !newIds.has(id));

        // Remove old links
        if (toRemove.length > 0) {
          const { error: deleteError } = await supabaseAdmin
            .from('chimera_story_links')
            .delete()
            .eq('story_id', id)
            .in('ruleset_template_id', Array.from(toRemove));

          if (deleteError) {
            console.error('[Chimera Stories] Error deleting ruleset links:', deleteError);
            return sendErrorWithStatus(
              res,
              ApiErrorCode.INTERNAL_ERROR,
              'Failed to update ruleset links',
              req
            );
          }
        }

        // Add new links
        if (toAdd.length > 0) {
          const newLinks = toAdd.map((rulesetId) => ({
            story_id: id,
            ruleset_template_id: rulesetId,
          }));

          const { error: insertError } = await supabaseAdmin
            .from('chimera_story_links')
            .insert(newLinks);

          if (insertError) {
            console.error('[Chimera Stories] Error inserting ruleset links:', insertError);
            return sendErrorWithStatus(
              res,
              ApiErrorCode.INTERNAL_ERROR,
              'Failed to update ruleset links',
              req
            );
          }
        }
      }

      // Handle pack links diffing
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

      // Fetch the complete updated story
      const { data: updatedStory, error: fetchError } = await supabaseAdmin
        .from('chimera_stories')
        .select(`
          *,
          world:chimera_worlds(id, display_name),
          ruleset_links:chimera_story_links(ruleset_template_id),
          entity_links:chimera_story_entity_links(entity_template_id)
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

      // Step 1: Fetch the story and verify ownership
      const { data: story, error: storyError } = await supabaseAdmin
        .from('chimera_stories')
        .select('id, owner_user_id, world_id')
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
        console.error('[Chimera Stories] Error fetching story:', storyError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch story',
          req
        );
      }

      if (story.owner_user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'You do not have permission to rebuild this story',
          req
        );
      }

      // Step 2: Fetch all linked ruleset_template_ids for this story
      const { data: storyLinks, error: storyLinksError } = await supabaseAdmin
        .from('chimera_story_links')
        .select('ruleset_template_id')
        .eq('story_id', storyId);

      if (storyLinksError) {
        console.error('[Chimera Stories] Error fetching story links:', storyLinksError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch story ruleset links',
          req
        );
      }

      const storyRulesetIds = (storyLinks || []).map((link) => link.ruleset_template_id);

      // Step 3: Fetch world ruleset_template_ids if story has a world
      let worldRulesetIds: string[] = [];
      if (story.world_id) {
        const { data: worldLinks, error: worldLinksError } = await supabaseAdmin
          .from('chimera_world_ruleset_link')
          .select('ruleset_template_id')
          .eq('world_id', story.world_id);

        if (worldLinksError) {
          console.error('[Chimera Stories] Error fetching world links:', worldLinksError);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to fetch world ruleset links',
            req
          );
        }

        worldRulesetIds = (worldLinks || []).map((link) => link.ruleset_template_id);
      }

      // Step 4: Fetch content pack links and resolve dependencies
      const { data: packLinks, error: packLinksError } = await supabaseAdmin
        .from('chimera_story_content_pack_links')
        .select('pack_id')
        .eq('story_id', storyId);

      if (packLinksError) {
        console.error('[Chimera Stories] Error fetching pack links:', packLinksError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch content pack links',
          req
        );
      }

      const packIds = (packLinks || []).map((link) => link.pack_id);
      const allPackIds = new Set<string>(packIds);

      // Resolve all pack dependencies recursively
      if (allPackIds.size > 0) {
        const packsToProcess = Array.from(allPackIds);
        const processedPacks = new Set<string>();

        while (packsToProcess.length > 0) {
          const currentPackId = packsToProcess.pop()!;
          if (processedPacks.has(currentPackId)) continue;
          processedPacks.add(currentPackId);

          // Fetch dependencies for this pack
          const { data: dependencies, error: depsError } = await supabaseAdmin
            .from('chimera_pack_dependencies')
            .select('depends_on_pack_id')
            .eq('pack_id', currentPackId);

          if (!depsError && dependencies) {
            for (const dep of dependencies) {
              if (!allPackIds.has(dep.depends_on_pack_id)) {
                allPackIds.add(dep.depends_on_pack_id);
                packsToProcess.push(dep.depends_on_pack_id);
              }
            }
          }
        }
      }

      // Step 5: Fetch ruleset_template_ids from all content packs
      let packRulesetIds: string[] = [];
      if (allPackIds.size > 0) {
        const { data: packRulesetLinks, error: packRulesetLinksError } = await supabaseAdmin
          .from('chimera_content_pack_ruleset_links')
          .select('ruleset_template_id')
          .in('pack_id', Array.from(allPackIds));

        if (packRulesetLinksError) {
          console.error('[Chimera Stories] Error fetching pack ruleset links:', packRulesetLinksError);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to fetch content pack ruleset links',
            req
          );
        }

        packRulesetIds = (packRulesetLinks || []).map((link) => link.ruleset_template_id);
      }

      // Step 6: Get all unique ruleset_template_ids
      const allRulesetIds = Array.from(new Set([...storyRulesetIds, ...worldRulesetIds, ...packRulesetIds]));

      if (allRulesetIds.length === 0) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'No ruleset templates linked to this story or its world',
          req
        );
      }

      // Step 7: Fetch all ruleset templates with their definitions
      const { data: rulesetTemplates, error: templatesError } = await supabaseAdmin
        .from('chimera_ruleset_templates')
        .select('id, rule_type, main_system_dependency, definition, version')
        .in('id', allRulesetIds);

      if (templatesError) {
        console.error('[Chimera Stories] Error fetching ruleset templates:', templatesError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch ruleset templates',
          req
        );
      }

      if (!rulesetTemplates || rulesetTemplates.length === 0) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'No valid ruleset templates found',
          req
        );
      }

      // Step 8: Build the load order
      // Order: Main System -> Subsystems -> World Modifiers -> Content Pack Modifiers
      const mainSystem = rulesetTemplates.find((t) => t.rule_type === 'MAIN_SYSTEM');
      if (!mainSystem) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Story must have a MAIN_SYSTEM ruleset template',
          req
        );
      }

      const mainSystemId = mainSystem.id;
      const subsystems = rulesetTemplates.filter(
        (t) => t.rule_type === 'SUBSYSTEM' && t.main_system_dependency === mainSystemId
      );
      const worldModifiers = rulesetTemplates.filter(
        (t) => t.rule_type === 'MODIFIER' && worldRulesetIds.includes(t.id)
      );
      const packModifiers = rulesetTemplates.filter(
        (t) => t.rule_type === 'MODIFIER' && packRulesetIds.includes(t.id)
      );

      // Build load order array
      const loadOrder: Array<{ id: string; version: number; definition: Record<string, unknown> }> = [
        { id: mainSystem.id, version: mainSystem.version, definition: mainSystem.definition as Record<string, unknown> },
        ...subsystems.map((s) => ({
          id: s.id,
          version: s.version,
          definition: s.definition as Record<string, unknown>,
        })),
        ...worldModifiers.map((w) => ({
          id: w.id,
          version: w.version,
          definition: w.definition as Record<string, unknown>,
        })),
        ...packModifiers.map((p) => ({
          id: p.id,
          version: p.version,
          definition: p.definition as Record<string, unknown>,
        })),
      ];

      // Step 7: Fetch story_definition from the story
      const { data: storyWithDefinition, error: storyDefError } = await supabaseAdmin
        .from('chimera_stories')
        .select('story_definition')
        .eq('id', storyId)
        .single();

      if (storyDefError) {
        console.error('[Chimera Stories] Error fetching story definition:', storyDefError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch story definition',
          req
        );
      }

      // Step 8: Merge JSON objects (last one wins for key conflicts)
      // Order: Rulesets (in load order) -> Story Definition (highest priority)
      let compiledJson: Record<string, unknown> = {};
      for (const item of loadOrder) {
        compiledJson = { ...compiledJson, ...item.definition };
      }
      
      // Finally, merge story_definition (highest priority, overrides everything)
      if (storyWithDefinition?.story_definition && typeof storyWithDefinition.story_definition === 'object') {
        compiledJson = { ...compiledJson, ...(storyWithDefinition.story_definition as Record<string, unknown>) };
      }

      // Step 9: Build source manifest
      const sourceManifest = loadOrder.map((item) => ({
        id: item.id,
        version: item.version,
      }));

      // Step 10: Save to chimera_story_compiled_ruleset (upsert)
      const { data: compiledData, error: saveError } = await supabaseAdmin
        .from('chimera_story_compiled_ruleset')
        .upsert(
          {
            story_id: storyId,
            compiled_json: compiledJson,
            source_manifest: sourceManifest,
            last_compiled_at: new Date().toISOString(),
          },
          {
            onConflict: 'story_id',
          }
        )
        .select()
        .single();

      if (saveError) {
        console.error('[Chimera Stories] Error saving compiled ruleset:', saveError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to save compiled ruleset',
          req
        );
      }

      return sendSuccess(
        res,
        {
          story_id: storyId,
          compiled_json: compiledJson,
          source_manifest: sourceManifest,
          last_compiled_at: compiledData.last_compiled_at,
        },
        req
      );
    } catch (error) {
      console.error('[Chimera Stories] Unexpected error in rebuild:', error);
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

export default router;

