/**
 * Admin Publishing Routes
 * Phase 0/1: Admin review queue and approval/rejection endpoints
 * All routes are behind feature flags
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  isAdminReviewQueueEnabled,
  isPublishingWizardEntryEnabled,
  isDependencyMonitorEnabled,
  isPublishingAuditViewerEnabled,
  isPublishingChecklistsEnabled,
  isPublishingQualityGatesEnabled,
} from '../config/featureFlags.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import {
  PublishableTypeSchema,
  AdminReviewApproveRequestSchema,
  AdminReviewRejectRequestSchema,
  PublishingFlagsResponseSchema,
} from '@shared/types/publishing.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import {
  listPendingSubmissions,
  approveSubmission,
  rejectSubmission,
} from '../dal/publishing.js';
import {
  recomputeDependenciesForWorld,
  recomputeDependenciesForAllWorlds,
} from '../dal/dependencyMonitor.js';
import {
  listAudit,
  listRecentActivity,
  type AuditFilters,
} from '../dal/publishingAudit.js';
import {
  saveChecklist,
  listChecklists,
  getLatestFindings,
} from '../dal/publishingQuality.js';
import { evaluateEntity } from '../services/publishingQuality.js';
import { MIN_SCORE_FOR_APPROVAL, HARD_ENFORCE } from '../config/publishingQuality.js';

const router = Router();

/**
 * Telemetry emitter (Phase 5: uses centralized telemetry module)
 */
import { emitPublishingEvent } from '../telemetry/publishingTelemetry.js';

// Legacy wrapper for backward compatibility (now uses centralized telemetry)
function emitTelemetry(event: string, props: Record<string, unknown>): void {
  emitPublishingEvent(event as any, props);
}

// Phase 3: Removed stub functions - using real DAL functions now

/**
 * GET /api/admin/publishing/flags
 * Get current feature flag values for publishing
 */
router.get(
  '/flags',
  authenticateToken,
  requireRole(['admin', 'moderator']),
  async (req: Request, res: Response) => {
    try {
      const flags = {
        publishGatesOwner: false, // Import from publishing.public when needed
        adminReviewQueue: isAdminReviewQueueEnabled(),
        dependencyMonitor: isDependencyMonitorEnabled(),
        publishingWizardEntry: isPublishingWizardEntryEnabled(),
      };

      sendSuccess(res, flags, req);
    } catch (error) {
      console.error('[publishing] Get flags error:', error);
      sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to get publishing flags',
        req
      );
    }
  }
);

/**
 * GET /api/admin/review/queue
 * Get pending submissions for review
 */
router.get(
  '/review/queue',
  authenticateToken,
  requireRole(['admin', 'moderator']),
  async (req: Request, res: Response) => {
    if (!isAdminReviewQueueEnabled()) {
      return sendSuccess(res, [], req);
    }

    try {
      const typeParam = req.query.type;
      const type = typeParam
        ? PublishableTypeSchema.safeParse(typeParam).data
        : undefined;

      const submissions = await listPendingSubmissions(type ? { type } : undefined);

      sendSuccess(res, submissions, req);
    } catch (error) {
      console.error('[publishing] Get review queue error:', error);
      sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to get review queue',
        req
      );
    }
  }
);

/**
 * POST /api/admin/review/:type/:id/approve
 * Approve a submission for publication
 */
