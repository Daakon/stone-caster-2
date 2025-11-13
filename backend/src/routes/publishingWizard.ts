/**
 * Publishing Wizard Routes
 * Phase 7: Admin-only publishing wizard with unified preflight
 */

import { Router, type Request, type Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { z } from 'zod';
import { runPublishingWizardPreflight } from '../services/publishingWizardService.js';
import { recordPublishRequest } from '../dal/publishing.js';
import { isPublishingWizardEnabled } from '../config/featureFlags.js';

const router = Router();

const PublishableTypeSchema = z.enum(['world', 'story', 'npc']);

/**
 * GET /api/publishing-wizard/:entityType/:entityId/preflight
 * Run unified preflight checks for publishing wizard
 */
router.get(
  '/:entityType/:entityId/preflight',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    // Check feature flag
    if (!isPublishingWizardEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.FEATURE_DISABLED,
        'Publishing wizard is not enabled',
        req,
        undefined,
        501
      );
    }

    try {
      // Validate params
      const typeResult = PublishableTypeSchema.safeParse(req.params.entityType);
      if (!typeResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          `Invalid entityType. Must be one of: world, story, npc`,
          req,
          typeResult.error.errors
        );
      }

      const idResult = z.string().min(1).safeParse(req.params.entityId);
      if (!idResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid entityId',
          req,
          idResult.error.errors
        );
      }

      const entityType = typeResult.data;
      const entityId = idResult.data;

      // Run preflight
      const preflight = await runPublishingWizardPreflight({ entityType, entityId });

      sendSuccess(res, preflight, req);
    } catch (error) {
      console.error('Error running publishing wizard preflight:', error);
      sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to run preflight checks',
        req
      );
    }
  }
);

/**
 * POST /api/publishing-wizard/:entityType/:entityId/submit
 * Submit entity for publishing (creates publish request)
 */
router.post(
  '/:entityType/:entityId/submit',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    // Check feature flag
    if (!isPublishingWizardEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.FEATURE_DISABLED,
        'Publishing wizard is not enabled',
        req,
        undefined,
        501
      );
    }

    try {
      // Validate params
      const typeResult = PublishableTypeSchema.safeParse(req.params.entityType);
      if (!typeResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          `Invalid entityType. Must be one of: world, story, npc`,
          req,
          typeResult.error.errors
        );
      }

      const idResult = z.string().min(1).safeParse(req.params.entityId);
      if (!idResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid entityId',
          req,
          idResult.error.errors
        );
      }

      const entityType = typeResult.data;
      const entityId = idResult.data;
      const userId = req.user?.id;

      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      // Refinement: Race condition guard - check publish_status before proceeding
      const tableName = entityType === 'story' ? 'entry_points' : `${entityType}s`;
      const { data: currentEntity, error: entityError } = await supabaseAdmin
        .from(tableName)
        .select('id, publish_status, review_state, visibility')
        .eq('id', entityId)
        .single();

      if (entityError || !currentEntity) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          `${entityType} not found`,
          req
        );
      }

      // Check if already published (race condition guard)
      const publishStatus = (currentEntity as any).publish_status;
      const reviewState = (currentEntity as any).review_state;
      const visibility = (currentEntity as any).visibility;

      if (publishStatus === 'published' || (reviewState === 'approved' && visibility === 'public')) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.CONFLICT,
          'Entity is already published',
          req,
          { code: 'ALREADY_PUBLISHED' },
          409
        );
      }

      // Re-run preflight to ensure no blockers
      const preflight = await runPublishingWizardPreflight({ entityType, entityId });
      
      if (!preflight.ok) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Cannot submit: preflight checks failed',
          req,
          { blockers: preflight.blockers, blockerCodes: preflight.blockerCodes },
          422
        );
      }

      // Get next snapshot version (for response)
      let nextSnapshotVersion = 1;
      if (entityType === 'story' || entityType === 'world') {
        const { supabaseAdmin } = await import('../services/supabase.js');
        const { data: existingSnapshots } = await supabaseAdmin
          .from('prompt_snapshots')
          .select('version')
          .eq('entity_type', entityType)
          .eq('entity_id', entityId)
          .order('version', { ascending: false })
          .limit(1);

        if (existingSnapshots && existingSnapshots.length > 0) {
          nextSnapshotVersion = (existingSnapshots[0] as any).version + 1;
        }
      }

      // Create publish request
      const result = await recordPublishRequest({
        type: entityType,
        id: entityId,
        userId,
      });

      sendSuccess(
        res,
        {
          submitted: true,
          entityId,
          publishRequestId: result.id || null,
          snapshotVersion: nextSnapshotVersion,
        },
        req
      );
    } catch (error) {
      console.error('Error submitting publishing wizard request:', error);
      sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to submit publish request',
        req
      );
    }
  }
);

export default router;


