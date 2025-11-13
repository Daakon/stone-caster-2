/**
 * Media Approval Routes
 * Phase 2d: Admin image approval endpoints
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { isAdminMediaEnabled } from '../config/featureFlags.js';
import { isAdmin } from '../middleware/auth-admin.js';
import { listPending, reviewOne, reviewBulk } from '../services/mediaApprovalService.js';
import { ListPendingQuerySchema, ReviewMediaRequestSchema, BulkReviewMediaRequestSchema } from '@shared/types/media.js';

const router = Router();

/**
 * Admin guard middleware
 */
async function requireAdmin(req: Request, res: Response, next: any) {
  const isUserAdmin = await isAdmin(req);
  if (!isUserAdmin) {
    return sendErrorWithStatus(
      res,
      ApiErrorCode.FORBIDDEN,
      'Admin access required',
      req
    );
  }
  next();
}

/**
 * GET /api/media/pending
 * List pending images for approval
 */
router.get(
  '/pending',
  authenticateToken,
  requireAdmin,
  validateRequest(ListPendingQuerySchema, 'query'),
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
      const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
      const cursor = req.query.cursor as string | undefined;
      const kind = req.query.kind as 'npc' | 'world' | 'story' | 'site' | undefined;
      const owner = req.query.owner as string | undefined;

      const result = await listPending({
        limit,
        cursor,
        kind,
        owner,
      });

      return sendSuccess(res, result, req);
    } catch (error) {
      console.error('Error listing pending images:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to list pending images',
        req
      );
    }
  }
);

/**
 * POST /api/media/:id/approve
 * Approve or reject a single image
 */
const MediaIdParamSchema = z.object({
  id: z.string().uuid(),
});

router.post(
  '/:id/approve',
  authenticateToken,
  requireAdmin,
  validateRequest(MediaIdParamSchema, 'params'),
  validateRequest(ReviewMediaRequestSchema, 'body'),
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

      const { id } = req.params;
      const { review, reason } = req.body;

      const media = await reviewOne({
        id,
        review,
        adminUserId: userId,
        reason,
      });

      return sendSuccess(res, { media }, req);
    } catch (error) {
      console.error('Error reviewing media:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          error.message,
          req
        );
      }

      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to review media',
        req
      );
    }
  }
);

/**
 * POST /api/media/approve-bulk
 * Bulk approve or reject images
 */
router.post(
  '/approve-bulk',
  authenticateToken,
  requireAdmin,
  validateRequest(BulkReviewMediaRequestSchema, 'body'),
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

      const { ids, review } = req.body;

      const result = await reviewBulk({
        ids,
        review,
        adminUserId: userId,
      });

      return sendSuccess(res, result, req);
    } catch (error) {
      console.error('Error bulk reviewing media:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to bulk review media',
        req
      );
    }
  }
);

export default router;



