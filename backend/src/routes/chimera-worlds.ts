/**
 * @swagger
 * tags:
 *   - name: Chimera V2 Worlds
 *     description: User-facing CRUD endpoints for Chimera worlds
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { supabaseAdmin } from '../services/supabase.js';

const router = Router();

// Custom schema for text-based IDs (not UUIDs)
const TextIdParamSchema = z.object({
  id: z.string().min(1).max(200),
});

// All routes require authentication
router.use(authenticateToken);

// Zod schemas for validation
const VisibilitySchema = z.enum(['private', 'pending_approval', 'public']);

// CreateWorldSchema does not include visibility - it's always set to 'private' on creation
const CreateWorldSchema = z.object({
  display_name: z.string().min(1).max(200),
  description_short: z.string().max(500).optional().nullable(),
  description_long: z.string().optional().nullable(),
  character_schema_contributions: z.record(z.unknown()).optional().default({}),
  ruleset_template_ids: z.array(z.string()).default([]),
  tag_names: z.array(z.string()).default([]),
});

// UpdateWorldSchema explicitly excludes visibility - it can only be changed via publish endpoint
const UpdateWorldSchema = CreateWorldSchema.partial().omit({ visibility: true });

// Helper function to normalize tag names
function normalizeTagName(tagName: string): string {
  return tagName
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
}

// Generate ID (using simple timestamp-based approach, can be replaced with CUID)
function generateId(): string {
  return `chimera_world_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * POST /api/v2/chimera/worlds
 * Create a new world
 */
