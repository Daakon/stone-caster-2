/**
 * Internal Flags Endpoint
 * Admin-only endpoint to check feature flags
 * GET /api/internal/flags
 */

import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { requireAuth } from '../middleware/auth.js';
import { isAdmin } from '../middleware/auth-admin.js';
import { isEarlyAccessOn } from '../config/featureFlags.js';

const router = Router();

/**
 * GET /api/internal/flags
 * Returns current feature flag values
 * Requires: Admin role
 * Returns: { ok: true, data: { EARLY_ACCESS_MODE: 'on' | 'off' } }
 */
router.get('/flags', requireAuth, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const admin = await isAdmin(req);
    if (!admin) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.FORBIDDEN,
        'Admin access required',
        req
      );
    }

    // Return feature flags
    const flags = {
      EARLY_ACCESS_MODE: isEarlyAccessOn() ? 'on' : 'off',
    };

    sendSuccess(res, flags, req);
  } catch (error) {
    console.error('Error fetching internal flags:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch internal flags',
      req
    );
  }
});

export default router;

