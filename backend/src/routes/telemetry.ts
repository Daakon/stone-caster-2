import { Router } from 'express';
import { TelemetryService } from '../services/telemetry.service.js';
import { RateLimitService } from '../services/rateLimit.service.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { validateRequest } from '../middleware/validation.js';
import { TelemetryEventRequestSchema, GameplayTelemetryEventSchema } from '@shared';
import { ApiErrorCode } from '@shared';
import { optionalAuth } from '../middleware/auth.js';
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
  optionalAuth,
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
        return sendSuccess(res, { ok: true }, req);
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

      return sendSuccess(res, { ok: true }, req);
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

/**
 * POST /api/telemetry/gameplay
 * Record a gameplay telemetry event (Layer M5)
 * 
 * Body: { name: GameplayEventName, props?: GameplayEventProps }
 * Response: { ok: true, eventId?: string }
 * 
 * Specialized endpoint for gameplay events with structured data
 * Includes user context and enhanced validation
 */
router.post(
  '/gameplay',
  optionalAuth,
  validateRequest(GameplayTelemetryEventSchema),
  async (req: Request, res: Response) => {
    try {
      const { name, props } = req.body;
      const traceId = req.traceId || 'unknown';
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userId = (req as any).ctx?.userId;
      const isGuest = (req as any).ctx?.isGuest;

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

      // Enhance props with user context
      const enhancedProps = {
        ...props,
        ownerKind: isGuest ? 'guest' : 'user',
        userId: userId,
      };

      // Record the gameplay telemetry event
      const result = await TelemetryService.recordEvent({
        name,
        props: enhancedProps,
        traceId,
        userId: userId,
        cookieId: isGuest ? userId : undefined,
      });

      if (!result.success) {
        // If telemetry recording fails, log it but don't fail the request
        console.error('Gameplay telemetry recording failed:', result.error);
        
        // Still return success to the client to avoid breaking their flow
        return sendSuccess(res, { ok: true }, req);
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

      return sendSuccess(res, { 
        ok: true, 
        eventId: result.eventId 
      }, req);
    } catch (error) {
      console.error('Gameplay telemetry endpoint error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to record gameplay telemetry event',
        req
      );
    }
  }
);

/**
 * GET /api/telemetry/config
 * Get telemetry configuration for QA testing (Layer M5)
 * 
 * Response: { enabled: boolean, sampleRate: number, features: object }
 * 
 * Allows QA to check telemetry settings without deploying new code
 */
router.get(
  '/config',
  async (req: Request, res: Response) => {
    try {
      const { configService } = await import('../services/config.service.js');
      const features = configService.getFeatures();
      const appConfig = configService.getApp();
      
      const telemetryEnabled = features.find(f => f.key === 'telemetry_enabled')?.enabled || false;
      const sampleRate = appConfig.telemetrySampleRate || 0.0;
      
      return sendSuccess(res, {
        enabled: telemetryEnabled,
        sampleRate: sampleRate,
        features: {
          telemetry_enabled: telemetryEnabled,
        },
        environment: process.env.NODE_ENV || 'development',
      }, req);
    } catch (error) {
      console.error('Telemetry config endpoint error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch telemetry configuration',
        req
      );
    }
  }
);

export default router;