router.post(
  '/review/:type/:id/approve',
  authenticateToken,
  requireRole(['admin', 'moderator']),
  async (req: Request, res: Response) => {
    if (!isAdminReviewQueueEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.PUBLISH_REQUEST_DISABLED,
        'Admin review queue is not enabled',
        req,
        501
      );
    }

    try {
      const typeResult = PublishableTypeSchema.safeParse(req.params.type);
      if (!typeResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid type',
          req,
          typeResult.error.errors
        );
      }

      const idResult = z.string().uuid().safeParse(req.params.id);
      if (!idResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid id',
          req,
          idResult.error.errors
        );
      }

      const type = typeResult.data;
      const id = idResult.data;
      const reviewer = req.user?.id;

      if (!reviewer) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      // Approve submission (includes revalidation)
      let entity;
      try {
        entity = await approveSubmission({ type, id, reviewerUserId: reviewer });
      } catch (error: any) {
        // Handle approval blocked
        if (error.code === ApiErrorCode.APPROVAL_BLOCKED) {
          emitTelemetry('admin.review.blocked', {
            type,
            id,
            reasons: error.reasons,
          });

          return sendErrorWithStatus(
            res,
            ApiErrorCode.APPROVAL_BLOCKED,
            error.message || 'Approval blocked by validation checks',
            req,
            {
              reasons: error.reasons || [],
            },
            409
          );
        }

        // Re-throw other errors
        throw error;
      }

      // Emit telemetry
      emitTelemetry('admin.review.approved', {
        type,
        id,
        reviewer,
      });

      // Phase 6: Include quality info in response if available
      const response: any = {
        code: 'APPROVED',
        entity,
      };

      if ((entity as any).quality) {
        response.quality = (entity as any).quality;
      }

      sendSuccess(res, response, req);
    } catch (error: any) {
      console.error('[publishing] Approve error:', error);

      // If error already has a code, use it
      if (error.code) {
        return sendErrorWithStatus(
          res,
          error.code,
          error.message || 'Failed to approve submission',
          req
        );
      }

      sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to approve submission',
        req
      );
    }
  }
);

/**
 * POST /api/admin/review/:type/:id/reject
 * Reject a submission
 */
router.post(
  '/review/:type/:id/reject',
  authenticateToken,
  requireRole(['admin', 'moderator']),
  async (req: Request, res: Response) => {
    if (!isAdminReviewQueueEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.PUBLISH_REQUEST_DISABLED,
        'Admin review queue is not enabled',
        req,
        501
      );
    }

    try {
      const typeResult = PublishableTypeSchema.safeParse(req.params.type);
      if (!typeResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid type',
          req,
          typeResult.error.errors
        );
      }

      const idResult = z.string().uuid().safeParse(req.params.id);
      if (!idResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid id',
          req,
          idResult.error.errors
        );
      }

      const bodyResult = AdminReviewRejectRequestSchema.safeParse(req.body);
      if (!bodyResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.REJECT_REASON_REQUIRED,
          'Rejection reason is required (1-500 characters)',
          req,
          bodyResult.error.errors
        );
      }

      const type = typeResult.data;
      const id = idResult.data;
      const { reason } = bodyResult.data;
      const reviewer = req.user?.id;

      if (!reviewer) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      // Reject submission
      const entity = await rejectSubmission({
        type,
        id,
        reviewerUserId: reviewer,
        reason,
      });

      // Emit telemetry
      emitTelemetry('admin.review.rejected', {
        type,
        id,
        reviewer,
        reason: reason.substring(0, 100), // Truncate for telemetry
      });

      sendSuccess(
        res,
        {
          code: 'REJECTED',
          entity,
        },
        req
      );
    } catch (error: any) {
      console.error('[publishing] Reject error:', error);

      // Handle specific error codes
      if (error.code === ApiErrorCode.REJECT_REASON_REQUIRED) {
        return sendErrorWithStatus(
          res,
          error.code,
          error.message || 'Rejection reason is required',
          req
        );
      }

      if (error.code) {
        return sendErrorWithStatus(
          res,
          error.code,
          error.message || 'Failed to reject submission',
          req
        );
      }

      sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to reject submission',
        req
      );
    }
  }
);

/**
 * POST /api/admin/publishing/deps/recompute/world/:worldId
 * Phase 4: Manually recompute dependencies for a specific world
 */
router.post(
  '/deps/recompute/world/:worldId',
  authenticateToken,
  requireRole(['admin', 'moderator']),
  async (req: Request, res: Response) => {
    if (!isDependencyMonitorEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.PUBLISH_REQUEST_DISABLED,
        'Dependency monitor is not enabled',
        req,
        undefined,
        501
      );
    }

    try {
      const { worldId } = req.params;

      if (!worldId || typeof worldId !== 'string') {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid world ID',
          req
        );
      }

      const result = await recomputeDependenciesForWorld({ worldId });

      sendSuccess(
        res,
        {
          worldId,
          storiesUpdated: result.storiesUpdated,
          npcsUpdated: result.npcsUpdated,
        },
        req
      );
    } catch (error: any) {
      console.error('[publishing] Recompute world dependencies error:', error);

      if (error.code) {
        return sendErrorWithStatus(
          res,
          error.code,
          error.message || 'Failed to recompute dependencies',
          req
        );
      }

      sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to recompute dependencies',
        req
      );
    }
  }
);

