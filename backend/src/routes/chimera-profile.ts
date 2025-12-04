/**
 * @swagger
 * tags:
 *   - name: Chimera V2 Profile
 *     description: Creator profile endpoints for Chimera V2
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.unified.js';
import { validateRequest } from '../middleware/validation.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { supabaseAdmin } from '../services/supabase.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Zod schema for updating creator profile
const UpdateCreatorProfileSchema = z.object({
  creator_slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional().nullable(),
  public_bio: z.string().max(2000).optional().nullable(),
  website_url: z.string().url().optional().nullable(),
  new_avatar_url: z.string().url().optional().nullable(),
});

/**
 * PUT /api/v2/chimera/profile
 * Update creator profile fields
 */
router.put(
  '/',
  validateRequest(UpdateCreatorProfileSchema),
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

      const updateData = req.body;

      // Check if creator_slug is being set and if it's already taken
      if (updateData.creator_slug !== undefined && updateData.creator_slug !== null) {
        const { data: existing, error: checkError } = await supabaseAdmin
          .from('user_profiles')
          .select('auth_user_id')
          .eq('creator_slug', updateData.creator_slug)
          .neq('auth_user_id', userId)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('[Chimera Profile] Error checking creator slug:', checkError);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to validate creator slug',
            req
          );
        }

        if (existing) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.CONFLICT,
            'Creator slug is already taken',
            req
          );
        }
      }

      // Build update payload
      const updatePayload: Record<string, unknown> = {
        creator_slug: updateData.creator_slug,
        public_bio: updateData.public_bio,
        website_url: updateData.website_url,
      };

      // Handle new avatar URL - set pending and status
      if (updateData.new_avatar_url !== undefined && updateData.new_avatar_url !== null) {
        updatePayload.pending_avatar_image_url = updateData.new_avatar_url;
        updatePayload.avatar_image_status = 'pending';
      }

      // Update user_profiles table
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .update(updatePayload)
        .eq('auth_user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('[Chimera Profile] Error updating profile:', error);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to update creator profile',
          req
        );
      }

      return sendSuccess(res, {
        creator_slug: data?.creator_slug || null,
        public_bio: data?.public_bio || null,
        website_url: data?.website_url || null,
        approved_avatar_image_url: data?.approved_avatar_image_url || null,
        pending_avatar_image_url: data?.pending_avatar_image_url || null,
        avatar_image_status: data?.avatar_image_status || 'none',
      }, req);
    } catch (error) {
      console.error('[Chimera Profile] Unexpected error:', error);
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

