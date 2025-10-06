import { Router } from 'express';
import { MetricsService } from '../../services/metrics.service.js';
import { sendSuccess, sendErrorWithStatus } from '../../utils/response.js';
import { requireAdmin } from '../../middleware/adminAuth.js';
import { ApiErrorCode } from '@shared';
import type { Request, Response } from 'express';

const router = Router();

/**
 * GET /api/admin/metrics
 * Get current metrics snapshot
 * 
 * Returns in-memory counters: request counts by route, avg latency, error counts by code
 * Admin only endpoint
 */
router.get(
  '/',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      // Get current metrics snapshot
      const snapshot = MetricsService.getSnapshot();
      
      // Get additional detailed metrics
      const topRoutes = MetricsService.getTopRoutes(10);
      const topErrors = MetricsService.getTopErrors(10);
      const uptimeString = MetricsService.getUptimeString();

      const response = {
        ...snapshot,
        topRoutes,
        topErrors,
        uptimeString,
        timestamp: new Date().toISOString(),
      };

      return sendSuccess(res, response, req);
    } catch (error) {
      console.error('Admin metrics endpoint error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to retrieve metrics',
        req
      );
    }
  }
);

/**
 * GET /api/admin/metrics/route/:route
 * Get detailed metrics for a specific route
 * 
 * Admin only endpoint
 */
router.get(
  '/route/:route',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { route } = req.params;
      const { method = 'GET' } = req.query;

      const routeMetrics = MetricsService.getRouteMetrics(route, method as string);

      const response = {
        route: `${method} ${route}`,
        ...routeMetrics,
        timestamp: new Date().toISOString(),
      };

      return sendSuccess(res, response, req);
    } catch (error) {
      console.error('Admin route metrics endpoint error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to retrieve route metrics',
        req
      );
    }
  }
);

/**
 * GET /api/admin/metrics/error/:errorCode
 * Get detailed metrics for a specific error code
 * 
 * Admin only endpoint
 */
router.get(
  '/error/:errorCode',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { errorCode } = req.params;

      const errorMetrics = MetricsService.getErrorMetrics(errorCode);

      const response = {
        errorCode,
        ...errorMetrics,
        timestamp: new Date().toISOString(),
      };

      return sendSuccess(res, response, req);
    } catch (error) {
      console.error('Admin error metrics endpoint error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to retrieve error metrics',
        req
      );
    }
  }
);

/**
 * POST /api/admin/metrics/reset
 * Reset all metrics (useful for testing)
 * 
 * Admin only endpoint
 */
router.post(
  '/reset',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      MetricsService.reset();

      return sendSuccess(res, { 
        message: 'Metrics reset successfully',
        timestamp: new Date().toISOString(),
      }, req);
    } catch (error) {
      console.error('Admin metrics reset endpoint error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to reset metrics',
        req
      );
    }
  }
);

export default router;