/**
 * POST /api/admin/publishing/deps/recompute/all
 * Phase 4: Manually recompute dependencies for all worlds
 */
router.post(
  '/deps/recompute/all',
  authenticateToken,
  requireRole(['admin', 'moderator']),
  async (req: Request, res: Response) => {
    if (!isDependencyMonitorEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.PUBLISH_REQUEST_DISABLED,
        'Dependency monitor is not enabled',
        req,
        undefined,
        501
      );
    }

    try {
      const result = await recomputeDependenciesForAllWorlds({
        concurrency: 4,
        batch: 1000,
      });

      sendSuccess(
        res,
        {
          worldsProcessed: result.worldsProcessed,
          storiesUpdated: result.storiesUpdated,
          npcsUpdated: result.npcsUpdated,
        },
        req
      );
    } catch (error: any) {
      console.error('[publishing] Recompute all dependencies error:', error);

      if (error.code) {
        return sendErrorWithStatus(
          res,
          error.code,
          error.message || 'Failed to recompute dependencies',
          req
        );
      }

      sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to recompute dependencies',
        req
      );
    }
  }
);

/**
 * POST /api/admin/publishing/review/:type/:id/checklist
 * Phase 6: Save a review checklist for a submission
 */
router.post(
  '/review/:type/:id/checklist',
  authenticateToken,
  requireRole(['admin', 'moderator']),
  async (req: Request, res: Response) => {
    if (!isPublishingChecklistsEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.PUBLISH_REQUEST_DISABLED,
        'Publishing checklists are not enabled',
        req,
        undefined,
        501
      );
    }

    try {
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
      const reviewerUserId = req.user?.id;

      if (!reviewerUserId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      // Validate request body
      const bodySchema = z.object({
        items: z.array(
          z.object({
            key: z.string(),
            label: z.string(),
            checked: z.boolean(),
            note: z.string().optional(),
          })
        ),
        score: z.number().int().min(0).max(100),
      });

      const bodyResult = bodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid request body',
          req,
          bodyResult.error.errors
        );
      }

      const { items, score } = bodyResult.data;

      // Save checklist
      await saveChecklist({
        type,
        id,
        reviewerUserId,
        items,
        score,
      });

      // Emit telemetry
      emitTelemetry('admin.checklist.saved', {
        type,
        id,
        reviewerUserId,
        score,
        itemCount: items.length,
      });

      sendSuccess(
        res,
        {
          code: 'CHECKLIST_SAVED',
          type,
          id,
          score,
        },
        req
      );
    } catch (error: any) {
      console.error('[publishing] Checklist save error:', error);

      if (error.code) {
        return sendErrorWithStatus(
          res,
          error.code,
          error.message || 'Failed to save checklist',
          req
        );
      }

      sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to save checklist',
        req
      );
    }
  }
);

/**
 * GET /api/admin/publishing/review/:type/:id/findings
 * Phase 6: Get latest quality findings and checklists for an entity
 */
router.get(
  '/review/:type/:id/findings',
  authenticateToken,
  requireRole(['admin', 'moderator']),
  async (req: Request, res: Response) => {
    try {
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

      // Get latest findings
      const preflightFindings = await getLatestFindings({ type, id, kind: 'preflight' });
      const reviewFindings = await getLatestFindings({ type, id, kind: 'review' });

      // Get checklists
      const checklists = await listChecklists({ type, id, limit: 10 });

      sendSuccess(
        res,
        {
          preflight: preflightFindings,
          review: reviewFindings,
          checklists,
        },
        req
      );
    } catch (error: any) {
      console.error('[publishing] Findings query error:', error);

      if (error.code) {
        return sendErrorWithStatus(
          res,
          error.code,
          error.message || 'Failed to query findings',
          req
        );
      }

      sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to query findings',
        req
      );
    }
  }
);

export default router;

