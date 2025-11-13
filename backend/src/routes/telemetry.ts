import { Router } from 'express';
import { z } from 'zod';
import { TelemetryService } from '../services/telemetry.service.js';
import { configService } from '../services/config.service.js';
import { LoggerService } from '../services/logger.service.js';

const router = Router();

// Validation schemas
const TelemetryEventSchema = z.object({
  name: z.string().min(1, 'Event name is required'),
  props: z.record(z.any()).default({}),
});

const GameplayEventSchema = z.object({
  name: z.enum([
    'turn_started',
    'turn_completed', 
    'turn_failed',
    'spawn_success',
    'spawn_conflict',
    'guest_to_auth_merge',
    'purchase_attempt',
    'purchase_success',
    'purchase_failed',
    'error_shown',
    'retry_attempted',
    'game_loaded',
  ]),
  props: z.record(z.any()).default({}),
});

// Middleware to add trace ID to response
const addTraceId = (req: any, res: any, next: any) => {
  const traceId = LoggerService.generateTraceId();
  req.traceId = traceId;
  
  // Save reference to original json method before wrapping
  const originalJson = res.json.bind(res);
  
  res.json = (body: any) => {
    const responseBody = {
      ...body,
      meta: {
        traceId,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      },
    };
    // Call the original json method, not the wrapped one
    return originalJson.call(res, responseBody);
  };
  
  next();
};

// Apply trace ID middleware to all routes
router.use(addTraceId);

/**
 * POST /api/telemetry/event
 * Record a basic telemetry event
 */
router.post('/event', async (req, res) => {
  try {
    const eventData = TelemetryEventSchema.parse(req.body);
    
    const result = await TelemetryService.recordEvent({
      name: eventData.name,
      props: eventData.props,
      traceId: req.traceId || 'unknown',
      userId: req.user?.id,
      cookieId: req.headers['x-guest-cookie-id'] as string,
    });

    if (result.success) {
      res.status(200).json({
        ok: true,
        eventId: result.eventId,
      });
    } else {
      res.status(500).json({
        ok: false,
        error: {
          code: 'TELEMETRY_RECORDING_FAILED',
          message: result.error,
        },
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(422).json({
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid event data',
          details: error.errors,
        },
      });
    } else {
      console.error('Telemetry event error:', error);
      res.status(500).json({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to record telemetry event',
        },
      });
    }
  }
});

/**
 * POST /api/telemetry/gameplay
 * Record a gameplay telemetry event with enhanced context
 */
router.post('/gameplay', async (req, res) => {
  try {
    const eventData = GameplayEventSchema.parse(req.body);
    
    // Enhance props with user context
    const enhancedProps = {
      ...eventData.props,
      ownerKind: req.user ? 'user' : 'guest',
    };

    const result = await TelemetryService.recordGameplayEvent({
      name: eventData.name,
      props: enhancedProps,
      traceId: req.traceId || 'unknown',
      userId: req.user?.id,
      cookieId: req.headers['x-guest-cookie-id'] as string,
    });

    if (result.success) {
      res.status(200).json({
        ok: true,
        eventId: result.eventId,
      });
    } else {
      res.status(500).json({
        ok: false,
        error: {
          code: 'TELEMETRY_RECORDING_FAILED',
          message: result.error,
        },
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(422).json({
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid gameplay event data',
          details: error.errors,
        },
      });
    } else {
      console.error('Telemetry gameplay event error:', error);
      res.status(500).json({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to record gameplay telemetry event',
        },
      });
    }
  }
});

/**
 * GET /api/telemetry/config
 * Get telemetry configuration
 */
router.get('/config', async (req, res) => {
  try {
    const features = configService.getFeatures();
    const appConfig = configService.getApp();
    
    const telemetryEnabled = features.find(f => f.key === 'telemetry_enabled')?.enabled || false;
    const sampleRate = appConfig.telemetrySampleRate || 0.0;
    
    res.status(200).json({
      ok: true,
      data: {
        enabled: telemetryEnabled,
        sampleRate,
        features: features.filter(f => f.key.startsWith('telemetry_')),
        environment: process.env.NODE_ENV || 'development',
      },
    });
  } catch (error) {
    console.error('Telemetry config error:', error);
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get telemetry configuration',
      },
    });
  }
});

export default router;
