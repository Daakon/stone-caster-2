/**
 * Public Publishing Routes
 * Phase 2: Owner-facing publish request endpoints with real persistence and quotas
 * All routes are behind FF_PUBLISH_GATES_OWNER feature flag
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { isPublishGatesOwnerEnabled, isPublishingPreflightEnabled, isPublishingQualityGatesEnabled } from '../config/featureFlags.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import {
  PublishableTypeSchema,
  PublishingErrorCode,
  PublishingErrorMessages,
  PublishingTelemetryEvents,
} from '@shared/types/publishing.js';
import { authenticateToken } from '../middleware/auth.js';
import { recordPublishRequest } from '../dal/publishing.js';
import {
  QUOTA_DEFAULTS,
  readUserLimitsOrDefault,
  isQuotaExempt,
} from '../config/quotas.js';
import {
  countUserContent,
  countDailyPublishRequests,
} from '../dal/publishing.js';

const router = Router();

/**
 * Telemetry emitter (Phase 5: uses centralized telemetry module)
 */
import { emitPublishingEvent } from '../telemetry/publishingTelemetry.js';

// Legacy wrapper for backward compatibility (now uses centralized telemetry)
function emitTelemetry(event: string, props: Record<string, unknown>): void {
  emitPublishingEvent(event as any, props);
}

/**
 * POST /api/publish/:type/:id/request
 * Request publication for a world, story, or npc
 */
router.post(
  '/:type/:id/request',
  authenticateToken,
  async (req: Request, res: Response) => {
    // Check feature flag
    if (!isPublishGatesOwnerEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.PUBLISH_REQUEST_DISABLED,
        PublishingErrorMessages[PublishingErrorCode.PUBLISH_REQUEST_DISABLED],
        req
      );
    }

    try {
      // Validate type and id from params
      const typeResult = PublishableTypeSchema.safeParse(req.params.type);
      if (!typeResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          `Invalid type. Must be one of: world, story, npc`,
          req,
          typeResult.error.errors
        );
      }

      const idResult = z.string().uuid().safeParse(req.params.id);
      if (!idResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid id. Must be a valid UUID',
          req,
          idResult.error.errors
        );
      }

      const type = typeResult.data;
      const id = idResult.data;
      const userId = req.user?.id;

      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      // Check quotas (exempt admins)
      const quotaExempt = await isQuotaExempt(req);
      if (!quotaExempt) {
        const limits = await readUserLimitsOrDefault(userId);
        const todayUtc = new Date().toISOString().split('T')[0];

        // Check content count quota
        const currentCount = await countUserContent({ userId, type });
        const maxCount =
          type === 'world'
            ? limits.worldsMax
            : type === 'story'
            ? limits.storiesMax
            : limits.npcsMax;

        if (currentCount >= maxCount) {
          // Phase 5: Emit telemetry for blocked request
          emitPublishingEvent('publish.blocked', {
            type,
            id,
            userId,
            reason: 'QUOTA_EXCEEDED',
            quota_type: 'content_count',
            current: currentCount,
            max: maxCount,
          });

          return sendErrorWithStatus(
            res,
            ApiErrorCode.QUOTA_EXCEEDED,
            `You have reached your limit of ${maxCount} ${type}${maxCount > 1 ? 's' : ''}. Please remove or unpublish existing content before requesting publication.`,
            req,
            {
              quota_type: 'content_count',
              current: currentCount,
              max: maxCount,
              type,
            }
          );
        }

        // Check daily publish requests quota
        const dailyRequests = await countDailyPublishRequests({
          userId,
          dayUtc: todayUtc,
        });

        if (dailyRequests >= limits.publishRequestsDailyMax) {
          // Phase 5: Emit telemetry for blocked request
          emitPublishingEvent('publish.blocked', {
            type,
            id,
            userId,
            reason: 'QUOTA_EXCEEDED',
            quota_type: 'daily_requests',
            current: dailyRequests,
            max: limits.publishRequestsDailyMax,
          });

          return sendErrorWithStatus(
            res,
            ApiErrorCode.QUOTA_EXCEEDED,
            `You have reached your daily limit of ${limits.publishRequestsDailyMax} publish requests. Please try again tomorrow.`,
            req,
            {
              quota_type: 'daily_requests',
              current: dailyRequests,
              max: limits.publishRequestsDailyMax,
            }
          );
        }
      }

      // Record publish request (includes parent world check for story/npc)
      let entity;
      try {
        entity = await recordPublishRequest({ type, id, userId });
      } catch (error: any) {
        // Handle specific errors from DAL
        if (error.code === ApiErrorCode.WORLD_NOT_PUBLIC) {
          emitTelemetry(PublishingTelemetryEvents.PUBLISH_BLOCKED, {
            type,
            id,
            reason: PublishingErrorCode.WORLD_NOT_PUBLIC,
          });

          return sendErrorWithStatus(
            res,
            error.code,
            error.message || PublishingErrorMessages[PublishingErrorCode.WORLD_NOT_PUBLIC],
            req
          );
        }

        if (error.code === ApiErrorCode.NOT_FOUND) {
          return sendErrorWithStatus(res, error.code, error.message, req);
        }

        if (error.code === ApiErrorCode.FORBIDDEN) {
          return sendErrorWithStatus(res, error.code, error.message, req);
        }

        // Re-throw unexpected errors
        throw error;
      }

      // Emit telemetry
      emitTelemetry(PublishingTelemetryEvents.PUBLISH_REQUESTED, {
        type,
        id,
      });

      // Return success response
      sendSuccess(
        res,
        {
          id: entity.id,
          type: entity.type,
          review_state: entity.review_state,
          visibility: entity.visibility,
          message: PublishingErrorMessages[PublishingErrorCode.PUBLISH_REQUEST_SUBMITTED],
        },
        req
      );
    } catch (error: any) {
      console.error('[publishing] Request publish error:', error);
      
      // If error already has a code, use it
      if (error.code) {
        return sendErrorWithStatus(
          res,
          error.code,
          error.message || 'Failed to process publish request',
          req
        );
      }

      sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to process publish request',
        req
      );
    }
  }
);