router.post(
  '/',
  validateRequest(CreateWorldSchema),
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

      const worldData = req.body;
      const id = generateId();

      // Validate that all ruleset_template_ids reference MODIFIER templates
      if (worldData.ruleset_template_ids && worldData.ruleset_template_ids.length > 0) {
        const { data: templates, error: templatesError } = await supabaseAdmin
          .from('chimera_ruleset_templates')
          .select('id, rule_type')
          .in('id', worldData.ruleset_template_ids);

        if (templatesError) {
          console.error('[Chimera Worlds] Error validating ruleset templates:', templatesError);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to validate ruleset templates',
            req
          );
        }

        if (!templates || templates.length !== worldData.ruleset_template_ids.length) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.VALIDATION_FAILED,
            'One or more ruleset template IDs are invalid',
            req
          );
        }

        const invalidTypes = templates.filter(t => t.rule_type !== 'MODIFIER');
        if (invalidTypes.length > 0) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.VALIDATION_FAILED,
            'Only MODIFIER ruleset templates can be linked to worlds',
            req
          );
        }
      }

      // Create the world - always set visibility to 'private' for new worlds
      const { data: world, error: worldError } = await supabaseAdmin
        .from('chimera_worlds')
        .insert({
          id,
          owner_user_id: userId,
          display_name: worldData.display_name,
          description_short: worldData.description_short,
          description_long: worldData.description_long,
          character_schema_contributions: worldData.character_schema_contributions || {},
          visibility: 'private', // Always private for new worlds
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (worldError) {
        console.error('[Chimera Worlds] Error creating world:', worldError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to create world',
          req
        );
      }

      // Create ruleset links if provided
      if (worldData.ruleset_template_ids && worldData.ruleset_template_ids.length > 0) {
        const links = worldData.ruleset_template_ids.map((templateId: string) => ({
          world_id: id,
          ruleset_template_id: templateId,
          created_at: new Date().toISOString(),
        }));

        const { error: linksError } = await supabaseAdmin
          .from('chimera_world_ruleset_link')
          .insert(links);

        if (linksError) {
          console.error('[Chimera Worlds] Error creating ruleset links:', linksError);
          // Rollback world creation
          await supabaseAdmin.from('chimera_worlds').delete().eq('id', id);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to create ruleset links',
            req
          );
        }
      }

      // Handle tags: normalize, create/get tags, and create links
      if (worldData.tag_names && worldData.tag_names.length > 0) {
        const tagIds: string[] = [];

        for (const tagName of worldData.tag_names) {
          const normalized = normalizeTagName(tagName);
          if (!normalized) continue;

          // Check if tag exists
          let { data: existingTag } = await supabaseAdmin
            .from('chimera_tags')
            .select('id')
            .eq('tag_name', normalized)
            .single();

          let tagId: string;

          if (existingTag) {
            tagId = existingTag.id;
          } else {
            // Create new tag (unapproved)
            const { data: newTag, error: tagError } = await supabaseAdmin
              .from('chimera_tags')
              .insert({
                tag_name: normalized,
                is_approved: false,
              })
              .select('id')
              .single();

            if (tagError) {
              console.error('[Chimera Worlds] Error creating tag:', tagError);
              continue;
            }
            tagId = newTag.id;
          }

          tagIds.push(tagId);
        }

        // Create asset tag links
        if (tagIds.length > 0) {
          const assetTagLinks = tagIds.map((tagId) => ({
            tag_id: tagId,
            asset_id: id,
            asset_type: 'world',
          }));

          const { error: linksError } = await supabaseAdmin
            .from('chimera_asset_tags')
            .insert(assetTagLinks);

          if (linksError) {
            console.error('[Chimera Worlds] Error creating tag links:', linksError);
            // Continue anyway - world is created, tags can be fixed later
          }
        }
      }

      // Fetch world with ruleset links
      const { data: worldWithLinks } = await supabaseAdmin
        .from('chimera_worlds')
        .select(`
          *,
          ruleset_links:chimera_world_ruleset_link(ruleset_template_id)
        `)
        .eq('id', id)
        .single();

      return sendSuccess(res, worldWithLinks || world, req);
    } catch (error) {
      console.error('[Chimera Worlds] Unexpected error:', error);
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
 * GET /api/v2/chimera/worlds/selectable
 * Get all selectable worlds (public or owned by user)
 */
router.get(
  '/selectable',
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

      const { data, error } = await supabaseAdmin
        .from('chimera_worlds')
        .select('id, display_name, version, visibility')
        .or(`visibility.eq.public,owner_user_id.eq.${userId}`)
        .order('display_name', { ascending: true });

      if (error) {
        console.error('[Chimera Worlds] Error fetching selectable worlds:', error);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch selectable worlds',
          req
        );
      }

      return sendSuccess(res, data || [], req);
    } catch (error) {
      console.error('[Chimera Worlds] Unexpected error:', error);
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
 * GET /api/v2/chimera/worlds/my-creations
 * Get all worlds owned by the current user
 */
router.get(
  '/my-creations',
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

      const { data, error } = await supabaseAdmin
        .from('chimera_worlds')
        .select(`
          *,
          ruleset_links:chimera_world_ruleset_link(ruleset_template_id)
        `)
        .eq('owner_user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Chimera Worlds] Error fetching user worlds:', error);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch worlds',
          req
        );
      }

      return sendSuccess(res, data || [], req);
    } catch (error) {
      console.error('[Chimera Worlds] Unexpected error:', error);
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
 * GET /api/v2/chimera/worlds/:id/rulesets
 * Get rulesets linked to a world
 */
router.get(
  '/:id/rulesets',
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

      // Get world to check access
      const { data: world, error: worldError } = await supabaseAdmin
        .from('chimera_worlds')
        .select('id, owner_user_id, visibility')
        .eq('id', id)
        .single();

      if (worldError) {
        if (worldError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'World not found',
            req
          );
        }
        console.error('[Chimera Worlds] Error fetching world:', worldError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch world',
          req
        );
      }

      // Check access: user must be owner OR visibility must be public
      if (world.owner_user_id !== userId && world.visibility !== 'public') {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'You do not have permission to view this world',
          req
        );
      }

      // Get linked ruleset template IDs
      const { data: links, error: linksError } = await supabaseAdmin
        .from('chimera_world_ruleset_link')
        .select('ruleset_template_id')
        .eq('world_id', id);

      if (linksError) {
        console.error('[Chimera Worlds] Error fetching ruleset links:', linksError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch ruleset links',
          req
        );
      }

      const rulesetIds = (links || []).map((l) => l.ruleset_template_id);

      if (rulesetIds.length === 0) {
        return sendSuccess(res, [], req);
      }

      // Get full ruleset template details
      const { data: rulesets, error: rulesetsError } = await supabaseAdmin
        .from('chimera_ruleset_templates')
        .select('*')
        .in('id', rulesetIds);

      if (rulesetsError) {
        console.error('[Chimera Worlds] Error fetching ruleset templates:', rulesetsError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch ruleset templates',
          req
        );
      }

      return sendSuccess(res, rulesets || [], req);
    } catch (error) {
      console.error('[Chimera Worlds] Unexpected error:', error);
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
 * GET /api/v2/chimera/worlds/:id
 * Get a single world (ownership-aware)
 */
router.get(
  '/:id',
  validateRequest(TextIdParamSchema, 'params'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.ctx?.userId;

      const { data: world, error: worldError } = await supabaseAdmin
        .from('chimera_worlds')
        .select(`
          *,
          ruleset_links:chimera_world_ruleset_link(ruleset_template_id)
        `)
        .eq('id', id)
        .single();

      // Fetch tags
      const { data: assetTags } = await supabaseAdmin
        .from('chimera_asset_tags')
        .select(`
          tag:chimera_tags!tag_id(id, tag_name)
        `)
        .eq('asset_id', id)
        .eq('asset_type', 'world');

      if (assetTags) {
        (world as any).tags = assetTags
          .map((link: any) => link.tag)
          .filter((tag: any) => tag !== null);
      }

      if (worldError) {
        if (worldError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'World not found',
            req
          );
        }
        console.error('[Chimera Worlds] Error fetching world:', worldError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch world',
          req
        );
      }

      // Check access: user must be owner OR visibility must be public
      if (world.owner_user_id !== userId && world.visibility !== 'public') {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'Access denied',
          req
        );
      }

      return sendSuccess(res, world, req);
    } catch (error) {
      console.error('[Chimera Worlds] Unexpected error:', error);
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
 * PUT /api/v2/chimera/worlds/:id
 * Update a world (owner-only) and handle ruleset links
 */
router.put(
  '/:id',
  validateRequest(TextIdParamSchema, 'params'),
  validateRequest(UpdateWorldSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.ctx?.userId;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      // Check ownership
      const { data: existingWorld, error: fetchError } = await supabaseAdmin
        .from('chimera_worlds')
        .select('owner_user_id')
        .eq('id', id)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'World not found',
            req
          );
        }
        console.error('[Chimera Worlds] Error checking ownership:', fetchError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to check ownership',
          req
        );
      }

      if (existingWorld.owner_user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'Only the owner can update this world',
          req
        );
      }

      const updateData = req.body;

      // Validate ruleset_template_ids if provided
      if (updateData.ruleset_template_ids !== undefined) {
        if (updateData.ruleset_template_ids.length > 0) {
          const { data: templates, error: templatesError } = await supabaseAdmin
            .from('chimera_ruleset_templates')
            .select('id, rule_type')
            .in('id', updateData.ruleset_template_ids);

          if (templatesError) {
            console.error('[Chimera Worlds] Error validating ruleset templates:', templatesError);
            return sendErrorWithStatus(
              res,
              ApiErrorCode.INTERNAL_ERROR,
              'Failed to validate ruleset templates',
              req
            );
          }

          if (!templates || templates.length !== updateData.ruleset_template_ids.length) {
            return sendErrorWithStatus(
              res,
              ApiErrorCode.VALIDATION_FAILED,
              'One or more ruleset template IDs are invalid',
              req
            );
          }

          const invalidTypes = templates.filter(t => t.rule_type !== 'MODIFIER');
          if (invalidTypes.length > 0) {
            return sendErrorWithStatus(
              res,
              ApiErrorCode.VALIDATION_FAILED,
              'Only MODIFIER ruleset templates can be linked to worlds',
              req
            );
          }
        }
      }

      // Update world fields (excluding ruleset_template_ids, tag_names, and visibility)
      // Visibility can only be changed via a separate publish endpoint, not through this update endpoint
      const { ruleset_template_ids, tag_names, visibility, ...worldUpdateData } = updateData;
      
      if (Object.keys(worldUpdateData).length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('chimera_worlds')
          .update({
            ...worldUpdateData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (updateError) {
          console.error('[Chimera Worlds] Error updating world:', updateError);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to update world',
            req
          );
        }
      }

      // Handle ruleset links if provided
      if (ruleset_template_ids !== undefined) {
        // Get current links
        const { data: currentLinks, error: linksError } = await supabaseAdmin
          .from('chimera_world_ruleset_link')
          .select('ruleset_template_id')
          .eq('world_id', id);

        if (linksError) {
          console.error('[Chimera Worlds] Error fetching current links:', linksError);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to fetch current links',
            req
          );
        }

        const currentIds = (currentLinks || []).map((link: any) => link.ruleset_template_id);
        const newIds = ruleset_template_ids as string[];

        // Find IDs to delete (in current but not in new)
        const idsToDelete = currentIds.filter((id: string) => !newIds.includes(id));
        if (idsToDelete.length > 0) {
          const { error: deleteError } = await supabaseAdmin
            .from('chimera_world_ruleset_link')
            .delete()
            .eq('world_id', id)
            .in('ruleset_template_id', idsToDelete);

          if (deleteError) {
            console.error('[Chimera Worlds] Error deleting links:', deleteError);
            return sendErrorWithStatus(
              res,
              ApiErrorCode.INTERNAL_ERROR,
              'Failed to delete ruleset links',
              req
            );
          }
        }

        // Find IDs to add (in new but not in current)
        const idsToAdd = newIds.filter((id: string) => !currentIds.includes(id));
        if (idsToAdd.length > 0) {
          const links = idsToAdd.map((templateId: string) => ({
            world_id: id,
            ruleset_template_id: templateId,
            created_at: new Date().toISOString(),
          }));

          const { error: insertError } = await supabaseAdmin
            .from('chimera_world_ruleset_link')
            .insert(links);

          if (insertError) {
            console.error('[Chimera Worlds] Error creating links:', insertError);
            return sendErrorWithStatus(
              res,
              ApiErrorCode.INTERNAL_ERROR,
              'Failed to create ruleset links',
              req
            );
          }
        }
      }

      // Handle tags if provided
      if (tag_names !== undefined) {
        // Delete existing tag links
        await supabaseAdmin
          .from('chimera_asset_tags')
          .delete()
          .eq('asset_id', id)
          .eq('asset_type', 'world');

        // Create new tag links
        if (tag_names.length > 0) {
          const tagIds: string[] = [];

          for (const tagName of tag_names) {
            const normalized = normalizeTagName(tagName);
            if (!normalized) continue;

            // Check if tag exists
            let { data: existingTag } = await supabaseAdmin
              .from('chimera_tags')
              .select('id')
              .eq('tag_name', normalized)
              .single();

            let tagId: string;

            if (existingTag) {
              tagId = existingTag.id;
            } else {
              // Create new tag (unapproved)
              const { data: newTag, error: tagError } = await supabaseAdmin
                .from('chimera_tags')
                .insert({
                  tag_name: normalized,
                  is_approved: false,
                })
                .select('id')
                .single();

              if (tagError) {
                console.error('[Chimera Worlds] Error creating tag:', tagError);
                continue;
              }
              tagId = newTag.id;
            }

            tagIds.push(tagId);
          }

          // Create asset tag links
          if (tagIds.length > 0) {
            const assetTagLinks = tagIds.map((tagId) => ({
              tag_id: tagId,
              asset_id: id,
              asset_type: 'world',
            }));

            const { error: linksError } = await supabaseAdmin
              .from('chimera_asset_tags')
              .insert(assetTagLinks);

            if (linksError) {
              console.error('[Chimera Worlds] Error creating tag links:', linksError);
              // Continue anyway - world is updated, tags can be fixed later
            }
          }
        }
      }

      // Fetch updated world with links and tags
      const { data: updatedWorld } = await supabaseAdmin
        .from('chimera_worlds')
        .select(`
          *,
          ruleset_links:chimera_world_ruleset_link(ruleset_template_id)
        `)
        .eq('id', id)
        .single();

      // Fetch tags
      const { data: assetTags } = await supabaseAdmin
        .from('chimera_asset_tags')
        .select(`
          tag:chimera_tags!tag_id(id, tag_name)
        `)
        .eq('asset_id', id)
        .eq('asset_type', 'world');

      if (assetTags && updatedWorld) {
        (updatedWorld as any).tags = assetTags
          .map((link: any) => link.tag)
          .filter((tag: any) => tag !== null);
      }

      return sendSuccess(res, updatedWorld, req);
    } catch (error) {
      console.error('[Chimera Worlds] Unexpected error:', error);
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
 * DELETE /api/v2/chimera/worlds/:id
 * Delete a world (owner-only)
 */
router.delete(
  '/:id',
  validateRequest(TextIdParamSchema, 'params'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.ctx?.userId;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      // Check ownership
      const { data: existingWorld, error: fetchError } = await supabaseAdmin
        .from('chimera_worlds')
        .select('owner_user_id')
        .eq('id', id)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'World not found',
            req
          );
        }
        console.error('[Chimera Worlds] Error checking ownership:', fetchError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to check ownership',
          req
        );
      }

      if (existingWorld.owner_user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'Only the owner can delete this world',
          req
        );
      }

      // Delete world (cascade will handle ruleset links)
      const { error } = await supabaseAdmin
        .from('chimera_worlds')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[Chimera Worlds] Error deleting world:', error);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to delete world',
          req
        );
      }

      return sendSuccess(res, { id, deleted: true }, req);
    } catch (error) {
      console.error('[Chimera Worlds] Unexpected error:', error);
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

