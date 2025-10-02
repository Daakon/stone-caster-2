import { Router } from 'express';
import { TelemetryService } from '../services/telemetry.service.js';
import { RateLimitService } from '../services/rateLimit.service.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { validateRequest } from '../middleware/validation.js';
import { TelemetryEventRequestSchema } from 'shared';
import { ApiErrorCode } from 'shared';
import type { Request, Response } from 'express';

const router = Router();

/**
 * POST /api/telemetry/event
 * Record a telemetry event
 * 
 * Body: { name: string, props?: object }
 * Response: { ok: true }
 * 
 * Rate-limited to prevent spam
 * Obeys feature flag + sample rate
 */
router.post(
  '/event',
  validateRequest(TelemetryEventRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const { name, props } = req.body;
      const traceId = req.traceId || 'unknown';
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      // Check rate limit for telemetry events
      const isAllowed = await RateLimitService.checkCookieIssueRateLimit(ipAddress);
      if (!isAllowed) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.RATE_LIMITED,
          'Too many telemetry events. Please try again later.',
          req
        );
      }

      // Record the telemetry event
      const result = await TelemetryService.recordEvent({
        name,
        props: props || {},
        traceId,
        userId: (req as any).ctx?.userId,
        cookieId: (req as any).ctx?.cookieId,
      });

      if (!result.success) {
        // If telemetry recording fails, log it but don't fail the request
        console.error('Telemetry recording failed:', result.error);
        
        // Still return success to the client to avoid breaking their flow
        return sendSuccess(res, { ok: true });
      }

      // Record the rate limit request
      try {
        await RateLimitService.recordCookieIssueRequest({
          ipAddress,
          userAgent: req.get('User-Agent'),
        });
      } catch (rateLimitError) {
        // Don't fail the request if rate limit recording fails
        console.warn('Rate limit recording failed:', rateLimitError);
      }

      return sendSuccess(res, { ok: true });
    } catch (error) {
      console.error('Telemetry endpoint error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to record telemetry event',
        req
      );
    }
  }
);

export default router;