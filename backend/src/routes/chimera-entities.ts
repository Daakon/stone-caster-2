/**
 * @swagger
 * tags:
 *   - name: Chimera V2 Entities
 *     description: User-facing CRUD endpoints for Chimera entity templates
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { supabaseAdmin } from '../services/supabase.js';

const router = Router();

// Schema for UUID entity ID
const EntityIdParamSchema = z.object({
  id: z.string().uuid(),
});

// All routes require authentication
router.use(authenticateToken);

// Zod schemas for validation
const EntityTypeSchema = z.enum(['NPC', 'ITEM', 'FACTION']);
const VisibilitySchema = z.enum(['private', 'pending_approval', 'public']);

const CreateEntitySchema = z.object({
  display_name: z.string().min(1).max(200),
  description_short: z.string().max(500).optional().nullable(),
  entity_type: EntityTypeSchema,
  base_state_json: z.record(z.unknown()).default({}),
  tag_names: z.array(z.string()).default([]),
});

const UpdateEntitySchema = CreateEntitySchema.partial().extend({
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
 * GET /api/v2/chimera/entities/selectable
 * Returns all public/private entities (for pack selection)
 */
router.get('/selectable', async (req: Request, res: Response) => {
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

    // Get entities that are either public or owned by the user
    const { data: entities, error } = await supabaseAdmin
      .from('chimera_entity_templates')
      .select('id, display_name, entity_type, version, visibility')
      .or(`visibility.eq.public,owner_user_id.eq.${userId}`)
      .order('display_name', { ascending: true });

    if (error) {
      console.error('[Chimera Entities] Error fetching selectable entities:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch entities',
        req
      );
    }

    return sendSuccess(res, entities || [], req);
  } catch (error) {
    console.error('[Chimera Entities] Unexpected error:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

/**
 * GET /api/v2/chimera/entities
 * Get all entities owned by the current user
 */
router.get('/', async (req: Request, res: Response) => {
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

    const { data: entities, error } = await supabaseAdmin
      .from('chimera_entity_templates')
      .select('*')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Chimera Entities] Error fetching user entities:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch entities',
        req
      );
    }

    return sendSuccess(res, entities || [], req);
  } catch (error) {
    console.error('[Chimera Entities] Unexpected error:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

/**
 * GET /api/v2/chimera/entities/my-creations
 * Get all entities owned by the current user (alias for /)
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

    const { data: entities, error } = await supabaseAdmin
      .from('chimera_entity_templates')
      .select('*')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Chimera Entities] Error fetching user entities:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch entities',
        req
      );
    }

    return sendSuccess(res, entities || [], req);
  } catch (error) {
    console.error('[Chimera Entities] Unexpected error:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

/**
 * POST /api/v2/chimera/entities
 * Create a new entity template
 */
router.post(
  '/',
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
      const id = generateId();

      // Validate base_state_json is valid JSON
      let baseStateJson: Record<string, unknown>;
      try {
        if (typeof entityData.base_state_json === 'string') {
          baseStateJson = JSON.parse(entityData.base_state_json);
        } else {
          baseStateJson = entityData.base_state_json || {};
        }
      } catch (error) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid JSON in base_state_json',
          req
        );
      }

      // Create the entity - always set visibility to 'private' for new entities
      const { data: entity, error: entityError } = await supabaseAdmin
        .from('chimera_entity_templates')
        .insert({
          id,
          owner_user_id: userId,
          display_name: entityData.display_name,
          description_short: entityData.description_short,
          entity_type: entityData.entity_type,
          base_state_json: baseStateJson,
          visibility: 'private', // Always private for new entities
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (entityError) {
        console.error('[Chimera Entities] Error creating entity:', entityError);
        // Check for unique constraint violation
        if (entityError.code === '23505') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.CONFLICT,
            'An entity with this name already exists',
            req
          );
        }
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to create entity',
          req
        );
      }

      // Handle tags: normalize, create/get tags, and create links
      if (entityData.tag_names && entityData.tag_names.length > 0) {
        const tagIds: string[] = [];

        for (const tagName of entityData.tag_names) {
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
              console.error('[Chimera Entities] Error creating tag:', tagError);
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
            asset_type: 'entity_template',
          }));

          const { error: linksError } = await supabaseAdmin
            .from('chimera_asset_tags')
            .insert(assetTagLinks);

          if (linksError) {
            console.error('[Chimera Entities] Error creating tag links:', linksError);
            // Continue anyway - entity is created, tags can be fixed later
          }
        }
      }

      return sendSuccess(res, entity, req);
    } catch (error) {
      console.error('[Chimera Entities] Unexpected error:', error);
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
 * GET /api/v2/chimera/entities/:id
 * Get a single entity template
 */
router.get(
  '/:id',
  validateRequest(EntityIdParamSchema, 'params'),
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

      const { data: entity, error } = await supabaseAdmin
        .from('chimera_entity_templates')
        .select('*')
        .eq('id', id)
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
        console.error('[Chimera Entities] Error fetching entity:', error);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch entity',
          req
        );
      }

      // Check ownership or public visibility
      if (entity.owner_user_id !== userId && entity.visibility !== 'public') {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'You do not have permission to view this entity',
          req
        );
      }

      return sendSuccess(res, entity, req);
    } catch (error) {
      console.error('[Chimera Entities] Unexpected error:', error);
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
 * PUT /api/v2/chimera/entities/:id
 * Update an entity template (owner-only)
 */
router.put(
  '/:id',
  validateRequest(EntityIdParamSchema, 'params'),
  validateRequest(UpdateEntitySchema),
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
        .from('chimera_entity_templates')
        .select('owner_user_id')
        .eq('id', id)
        .single();

      if (checkError) {
        if (checkError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Entity not found',
            req
          );
        }
        console.error('[Chimera Entities] Error checking ownership:', checkError);
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
          'You do not have permission to update this entity',
          req
        );
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
      if (updateData.entity_type !== undefined) {
        updatePayload.entity_type = updateData.entity_type;
      }
      if (updateData.visibility !== undefined) {
        updatePayload.visibility = updateData.visibility;
      }
      if (updateData.base_state_json !== undefined) {
        // Validate JSON if it's a string
        let baseStateJson: Record<string, unknown>;
        try {
          if (typeof updateData.base_state_json === 'string') {
            baseStateJson = JSON.parse(updateData.base_state_json);
          } else {
            baseStateJson = updateData.base_state_json;
          }
        } catch (error) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.VALIDATION_FAILED,
            'Invalid JSON in base_state_json',
            req
          );
        }
        updatePayload.base_state_json = baseStateJson;
      }

      // Update the entity
      const { data: entity, error: updateError } = await supabaseAdmin
        .from('chimera_entity_templates')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('[Chimera Entities] Error updating entity:', updateError);
        if (updateError.code === '23505') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.CONFLICT,
            'An entity with this name already exists',
            req
          );
        }
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to update entity',
          req
        );
      }

      return sendSuccess(res, entity, req);
    } catch (error) {
      console.error('[Chimera Entities] Unexpected error:', error);
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
 * DELETE /api/v2/chimera/entities/:id
 * Delete an entity template (owner-only)
 */
router.delete(
  '/:id',
  validateRequest(EntityIdParamSchema, 'params'),
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
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('chimera_entity_templates')
        .select('owner_user_id')
        .eq('id', id)
        .single();

      if (checkError) {
        if (checkError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Entity not found',
            req
          );
        }
        console.error('[Chimera Entities] Error checking ownership:', checkError);
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
          'You do not have permission to delete this entity',
          req
        );
      }

      // Delete the entity
      const { error: deleteError } = await supabaseAdmin
        .from('chimera_entity_templates')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('[Chimera Entities] Error deleting entity:', deleteError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to delete entity',
          req
        );
      }

      return sendSuccess(res, { success: true }, req);
    } catch (error) {
      console.error('[Chimera Entities] Unexpected error:', error);
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

