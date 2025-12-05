/**
 * @swagger
 * tags:
 *   - name: Admin Chimera Entities
 *     description: Admin-only endpoints for managing official Chimera entities
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middleware/auth.unified.js';
import { validateRequest } from '../../middleware/validation.js';
import { sendSuccess, sendErrorWithStatus } from '../../utils/response.js';
import { ApiErrorCode } from '@shared';
import { supabaseAdmin } from '../../services/supabase.js';

const router = Router();

// Admin-only routes - require admin role (requireRole includes auth validation)
const requireAdmin = requireRole(['admin']);

// Zod schemas for validation
const EntityTypeSchema = z.enum(['NPC', 'ITEM', 'FACTION', 'LOCATION']);

const CreateEntitySchema = z.object({
  display_name: z.string().min(1).max(200),
  description_short: z.string().max(500).optional().nullable(),
  entity_type: EntityTypeSchema,
  base_state_json: z.record(z.unknown()).default({}),
  tag_names: z.array(z.string()).default([]),
  images: z.array(z.object({
    id: z.string().optional(),
    url: z.string(),
    role: z.string().optional(),
    label: z.string().optional(),
  })).optional().default([]),
});

const UpdateEntitySchema = CreateEntitySchema.partial();

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

// Generate key from display name
function generateKey(displayName: string): string {
  return displayName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * GET /api/v2/chimera/admin/entities-official
 * List all official entities (is_official = true)
 */
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { data: entities, error } = await supabaseAdmin
      .from('chimera_entities')
      .select('id, key, kind, visibility, is_official, created_at, updated_at, owner_user_id, raw_data')
      .eq('is_official', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Admin Entities] Error fetching entities:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch official entities',
        req
      );
    }

    // Transform entities to include display_name from raw_data
    const transformedEntities = (entities || []).map((entity: any) => ({
      id: entity.id,
      key: entity.key,
      kind: entity.kind,
      display_name: entity.raw_data?.display_name || entity.key,
      entity_type: entity.raw_data?.entity_type || entity.kind?.toUpperCase(),
      description_short: entity.raw_data?.description_short || null,
      visibility: entity.visibility,
      is_official: entity.is_official,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
      owner_user_id: entity.owner_user_id,
    }));

    return sendSuccess(res, transformedEntities, req);
  } catch (error) {
    console.error('[Admin Entities] Unexpected error:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

/**
 * GET /api/v2/chimera/admin/entities-official/:id
 * Get a single official entity by ID
 */
router.get(
  '/:id',
  requireAdmin,
  validateRequest(UuidParamSchema, 'params'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const { data: entity, error } = await supabaseAdmin
        .from('chimera_entities')
        .select('id, key, kind, visibility, is_official, created_at, updated_at, owner_user_id, raw_data')
        .eq('id', id)
        .eq('is_official', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Entity not found',
            req
          );
        }
        console.error('[Admin Entities] Error fetching entity:', error);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch entity',
          req
        );
      }

      if (!entity) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Entity not found',
          req
        );
      }

      // Fetch tags
      const { data: assetTags } = await supabaseAdmin
        .from('chimera_asset_tags')
        .select(`
          tag:chimera_tags!tag_id(id, tag_name)
        `)
        .eq('asset_id', id)
        .eq('asset_type', 'entity');

      if (assetTags && entity) {
        (entity as any).tags = assetTags
          .map((link: any) => link.tag)
          .filter((tag: any) => tag !== null);
      }

      // Extract base_state_json from raw_data
      // Handle both structures:
      // 1. New format: raw_data.base_state_json exists
      // 2. Legacy format: state data is directly in raw_data (exclude metadata fields)
      const rawData = entity.raw_data || {};
      let baseStateJson: Record<string, unknown> = {};
      
      if (rawData.base_state_json) {
        // New format: base_state_json is nested
        baseStateJson = rawData.base_state_json;
      } else {
        // Legacy format: extract state by excluding known metadata fields
        const metadataFields = [
          'display_name',
          'name', // Legacy name field
          'description_short',
          'description', // Legacy description field
          'description_long',
          'entity_type',
          'type', // Legacy type field
          'images',
          'visibility',
          'version',
          'owner_user_id',
          'identity', // Legacy identity object
        ];
        
        baseStateJson = { ...rawData };
        // Remove metadata fields to get just the state
        for (const field of metadataFields) {
          delete baseStateJson[field];
        }
        
        // If identity exists, merge its contents into base_state_json
        if (rawData.identity && typeof rawData.identity === 'object') {
          baseStateJson = { ...baseStateJson, ...(rawData.identity as Record<string, unknown>) };
        }
      }

      // Transform entity to include display_name from raw_data
      // Handle both new format (display_name) and legacy format (name, identity.name)
      const displayName = rawData.display_name || rawData.name || (rawData.identity && typeof rawData.identity === 'object' ? (rawData.identity as any).name : null) || entity.key;
      const entityType = rawData.entity_type || rawData.type || entity.kind?.toUpperCase();
      const descriptionShort = rawData.description_short || rawData.description || null;
      
      const transformedEntity = {
        id: entity.id,
        key: entity.key,
        kind: entity.kind,
        display_name: displayName,
        entity_type: entityType,
        description_short: descriptionShort,
        base_state_json: baseStateJson,
        images: rawData.images || [],
        visibility: entity.visibility,
        is_official: entity.is_official,
        created_at: entity.created_at,
        updated_at: entity.updated_at,
        owner_user_id: entity.owner_user_id,
        tags: (entity as any).tags || [],
        raw_data: entity.raw_data,
      };

      return sendSuccess(res, transformedEntity, req);
    } catch (error) {
      console.error('[Admin Entities] Unexpected error:', error);
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
 * POST /api/v2/chimera/admin/entities-official
 * Create an official entity (forces is_official: true, visibility: public)
 */
router.post(
  '/',
  requireAdmin,
  validateRequest(CreateEntitySchema),
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
      const key = generateKey(entityData.display_name);
      const kind = entityData.entity_type.toLowerCase() as 'npc' | 'item' | 'location' | 'faction';

      // Build raw_data JSONB
      const rawData = {
        display_name: entityData.display_name,
        description_short: entityData.description_short || null,
        entity_type: entityData.entity_type,
        base_state_json: entityData.base_state_json || {},
        images: entityData.images || [],
        visibility: 'public',
        version: 1,
      };

      // Handle tags: normalize, create/get tags
      const tagIds: string[] = [];
      if (entityData.tag_names && entityData.tag_names.length > 0) {
        for (const tagName of entityData.tag_names) {
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

      // Create entity with is_official = true and visibility = public
      const { data: entity, error: entityError } = await supabaseAdmin
        .from('chimera_entities')
        .insert({
          key: key,
          kind: kind,
          visibility: 'public', // Official entities are always public
          is_official: true, // Force official flag
          owner_user_id: userId,
          raw_data: rawData,
        })
        .select('id, key, kind, visibility, is_official, created_at, updated_at, raw_data')
        .single();

      if (entityError) {
        console.error('[Admin Entities] Error creating entity:', entityError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to create entity',
          req
        );
      }

      // Create asset tag links
      if (tagIds.length > 0) {
        const assetTagLinks = tagIds.map((tagId) => ({
          tag_id: tagId,
          asset_id: String(entity.id),
          asset_type: 'entity',
        }));

        const { error: linksError } = await supabaseAdmin
          .from('chimera_asset_tags')
          .insert(assetTagLinks);

        if (linksError) {
          console.warn('[Admin Entities] Error creating tag links:', linksError);
          // Continue anyway - entity is created
        }
      }

      // Transform response
      const transformedEntity = {
        id: entity.id,
        key: entity.key,
        kind: entity.kind,
        display_name: entity.raw_data?.display_name || entity.key,
        entity_type: entity.raw_data?.entity_type || entity.kind?.toUpperCase(),
        description_short: entity.raw_data?.description_short || null,
        visibility: entity.visibility,
        is_official: entity.is_official,
        created_at: entity.created_at,
        updated_at: entity.updated_at,
      };

      return sendSuccess(res, transformedEntity, req);
    } catch (error) {
      console.error('[Admin Entities] Unexpected error:', error);
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
 * PUT /api/v2/chimera/admin/entities-official/:id
 * Update an official entity (ensures is_official remains true)
 */
router.put(
  '/:id',
  requireAdmin,
  validateRequest(UpdateEntitySchema),
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
      const entityData = req.body;

      // Verify entity exists and is official
      const { data: existingEntity, error: fetchError } = await supabaseAdmin
        .from('chimera_entities')
        .select('id, is_official, raw_data, key, kind')
        .eq('id', id)
        .single();

      if (fetchError || !existingEntity) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Entity not found',
          req
        );
      }

      if (!existingEntity.is_official) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'Cannot update non-official entity via admin endpoint',
          req
        );
      }

      // Build update payload
      const updatePayload: any = {};
      const existingRawData = existingEntity.raw_data || {};
      const updatedRawData = { ...existingRawData };

      if (entityData.display_name) {
        updatePayload.key = generateKey(entityData.display_name);
        updatedRawData.display_name = entityData.display_name;
      }

      if (entityData.entity_type) {
        updatePayload.kind = entityData.entity_type.toLowerCase();
        updatedRawData.entity_type = entityData.entity_type;
      }

      if (entityData.description_short !== undefined) {
        updatedRawData.description_short = entityData.description_short;
      }

      if (entityData.base_state_json !== undefined) {
        updatedRawData.base_state_json = entityData.base_state_json;
      }

      if (entityData.images !== undefined) {
        updatedRawData.images = entityData.images;
      }

      updatePayload.raw_data = updatedRawData;

      // Update entity (ensure is_official remains true)
      const { data: updatedEntity, error: updateError } = await supabaseAdmin
        .from('chimera_entities')
        .update({
          ...updatePayload,
          is_official: true, // Ensure it remains official
        })
        .eq('id', id)
        .select('id, key, kind, visibility, is_official, created_at, updated_at, raw_data')
        .single();

      if (updateError) {
        console.error('[Admin Entities] Error updating entity:', updateError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to update entity',
          req
        );
      }

      // Update tags if provided
      if (entityData.tag_names && entityData.tag_names.length > 0) {
        // Delete existing tag links
        await supabaseAdmin
          .from('chimera_asset_tags')
          .delete()
          .eq('asset_id', id)
          .eq('asset_type', 'entity');

        // Create new tag links
        const tagIds: string[] = [];
        for (const tagName of entityData.tag_names) {
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
            asset_type: 'entity',
          }));

          await supabaseAdmin
            .from('chimera_asset_tags')
            .insert(assetTagLinks);
        }
      }

      // Transform response
      const transformedEntity = {
        id: updatedEntity.id,
        key: updatedEntity.key,
        kind: updatedEntity.kind,
        display_name: updatedEntity.raw_data?.display_name || updatedEntity.key,
        entity_type: updatedEntity.raw_data?.entity_type || updatedEntity.kind?.toUpperCase(),
        description_short: updatedEntity.raw_data?.description_short || null,
        visibility: updatedEntity.visibility,
        is_official: updatedEntity.is_official,
        created_at: updatedEntity.created_at,
        updated_at: updatedEntity.updated_at,
      };

      return sendSuccess(res, transformedEntity, req);
    } catch (error) {
      console.error('[Admin Entities] Unexpected error:', error);
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
 * DELETE /api/v2/chimera/admin/entities-official/:id
 * Hard delete an official entity (Admin only)
 */
router.delete(
  '/:id',
  requireAdmin,
  validateRequest(UuidParamSchema, 'params'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Verify entity exists and is official
      const { data: existingEntity, error: fetchError } = await supabaseAdmin
        .from('chimera_entities')
        .select('id, is_official')
        .eq('id', id)
        .single();

      if (fetchError || !existingEntity) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Entity not found',
          req
        );
      }

      if (!existingEntity.is_official) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'Cannot delete non-official entity via admin endpoint',
          req
        );
      }

      // Delete related data first
      await supabaseAdmin
        .from('chimera_asset_tags')
        .delete()
        .eq('asset_id', id)
        .eq('asset_type', 'entity');

      // Delete entity
      const { error: deleteError } = await supabaseAdmin
        .from('chimera_entities')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('[Admin Entities] Error deleting entity:', deleteError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to delete entity',
          req
        );
      }

      return sendSuccess(res, { deleted: true }, req);
    } catch (error) {
      console.error('[Admin Entities] Unexpected error:', error);
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