/**
 * GET /api/publish/:type/:id/preflight
 * Phase 6: Run preflight quality checks for an entity
 */
router.get(
  '/:type/:id/preflight',
  authenticateToken,
  async (req: Request, res: Response) => {
    // Check feature flags
    if (!isPublishingPreflightEnabled() || !isPublishingQualityGatesEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.PUBLISH_REQUEST_DISABLED,
        'Preflight checks are not enabled',
        req,
        undefined,
        501
      );
    }

    try {
      // Validate type and id
      const typeResult = PublishableTypeSchema.safeParse(req.params.type);
      if (!typeResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          `Invalid type. Must be one of: world, story, npc`,
          req,
          typeResult.error.errors
        );
      }

      const idResult = z.string().uuid().safeParse(req.params.id);
      if (!idResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid id. Must be a valid UUID',
          req,
          idResult.error.errors
        );
      }

      const type = typeResult.data;
      const id = idResult.data;
      const userId = req.user?.id;

      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      // Verify ownership
      const tableName = type === 'story' ? 'entry_points' : `${type}s`;
      const { data: entity, error: fetchError } = await supabaseAdmin
        .from(tableName)
        .select('owner_user_id')
        .eq('id', id)
        .single();

      if (fetchError || !entity) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          `${type} not found`,
          req
        );
      }

      if (entity.owner_user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'You do not own this content',
          req
        );
      }

      // Evaluate quality
      const { evaluateEntity } = await import('../services/publishingQuality.js');
      const evaluation = await evaluateEntity({ type, id });

      // Persist if requested
      const persist = req.query.persist === 'true';
      if (persist) {
        const { saveFindings } = await import('../dal/publishingQuality.js');
        await saveFindings({
          type,
          id,
          kind: 'preflight',
          score: evaluation.score,
          issues: evaluation.issues,
        });

      // Emit telemetry
      const { emitPublishingEvent } = await import('../telemetry/publishingTelemetry.js');
      const isWizard = req.query.wizard === 'true';
      emitPublishingEvent(isWizard ? 'wizard.step.completed' : 'creator.preflight.run', {
        type,
        id,
        userId,
        score: evaluation.score,
        issueCount: evaluation.issues.length,
        ...(isWizard ? { step: 'preflight' } : {}),
      });
      }

      sendSuccess(
        res,
        {
          score: evaluation.score,
          issues: evaluation.issues,
        },
        req
      );
    } catch (error: any) {
      console.error('[publishing] Preflight error:', error);

      if (error.code) {
        return sendErrorWithStatus(
          res,
          error.code,
          error.message || 'Failed to run preflight',
          req
        );
      }

      sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to run preflight',
        req
      );
    }
  }
);

export default router;

