/**
 * Internal Flags Endpoint
 * Admin-only endpoint to check feature flags
 * GET /api/internal/flags
 */

import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { adminGuard } from '../middleware/auth-admin-guard.js';
import { isEarlyAccessOn } from '../config/featureFlags.js';

const router = Router();

/**
 * GET /api/internal/flags
 * Returns current feature flag values
 * Requires: Admin role
 * Returns: { ok: true, data: { EARLY_ACCESS_MODE: 'on' | 'off' } }
 */
router.get('/flags', adminGuard, async (req: Request, res: Response) => {
  try {

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

