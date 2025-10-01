import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { validateRequest, rateLimit } from '../middleware/validation.js';
import { TelemetryEventSchema } from 'shared';
import { ApiErrorCode } from 'shared';

const router = Router();

// Submit telemetry event (rate limited)
router.post('/event', rateLimit(60000, 100), validateRequest(TelemetryEventSchema, 'body'), async (req: Request, res: Response) => {
  try {
    const { event, properties, timestamp } = req.body;

    // Mock telemetry processing - in real implementation, this would send to analytics service
    const telemetryResult = {
      event,
      properties,
      timestamp: timestamp || new Date().toISOString(),
      processed: true,
    };

    sendSuccess(res, telemetryResult, req);
  } catch (error) {
    console.error('Error processing telemetry event:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to process telemetry event',
      req
    );
  }
});

export default router;
