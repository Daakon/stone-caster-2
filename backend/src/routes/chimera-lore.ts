/**
 * @swagger
 * tags:
 *   - name: Chimera V2 Lore
 *     description: User-facing CRUD endpoints for Chimera lore templates
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

const CreateLoreSchema = z.object({
  display_name: z.string().min(1).max(200),
  content_chunk: z.string().min(1),
  tag_names: z.array(z.string()).default([]),
});

const UpdateLoreSchema = CreateLoreSchema.partial().extend({
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
  return `chimera_lore_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * GET /api/v2/chimera/lore/tags
 * Returns all approved tags
 */
router.get('/tags', async (req: Request, res: Response) => {
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

    const { data: tags, error } = await supabaseAdmin
      .from('chimera_tags')
      .select('id, tag_name, is_approved')
      .eq('is_approved', true)
      .order('tag_name', { ascending: true });

    if (error) {
      console.error('[Chimera Lore] Error fetching tags:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch tags',
        req
      );
    }

    return sendSuccess(res, tags || [], req);
  } catch (error) {
    console.error('[Chimera Lore] Unexpected error:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

/**
 * GET /api/v2/chimera/lore/selectable
 * Returns all public/private lore templates (for pack selection)
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

    // Get lore templates that are either public or owned by the user
    const { data: loreTemplates, error } = await supabaseAdmin
      .from('chimera_lore_templates')
      .select('id, display_name, version, visibility')
      .or(`visibility.eq.public,owner_user_id.eq.${userId}`)
      .order('display_name', { ascending: true });

    if (error) {
      console.error('[Chimera Lore] Error fetching selectable lore:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch lore templates',
        req
      );
    }

    // Fetch tags for each lore template
    if (loreTemplates && loreTemplates.length > 0) {
      const loreIds = loreTemplates.map((l) => l.id);
      const { data: assetTags, error: tagsError } = await supabaseAdmin
        .from('chimera_asset_tags')
        .select(`
          asset_id,
          tag:chimera_tags!tag_id(id, tag_name)
        `)
        .eq('asset_type', 'lore_template')
        .in('asset_id', loreIds);

      if (!tagsError && assetTags) {
        // Group tags by asset_id
        const tagsByAssetId = new Map<string, Array<{ id: string; tag_name: string }>>();
        for (const link of assetTags) {
          if (link.tag) {
            const existing = tagsByAssetId.get(link.asset_id) || [];
            existing.push(link.tag as { id: string; tag_name: string });
            tagsByAssetId.set(link.asset_id, existing);
          }
        }

        // Attach tags to lore templates
        for (const lore of loreTemplates) {
          (lore as any).tags = tagsByAssetId.get(lore.id) || [];
        }
      }
    }

    return sendSuccess(res, loreTemplates || [], req);
  } catch (error) {
    console.error('[Chimera Lore] Unexpected error:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

/**
 * GET /api/v2/chimera/lore/my-creations
 * Get all lore templates owned by the current user
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

    const { data: loreTemplates, error } = await supabaseAdmin
      .from('chimera_lore_templates')
      .select('*')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Chimera Lore] Error fetching lore templates:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch lore templates',
        req
      );
    }

    // Fetch tags for each lore template
    if (loreTemplates && loreTemplates.length > 0) {
      const loreIds = loreTemplates.map((l) => l.id);
      const { data: assetTags, error: tagsError } = await supabaseAdmin
        .from('chimera_asset_tags')
        .select(`
          asset_id,
          tag:chimera_tags!tag_id(id, tag_name)
        `)
        .eq('asset_type', 'lore_template')
        .in('asset_id', loreIds);

      if (!tagsError && assetTags) {
        // Group tags by asset_id
        const tagsByAssetId = new Map<string, Array<{ id: string; tag_name: string }>>();
        for (const link of assetTags) {
          if (link.tag) {
            const existing = tagsByAssetId.get(link.asset_id) || [];
            existing.push(link.tag as { id: string; tag_name: string });
            tagsByAssetId.set(link.asset_id, existing);
          }
        }

        // Attach tags to lore templates
        for (const lore of loreTemplates) {
          (lore as any).tags = tagsByAssetId.get(lore.id) || [];
        }
      }
    }

    if (error) {
      console.error('[Chimera Lore] Error fetching lore templates:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch lore templates',
        req
      );
    }

    return sendSuccess(res, loreTemplates || [], req);
  } catch (error) {
    console.error('[Chimera Lore] Unexpected error:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

/**
 * POST /api/v2/chimera/lore
 * Create a new lore template
 */
router.post(
  '/',
  validateRequest(CreateLoreSchema),
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

      const loreData = req.body;
      const id = generateId();

      // Create the lore template - always set visibility to 'private' for new templates
      const { data: loreTemplate, error: createError } = await supabaseAdmin
        .from('chimera_lore_templates')
        .insert({
          id,
          owner_user_id: userId,
          visibility: 'private',
          display_name: loreData.display_name,
          content_chunk: loreData.content_chunk,
          version: 1,
        })
        .select()
        .single();

      if (createError) {
        console.error('[Chimera Lore] Error creating lore template:', createError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to create lore template',
          req
        );
      }

      // Handle tags: normalize, create/get tags, and create links
      if (loreData.tag_names && loreData.tag_names.length > 0) {
        const tagIds: string[] = [];

        for (const tagName of loreData.tag_names) {
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
              console.error('[Chimera Lore] Error creating tag:', tagError);
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
            asset_type: 'lore_template',
          }));

          const { error: linksError } = await supabaseAdmin
            .from('chimera_asset_tags')
            .insert(assetTagLinks);

          if (linksError) {
            console.error('[Chimera Lore] Error creating tag links:', linksError);
            // Continue anyway - lore is created, tags can be fixed later
          }
        }
      }

      // Fetch complete lore template with tags
      const { data: completeLore, error: fetchError } = await supabaseAdmin
        .from('chimera_lore_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('[Chimera Lore] Error fetching created lore:', fetchError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Lore created but failed to fetch',
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
        .eq('asset_type', 'lore_template');

      const tags = (assetTags || [])
        .map((link: any) => link.tag)
        .filter((tag: any) => tag !== null);

      return sendSuccess(res, { ...completeLore, tags }, req);
    } catch (error) {
      console.error('[Chimera Lore] Unexpected error:', error);
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
 * GET /api/v2/chimera/lore/:id
 * Get a single lore template (ownership-aware)
 */
router.get(
  '/:id',
  validateRequest(TextIdParamSchema, 'params'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.ctx?.userId;

      const { data: loreTemplate, error: loreError } = await supabaseAdmin
        .from('chimera_lore_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (loreError) {
        if (loreError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Lore template not found',
            req
          );
        }
        console.error('[Chimera Lore] Error fetching lore template:', loreError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch lore template',
          req
        );
      }

      // Check access: user must be owner OR visibility must be public
      if (loreTemplate.owner_user_id !== userId && loreTemplate.visibility !== 'public') {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'Access denied',
          req
        );
      }

      return sendSuccess(res, loreTemplate, req);
    } catch (error) {
      console.error('[Chimera Lore] Unexpected error:', error);
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
 * PUT /api/v2/chimera/lore/:id
 * Update a lore template (owner-only) and increment version
 */
router.put(
  '/:id',
  validateRequest(TextIdParamSchema, 'params'),
  validateRequest(UpdateLoreSchema),
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
        .from('chimera_lore_templates')
        .select('owner_user_id, version')
        .eq('id', id)
        .single();

      if (checkError) {
        if (checkError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Lore template not found',
            req
          );
        }
        console.error('[Chimera Lore] Error checking ownership:', checkError);
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
          'You do not have permission to update this lore template',
          req
        );
      }

      // Build update payload
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        version: existing.version + 1, // Increment version
      };

      if (updateData.display_name !== undefined) {
        updatePayload.display_name = updateData.display_name;
      }
      if (updateData.content_chunk !== undefined) {
        updatePayload.content_chunk = updateData.content_chunk;
      }
      if (updateData.visibility !== undefined) {
        updatePayload.visibility = updateData.visibility;
      }

      // Update the lore template
      const { data: updatedLore, error: updateError } = await supabaseAdmin
        .from('chimera_lore_templates')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('[Chimera Lore] Error updating lore template:', updateError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to update lore template',
          req
        );
      }

      // Handle tags if provided
      if (updateData.tag_names !== undefined) {
        // Delete existing tag links
        await supabaseAdmin
          .from('chimera_asset_tags')
          .delete()
          .eq('asset_id', id)
          .eq('asset_type', 'lore_template');

        // Create new tag links
        if (updateData.tag_names.length > 0) {
          const tagIds: string[] = [];

          for (const tagName of updateData.tag_names) {
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
                console.error('[Chimera Lore] Error creating tag:', tagError);
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
              asset_type: 'lore_template',
            }));

            const { error: linksError } = await supabaseAdmin
              .from('chimera_asset_tags')
              .insert(assetTagLinks);

            if (linksError) {
              console.error('[Chimera Lore] Error creating tag links:', linksError);
              // Continue anyway - lore is updated, tags can be fixed later
            }
          }
        }
      }

      // Fetch tags
      const { data: assetTags } = await supabaseAdmin
        .from('chimera_asset_tags')
        .select(`
          tag:chimera_tags!tag_id(id, tag_name)
        `)
        .eq('asset_id', id)
        .eq('asset_type', 'lore_template');

      const tags = (assetTags || [])
        .map((link: any) => link.tag)
        .filter((tag: any) => tag !== null);

      return sendSuccess(res, { ...updatedLore, tags }, req);
    } catch (error) {
      console.error('[Chimera Lore] Unexpected error:', error);
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
 * DELETE /api/v2/chimera/lore/:id
 * Delete a lore template (owner-only)
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
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('chimera_lore_templates')
        .select('owner_user_id')
        .eq('id', id)
        .single();

      if (checkError) {
        if (checkError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Lore template not found',
            req
          );
        }
        console.error('[Chimera Lore] Error checking ownership:', checkError);
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
          'You do not have permission to delete this lore template',
          req
        );
      }

      // Delete the lore template
      const { error: deleteError } = await supabaseAdmin
        .from('chimera_lore_templates')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('[Chimera Lore] Error deleting lore template:', deleteError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to delete lore template',
          req
        );
      }

      return sendSuccess(res, { id }, req);
    } catch (error) {
      console.error('[Chimera Lore] Unexpected error:', error);
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

