/**
 * Cover Media Routes
 * Phase 2c: Routes for setting cover images on entities
 * Mounted at /api level (not /api/media) to match frontend expectations
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { isAdminMediaEnabled } from '../config/featureFlags.js';
import { SetCoverMediaRequestSchema } from '@shared/types/media.js';
import { supabaseAdmin } from '../services/supabase.js';
import { assertCanMutateEntity } from '../services/entityGuard.js';
import { assertMediaOwnershipOrAdmin } from '../services/mediaGuard.js';

const router = Router();

const EntityIdParamSchema = z.object({
  id: z.string(),
});

/**
 * PATCH /api/worlds/:id/cover-media
 * Set or clear cover image for a world
 */
router.patch(
  '/worlds/:id/cover-media',
  authenticateToken,
  validateRequest(EntityIdParamSchema, 'params'),
  validateRequest(SetCoverMediaRequestSchema, 'body'),
  async (req: Request, res: Response) => {
    if (!isAdminMediaEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Media upload feature is not enabled',
        req
      );
    }

    try {
      const userId = req.ctx?.userId || req.user?.id;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { id: worldId } = req.params;
      const { mediaId } = req.body;

      // Load world
      const { data: world, error: worldError } = await supabaseAdmin
        .from('worlds')
        .select('id, owner_user_id, publish_status, cover_media_id')
        .eq('id', worldId)
        .single();

      if (worldError || !world) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'World not found',
          req
        );
      }

      // Check permissions
      try {
        await assertCanMutateEntity({
          entity: world,
          userId,
          req,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('Forbidden')) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.FORBIDDEN,
            error.message,
            req
          );
        }
        throw error;
      }

      // If mediaId provided, load and verify ownership
      if (mediaId) {
        const { data: media, error: mediaError } = await supabaseAdmin
          .from('media_assets')
          .select('id, owner_user_id, status')
          .eq('id', mediaId)
          .single();

        if (mediaError || !media) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Media asset not found',
            req
          );
        }

        // Check media ownership
        await assertMediaOwnershipOrAdmin({
          media,
          userId,
          req,
        });
      }

      // Update cover_media_id
      const { data: updatedWorld, error: updateError } = await supabaseAdmin
        .from('worlds')
        .update({ cover_media_id: mediaId })
        .eq('id', worldId)
        .select('id, owner_user_id, publish_status, cover_media_id')
        .single();

      if (updateError || !updatedWorld) {
        throw new Error(`Failed to update world: ${updateError?.message || 'Unknown error'}`);
      }

      return sendSuccess(res, { world: updatedWorld }, req);
    } catch (error) {
      console.error('Error setting world cover media:', error);

      if (error instanceof Error && error.message.includes('Forbidden')) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          error.message,
          req
        );
      }

      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to set cover media',
        req
      );
    }
  }
);

/**
 * PATCH /api/stories/:id/cover-media
 * Set or clear cover image for a story (entry_point)
 */
router.patch(
  '/stories/:id/cover-media',
  authenticateToken,
  validateRequest(EntityIdParamSchema, 'params'),
  validateRequest(SetCoverMediaRequestSchema, 'body'),
  async (req: Request, res: Response) => {
    if (!isAdminMediaEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Media upload feature is not enabled',
        req
      );
    }

    try {
      const userId = req.ctx?.userId || req.user?.id;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { id: storyId } = req.params;
      const { mediaId } = req.body;

      // Load story (entry_point)
      const { data: story, error: storyError } = await supabaseAdmin
        .from('entry_points')
        .select('id, owner_user_id, publish_status, cover_media_id')
        .eq('id', storyId)
        .single();

      if (storyError || !story) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Story not found',
          req
        );
      }

      // Check permissions
      await assertCanMutateEntity({
        entity: story,
        userId,
        req,
      });

      // If mediaId provided, load and verify ownership
      if (mediaId) {
        const { data: media, error: mediaError } = await supabaseAdmin
          .from('media_assets')
          .select('id, owner_user_id, status')
          .eq('id', mediaId)
          .single();

        if (mediaError || !media) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Media asset not found',
            req
          );
        }

        // Check media ownership
        await assertMediaOwnershipOrAdmin({
          media,
          userId,
          req,
        });
      }

      // Update cover_media_id
      const { data: updatedStory, error: updateError } = await supabaseAdmin
        .from('entry_points')
        .update({ cover_media_id: mediaId })
        .eq('id', storyId)
        .select('id, owner_user_id, publish_status, cover_media_id')
        .single();

      if (updateError || !updatedStory) {
        throw new Error(`Failed to update story: ${updateError?.message || 'Unknown error'}`);
      }

      return sendSuccess(res, { story: updatedStory }, req);
    } catch (error) {
      console.error('Error setting story cover media:', error);

      if (error instanceof Error && error.message.includes('Forbidden')) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          error.message,
          req
        );
      }

      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to set cover media',
        req
      );
    }
  }
);

/**
 * PATCH /api/npcs/:id/cover-media
 * Set or clear cover image for an NPC
 */
router.patch(
  '/npcs/:id/cover-media',
  authenticateToken,
  validateRequest(EntityIdParamSchema, 'params'),
  validateRequest(SetCoverMediaRequestSchema, 'body'),
  async (req: Request, res: Response) => {
    if (!isAdminMediaEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Media upload feature is not enabled',
        req
      );
    }

    try {
      const userId = req.ctx?.userId || req.user?.id;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { id: npcId } = req.params;
      const { mediaId } = req.body;

      // Load NPC
      const { data: npc, error: npcError } = await supabaseAdmin
        .from('npcs')
        .select('id, owner_user_id, publish_status, cover_media_id')
        .eq('id', npcId)
        .single();

      if (npcError || !npc) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'NPC not found',
          req
        );
      }

      // Check permissions
      await assertCanMutateEntity({
        entity: npc,
        userId,
        req,
      });

      // If mediaId provided, load and verify ownership
      if (mediaId) {
        const { data: media, error: mediaError } = await supabaseAdmin
          .from('media_assets')
          .select('id, owner_user_id, status')
          .eq('id', mediaId)
          .single();

        if (mediaError || !media) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Media asset not found',
            req
          );
        }

        // Check media ownership
        await assertMediaOwnershipOrAdmin({
          media,
          userId,
          req,
        });
      }

      // Update cover_media_id
      const { data: updatedNpc, error: updateError } = await supabaseAdmin
        .from('npcs')
        .update({ cover_media_id: mediaId })
        .eq('id', npcId)
        .select('id, owner_user_id, publish_status, cover_media_id')
        .single();

      if (updateError || !updatedNpc) {
        throw new Error(`Failed to update NPC: ${updateError?.message || 'Unknown error'}`);
      }

      return sendSuccess(res, { npc: updatedNpc }, req);
    } catch (error) {
      console.error('Error setting NPC cover media:', error);

      if (error instanceof Error && error.message.includes('Forbidden')) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          error.message,
          req
        );
      }

      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to set cover media',
        req
      );
    }
  }
);

export default router;

