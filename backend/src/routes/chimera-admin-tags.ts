/**
 * @swagger
 * tags:
 *   - name: Chimera V2 Admin
 *     description: Admin-only CRUD endpoints for Chimera tags
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.unified.js';
import { validateRequest } from '../middleware/validation.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { supabaseAdmin } from '../services/supabase.js';

const router = Router();

// Admin-only routes - require publisher role (admin)
const requireAdmin = requireRole(['admin', 'publisher']);

// Zod schemas for validation
const UuidParamSchema = z.object({
  id: z.string().uuid(),
});

const CreateTagSchema = z.object({
  tag_name: z.string().min(1).max(100).trim(),
  is_approved: z.boolean().default(false),
});

const UpdateTagSchema = z.object({
  tag_name: z.string().min(1).max(100).trim().optional(),
  is_approved: z.boolean().optional(),
});

/**
 * GET /api/v2/chimera/admin/tags
 * Get all tags (including unapproved ones)
 */
router.get(
  '/',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('chimera_tags')
        .select('id, tag_name, is_approved, created_at, updated_at')
        .order('tag_name', { ascending: true });

      if (error) {
        console.error('[Chimera Admin Tags] Error fetching tags:', error);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch tags',
          req
        );
      }

      return sendSuccess(res, data || [], req);
    } catch (error) {
      console.error('[Chimera Admin Tags] Unexpected error:', error);
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
 * POST /api/v2/chimera/admin/tags
 * Create a new tag
 */
router.post(
  '/',
  requireAdmin,
  validateRequest(CreateTagSchema),
  async (req: Request, res: Response) => {
    try {
      const { tag_name, is_approved } = req.body as z.infer<typeof CreateTagSchema>;

      // Check if tag already exists
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('chimera_tags')
        .select('id')
        .eq('tag_name', tag_name)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 is "not found" which is what we want
        console.error('[Chimera Admin Tags] Error checking existing tag:', checkError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to check existing tag',
          req
        );
      }

      if (existing) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_ERROR,
          'Tag with this name already exists',
          req
        );
      }

      const { data, error } = await supabaseAdmin
        .from('chimera_tags')
        .insert({
          tag_name,
          is_approved: is_approved ?? false,
        })
        .select()
        .single();

      if (error) {
        console.error('[Chimera Admin Tags] Error creating tag:', error);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to create tag',
          req
        );
      }

      return sendSuccess(res, data, req);
    } catch (error) {
      console.error('[Chimera Admin Tags] Unexpected error:', error);
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
 * PUT /api/v2/chimera/admin/tags/:id
 * Update a tag
 */
router.put(
  '/:id',
  requireAdmin,
  validateRequest(UuidParamSchema, 'params'),
  validateRequest(UpdateTagSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body as z.infer<typeof UpdateTagSchema>;

      // Check if tag exists
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('chimera_tags')
        .select('id')
        .eq('id', id)
        .single();

      if (fetchError || !existing) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Tag not found',
          req
        );
      }

      // If tag_name is being updated, check for duplicates
      if (updateData.tag_name && updateData.tag_name !== existing.tag_name) {
        const { data: duplicate, error: checkError } = await supabaseAdmin
          .from('chimera_tags')
          .select('id')
          .eq('tag_name', updateData.tag_name)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('[Chimera Admin Tags] Error checking duplicate tag:', checkError);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to check duplicate tag',
            req
          );
        }

        if (duplicate) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.VALIDATION_ERROR,
            'Tag with this name already exists',
            req
          );
        }
      }

      const { data, error } = await supabaseAdmin
        .from('chimera_tags')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[Chimera Admin Tags] Error updating tag:', error);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to update tag',
          req
        );
      }

      return sendSuccess(res, data, req);
    } catch (error) {
      console.error('[Chimera Admin Tags] Unexpected error:', error);
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
 * DELETE /api/v2/chimera/admin/tags/:id
 * Delete a tag
 */
router.delete(
  '/:id',
  requireAdmin,
  validateRequest(UuidParamSchema, 'params'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Check if tag exists
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('chimera_tags')
        .select('id')
        .eq('id', id)
        .single();

      if (fetchError || !existing) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Tag not found',
          req
        );
      }

      // Delete the tag (CASCADE will handle chimera_asset_tags)
      const { error } = await supabaseAdmin
        .from('chimera_tags')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[Chimera Admin Tags] Error deleting tag:', error);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to delete tag',
          req
        );
      }

      return sendSuccess(res, { success: true }, req);
    } catch (error) {
      console.error('[Chimera Admin Tags] Unexpected error:', error);
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

