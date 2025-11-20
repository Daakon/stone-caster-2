/**
 * @swagger
 * tags:
 *   - name: Chimera V2 Admin
 *     description: Admin-only CRUD endpoints for Chimera entity templates (system assets)
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validateRequest } from '../middleware/validation.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { supabaseAdmin } from '../services/supabase.js';

const router = Router();

// Admin-only routes - require publisher role (admin)
const requireAdmin = requireRole('publisher');

// Custom schema for text-based IDs (not UUIDs)
const TextIdParamSchema = z.object({
  id: z.string().min(1).max(200),
});

// Zod schemas for validation
const EntityTypeSchema = z.enum(['NPC', 'ITEM', 'FACTION']);
const VisibilitySchema = z.enum(['private', 'pending_approval', 'public']);

const CreateSystemEntitySchema = z.object({
  display_name: z.string().min(1).max(200),
  description_short: z.string().max(500).optional().nullable(),
  entity_type: EntityTypeSchema,
  base_state_json: z.record(z.unknown()).default({}),
  world_id: z.string().optional().nullable(), // Optional - null for global system assets
  is_quick_start_template: z.boolean().optional().default(false), // Flag for playable quick start templates
  tag_names: z.array(z.string()).default([]),
});

const UpdateSystemEntitySchema = CreateSystemEntitySchema.partial().extend({
  visibility: VisibilitySchema.optional(),
});

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
  return `chimera_entity_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * POST /api/v2/chimera/admin/entities
 * Create a system entity (premade character) - Admin only
 * 
 * System entities have is_system_asset = true and can be used by all users
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validateRequest(CreateSystemEntitySchema),
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

      const entityData = req.body;
      const id = generateId();

      // Validate world_id if provided
      if (entityData.world_id) {
        const { data: world, error: worldError } = await supabaseAdmin
          .from('chimera_worlds')
          .select('id')
          .eq('id', entityData.world_id)
          .single();

        if (worldError || !world) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'World not found',
            req
          );
        }
      }

      // Handle tags
      const tagNames = entityData.tag_names || [];
      const normalizedTags = tagNames.map(normalizeTagName).filter((t) => t.length > 0);

      // Create the system entity with is_system_asset = true
      const { data: entity, error: entityError } = await supabaseAdmin
        .from('chimera_entity_templates')
        .insert({
          id,
          owner_user_id: userId, // Admin user who created it
          display_name: entityData.display_name,
          description_short: entityData.description_short,
          entity_type: entityData.entity_type,
          base_state_json: entityData.base_state_json || {},
          world_id: entityData.world_id || null,
          is_system_asset: true, // Mark as system asset
          is_quick_start_template: entityData.is_quick_start_template ?? false, // Flag for quick start templates
          visibility: 'public', // System assets are always public
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (entityError) {
        console.error('[Chimera Admin Entities] Error creating system entity:', entityError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to create system entity',
          req
        );
      }

      // Handle tag associations (if tags are provided)
      if (normalizedTags.length > 0) {
        // Fetch tag IDs
        const { data: existingTags, error: tagsError } = await supabaseAdmin
          .from('chimera_tags')
          .select('id, tag_name')
          .in('tag_name', normalizedTags);

        if (!tagsError && existingTags) {
          const tagIds = existingTags.map((t) => t.id);
          const tagLinks = tagIds.map((tagId) => ({
            asset_id: id,
            asset_type: 'entity',
            tag_id: tagId,
          }));

          if (tagLinks.length > 0) {
            const { error: linkError } = await supabaseAdmin
              .from('chimera_asset_tags')
              .insert(tagLinks);

            if (linkError) {
              console.error('[Chimera Admin Entities] Error linking tags:', linkError);
              // Don't fail the request, just log the error
            }
          }
        }
      }

      // Fetch the complete entity with relations
      const { data: completeEntity, error: fetchError } = await supabaseAdmin
        .from('chimera_entity_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('[Chimera Admin Entities] Error fetching created entity:', fetchError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Entity created but failed to fetch',
          req
        );
      }

      return sendSuccess(res, completeEntity, req);
    } catch (error) {
      console.error('[Chimera Admin Entities] Unexpected error:', error);
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
 * PUT /api/v2/chimera/admin/entities/:id
 * Update a system entity - Admin only
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateRequest(TextIdParamSchema, 'params'),
  validateRequest(UpdateSystemEntitySchema),
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

      // Verify entity exists and is a system asset
      const { data: existingEntity, error: checkError } = await supabaseAdmin
        .from('chimera_entity_templates')
        .select('id, is_system_asset')
        .eq('id', id)
        .single();

      if (checkError || !existingEntity) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'System entity not found',
          req
        );
      }

      if (!existingEntity.is_system_asset) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'This entity is not a system asset',
          req
        );
      }

      // Validate world_id if provided
      if (updateData.world_id !== undefined) {
        if (updateData.world_id) {
          const { data: world, error: worldError } = await supabaseAdmin
            .from('chimera_worlds')
            .select('id')
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
        }
      }

      // Prepare update data (exclude tag_names, handle separately)
      const { tag_names, ...entityUpdateData } = updateData;

      // Update entity
      if (Object.keys(entityUpdateData).length > 0) {
        const updatePayload: any = {
          ...entityUpdateData,
          updated_at: new Date().toISOString(),
        };
        
        // Ensure is_quick_start_template is included if provided
        if (updateData.is_quick_start_template !== undefined) {
          updatePayload.is_quick_start_template = updateData.is_quick_start_template;
        }

        const { error: updateError } = await supabaseAdmin
          .from('chimera_entity_templates')
          .update(updatePayload)
          .eq('id', id);

        if (updateError) {
          console.error('[Chimera Admin Entities] Error updating entity:', updateError);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to update system entity',
            req
          );
        }
      }

      // Handle tag updates if provided
      if (tag_names !== undefined) {
        // Remove existing tags
        await supabaseAdmin
          .from('chimera_asset_tags')
          .delete()
          .eq('asset_id', id)
          .eq('asset_type', 'entity');

        // Add new tags
        if (tag_names.length > 0) {
          const normalizedTags = tag_names.map(normalizeTagName).filter((t) => t.length > 0);
          const { data: existingTags } = await supabaseAdmin
            .from('chimera_tags')
            .select('id, tag_name')
            .in('tag_name', normalizedTags);

          if (existingTags) {
            const tagLinks = existingTags.map((t) => ({
              asset_id: id,
              asset_type: 'entity',
              tag_id: t.id,
            }));

            if (tagLinks.length > 0) {
              await supabaseAdmin.from('chimera_asset_tags').insert(tagLinks);
            }
          }
        }
      }

      // Fetch updated entity
      const { data: updatedEntity, error: fetchError } = await supabaseAdmin
        .from('chimera_entity_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch updated entity',
          req
        );
      }

      return sendSuccess(res, updatedEntity, req);
    } catch (error) {
      console.error('[Chimera Admin Entities] Unexpected error:', error);
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
 * DELETE /api/v2/chimera/admin/entities/:id
 * Delete a system entity - Admin only
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateRequest(TextIdParamSchema, 'params'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Verify entity exists and is a system asset
      const { data: existingEntity, error: checkError } = await supabaseAdmin
        .from('chimera_entity_templates')
        .select('id, is_system_asset')
        .eq('id', id)
        .single();

      if (checkError || !existingEntity) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'System entity not found',
          req
        );
      }

      if (!existingEntity.is_system_asset) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'This entity is not a system asset',
          req
        );
      }

      // Delete tag associations
      await supabaseAdmin
        .from('chimera_asset_tags')
        .delete()
        .eq('asset_id', id)
        .eq('asset_type', 'entity');

      // Delete entity
      const { error: deleteError } = await supabaseAdmin
        .from('chimera_entity_templates')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('[Chimera Admin Entities] Error deleting entity:', deleteError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to delete system entity',
          req
        );
      }

      return sendSuccess(res, { id, deleted: true }, req);
    } catch (error) {
      console.error('[Chimera Admin Entities] Unexpected error:', error);
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

