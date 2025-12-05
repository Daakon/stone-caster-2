/**
 * @swagger
 * tags:
 *   - name: Admin Chimera Worlds
 *     description: Admin-only endpoints for managing official Chimera worlds
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middleware/auth.unified.js';
import { validateRequest } from '../../middleware/validation.js';
import { sendSuccess, sendErrorWithStatus } from '../../utils/response.js';
import { ApiErrorCode } from '@shared';
import { supabaseAdmin } from '../../services/supabase.js';
import { ChimeraAssetRefSchema } from '@shared/types/chimera-assets';

const router = Router();

// Admin-only routes - require admin role (requireRole includes auth validation)
const requireAdmin = requireRole(['admin']);

// Zod schemas for validation
const CreateWorldSchema = z.object({
  display_name: z.string().min(1).max(200),
  description_short: z.string().max(500).optional().nullable(),
  description_long: z.string().optional().nullable(),
  character_schema_contributions: z.record(z.unknown()).optional().default({}),
  ruleset_template_ids: z.array(z.string()).default([]),
  tag_names: z.array(z.string()).default([]),
  tags: z.array(z.string()).optional().default([]),
  images: z.array(ChimeraAssetRefSchema).optional().default([]),
});

const UpdateWorldSchema = CreateWorldSchema.partial();

const UuidParamSchema = z.object({
  id: z.string().uuid(),
});

// Helper function to normalize tag names
function normalizeTagName(tagName: string): string {
  return tagName
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
}

// Helper function to generate a slug from display name
function generateSlug(displayName: string): string {
  if (!displayName || !displayName.trim()) {
    return '';
  }
  return displayName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * GET /api/v2/chimera/admin/worlds
 * List all official worlds (is_official = true)
 */
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { data: worlds, error } = await supabaseAdmin
      .from('chimera_worlds')
      .select('id, key, name, slug, visibility, is_official, created_at, updated_at, owner_user_id')
      .eq('is_official', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Admin Worlds] Error fetching worlds:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch official worlds',
        req
      );
    }

    return sendSuccess(res, worlds || [], req);
  } catch (error) {
    console.error('[Admin Worlds] Unexpected error:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

/**
 * POST /api/v2/chimera/admin/worlds
 * Create an official world (forces is_official: true, visibility: public)
 */
router.post(
  '/',
  requireAdmin,
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
      const displayName = worldData.display_name;
      const slug = generateSlug(displayName);
      const key = slug || `world_${Date.now()}`;

      // Build definition JSONB
      const definition: any = {
        name: displayName,
        slug: slug,
        key: key,
        version: '1.0.0',
        summary: worldData.description_short || '',
        description: worldData.description_long || worldData.description_short || '',
        images: worldData.images || [],
        tags: worldData.tag_names || worldData.tags || [],
        visibility: 'public',
        ruleset_template_ids: worldData.ruleset_template_ids || [], // Store in definition JSONB
      };

      // Handle tags: normalize, create/get tags, and create links
      const tagIds: string[] = [];
      if (worldData.tag_names && worldData.tag_names.length > 0) {
        for (const tagName of worldData.tag_names) {
          const normalized = normalizeTagName(tagName);
          if (!normalized) continue;

          const { data: existingTag } = await supabaseAdmin
            .from('chimera_tags')
            .select('id')
            .eq('tag_name', normalized)
            .single();

          let tagId: string;
          if (existingTag) {
            tagId = existingTag.id;
          } else {
            const { data: newTag } = await supabaseAdmin
              .from('chimera_tags')
              .insert({
                tag_name: normalized,
                is_approved: true, // Admin-created tags are auto-approved
              })
              .select('id')
              .single();

            if (newTag) {
              tagId = newTag.id;
            } else {
              continue;
            }
          }

          tagIds.push(tagId);
        }
      }

      // Create world with is_official = true and visibility = public
      const { data: world, error: worldError } = await supabaseAdmin
        .from('chimera_worlds')
        .insert({
          key: key,
          name: displayName,
          slug: slug,
          visibility: 'public', // Official worlds are always public
          is_official: true, // Force official flag
          owner_user_id: userId,
          tags: worldData.tag_names || worldData.tags || [],
          definition: definition,
          character_schema_contributions: worldData.character_schema_contributions || {},
        })
        .select('id, key, name, slug, visibility, is_official, created_at, updated_at')
        .single();

      if (worldError) {
        console.error('[Admin Worlds] Error creating world:', worldError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to create world',
          req
        );
      }

      // Note: Ruleset links are stored in world definition JSONB, not in junction table
      // The ruleset_template_ids are already included in the definition JSONB above

      // Create asset tag links
      if (tagIds.length > 0) {
        const assetTagLinks = tagIds.map((tagId) => ({
          tag_id: tagId,
          asset_id: String(world.id),
          asset_type: 'world',
        }));

        const { error: linksError } = await supabaseAdmin
          .from('chimera_asset_tags')
          .insert(assetTagLinks);

        if (linksError) {
          console.warn('[Admin Worlds] Error creating tag links:', linksError);
          // Continue anyway - world is created
        }
      }

      return sendSuccess(res, world, req);
    } catch (error) {
      console.error('[Admin Worlds] Unexpected error:', error);
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
 * PUT /api/v2/chimera/admin/worlds/:id
 * Update an official world (ensures is_official remains true)
 */
router.put(
  '/:id',
  requireAdmin,
  validateRequest(UpdateWorldSchema),
  validateRequest(UuidParamSchema, 'params'),
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
      const worldData = req.body;

      // Verify world exists and is official
      const { data: existingWorld, error: fetchError } = await supabaseAdmin
        .from('chimera_worlds')
        .select('id, is_official, definition')
        .eq('id', id)
        .single();

      if (fetchError || !existingWorld) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'World not found',
          req
        );
      }

      if (!existingWorld.is_official) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'Cannot update non-official world via admin endpoint',
          req
        );
      }

      // Build update payload
      const updatePayload: any = {};

      if (worldData.display_name) {
        updatePayload.name = worldData.display_name;
        updatePayload.slug = generateSlug(worldData.display_name);
        updatePayload.key = updatePayload.slug || existingWorld.key;
      }

      if (worldData.tag_names || worldData.tags) {
        updatePayload.tags = worldData.tag_names || worldData.tags || [];
      }

      // Update definition JSONB
      const existingDefinition = existingWorld.definition || {};
      const updatedDefinition = {
        ...existingDefinition,
        ...(worldData.display_name && { name: worldData.display_name }),
        ...(updatePayload.slug && { slug: updatePayload.slug }),
        ...(updatePayload.key && { key: updatePayload.key }),
        ...(worldData.description_short !== undefined && { summary: worldData.description_short }),
        ...(worldData.description_long !== undefined && { description: worldData.description_long }),
        ...(worldData.images !== undefined && { images: worldData.images }),
        ...(updatePayload.tags && { tags: updatePayload.tags }),
        ...(worldData.ruleset_template_ids !== undefined && { ruleset_template_ids: worldData.ruleset_template_ids }),
      };

      updatePayload.definition = updatedDefinition;

      if (worldData.character_schema_contributions) {
        updatePayload.character_schema_contributions = worldData.character_schema_contributions;
      }

      // Update world (ensure is_official remains true)
      const { data: updatedWorld, error: updateError } = await supabaseAdmin
        .from('chimera_worlds')
        .update({
          ...updatePayload,
          is_official: true, // Ensure it remains official
        })
        .eq('id', id)
        .select('id, key, name, slug, visibility, is_official, created_at, updated_at')
        .single();

      if (updateError) {
        console.error('[Admin Worlds] Error updating world:', updateError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to update world',
          req
        );
      }

      // Update tags if provided
      if (worldData.tag_names && worldData.tag_names.length > 0) {
        // Delete existing tag links
        await supabaseAdmin
          .from('chimera_asset_tags')
          .delete()
          .eq('asset_id', id)
          .eq('asset_type', 'world');

        // Create new tag links
        const tagIds: string[] = [];
        for (const tagName of worldData.tag_names) {
          const normalized = normalizeTagName(tagName);
          if (!normalized) continue;

          const { data: existingTag } = await supabaseAdmin
            .from('chimera_tags')
            .select('id')
            .eq('tag_name', normalized)
            .single();

          let tagId: string;
          if (existingTag) {
            tagId = existingTag.id;
          } else {
            const { data: newTag } = await supabaseAdmin
              .from('chimera_tags')
              .insert({
                tag_name: normalized,
                is_approved: true,
              })
              .select('id')
              .single();

            if (newTag) {
              tagId = newTag.id;
            } else {
              continue;
            }
          }

          tagIds.push(tagId);
        }

        if (tagIds.length > 0) {
          const assetTagLinks = tagIds.map((tagId) => ({
            tag_id: tagId,
            asset_id: String(id),
            asset_type: 'world',
          }));

          await supabaseAdmin
            .from('chimera_asset_tags')
            .insert(assetTagLinks);
        }
      }

      return sendSuccess(res, updatedWorld, req);
    } catch (error) {
      console.error('[Admin Worlds] Unexpected error:', error);
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
 * DELETE /api/v2/chimera/admin/worlds/:id
 * Hard delete an official world (Admin only)
 */
router.delete(
  '/:id',
  requireAdmin,
  validateRequest(UuidParamSchema, 'params'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Verify world exists and is official
      const { data: existingWorld, error: fetchError } = await supabaseAdmin
        .from('chimera_worlds')
        .select('id, is_official')
        .eq('id', id)
        .single();

      if (fetchError || !existingWorld) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'World not found',
          req
        );
      }

      if (!existingWorld.is_official) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'Cannot delete non-official world via admin endpoint',
          req
        );
      }

      // Delete related data first (CASCADE should handle this, but being explicit)
      await supabaseAdmin
        .from('chimera_asset_tags')
        .delete()
        .eq('asset_id', id)
        .eq('asset_type', 'world');

      // Delete world
      const { error: deleteError } = await supabaseAdmin
        .from('chimera_worlds')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('[Admin Worlds] Error deleting world:', deleteError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to delete world',
          req
        );
      }

      return sendSuccess(res, { deleted: true }, req);
    } catch (error) {
      console.error('[Admin Worlds] Unexpected error:', error);
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
