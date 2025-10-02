import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../services/logger.service.js';
import { MetricsService } from '../services/metrics.service.js';
import { TelemetryService } from '../services/telemetry.service.js';
import { MonitoringWrapper } from '../wrappers/monitoring.js';

// Extend Express Request type to include observability context
declare global {
  namespace Express {
    interface Request {
      traceId?: string;
      startTime?: number;
      logger?: ReturnType<typeof LoggerService.createLogger>;
    }
  }
}

/**
 * Middleware to add observability context to requests
 * - Generates traceId for request tracking
 * - Creates structured logger with traceId
 * - Records request start time for latency calculation
 */
export function observabilityMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Generate trace ID for this request
  const traceId = LoggerService.generateTraceId();
  req.traceId = traceId;
  req.startTime = Date.now();

  // Create logger with trace context
  req.logger = LoggerService.createLogger(traceId);

  // Add trace ID to response headers for debugging
  res.setHeader('X-Trace-Id', traceId);

  next();
}

/**
 * Middleware to log requests and collect metrics
 * Should be used after observabilityMiddleware
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.traceId || !req.startTime || !req.logger) {
    // Skip if observability middleware wasn't applied
    return next();
  }

  // Override res.end to capture response details
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const latencyMs = Date.now() - req.startTime!;
    
    // Record metrics
    MetricsService.recordRequest({
      route: req.route?.path || req.path,
      method: req.method,
      statusCode: res.statusCode,
      latencyMs,
      errorCode: res.statusCode >= 400 ? getErrorCodeFromStatus(res.statusCode) : undefined,
    });

    // Log the request
    req.logger!.logRequest({
      method: req.method,
      route: req.route?.path || req.path,
      statusCode: res.statusCode,
      latencyMs,
      userId: (req as any).ctx?.userId,
      cookieId: (req as any).ctx?.cookieId,
      errorCode: res.statusCode >= 400 ? getErrorCodeFromStatus(res.statusCode) : undefined,
    });

    // Call original end
    originalEnd.call(this, chunk, encoding);
  };

  next();
}

/**
 * Global error handler with observability integration
 */
export function errorHandlerMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const traceId = req.traceId || 'unknown';
  const logger = req.logger || LoggerService.createLogger(traceId);

  // Log the error
  logger.logError(error, {
    route: req.route?.path || req.path,
    method: req.method,
    userId: (req as any).ctx?.userId,
    cookieId: (req as any).ctx?.cookieId,
    errorCode: getErrorCodeFromError(error),
  });

  // Record error metrics
  MetricsService.recordError({
    route: req.route?.path || req.path,
    method: req.method,
    errorCode: getErrorCodeFromError(error),
    errorMessage: error.message,
  });

  // Send error to monitoring service
  MonitoringWrapper.captureException(error, {
    traceId,
    route: req.route?.path || req.path,
    method: req.method,
    userId: (req as any).ctx?.userId,
    cookieId: (req as any).ctx?.cookieId,
    errorCode: getErrorCodeFromError(error),
  });

  // Send error response
  if (!res.headersSent) {
    const statusCode = getStatusCodeFromError(error);
    res.status(statusCode).json({
      ok: false,
      error: {
        code: getErrorCodeFromError(error),
        message: error.message,
        traceId,
      },
    });
  }
}

/**
 * Middleware to record telemetry events for specific routes
 * Can be applied selectively to routes that need telemetry
 */
export function telemetryMiddleware(eventName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.traceId) {
      return next();
    }

    // Record telemetry event
    TelemetryService.recordEvent({
      name: eventName,
      props: {
        method: req.method,
        route: req.route?.path || req.path,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      },
      traceId: req.traceId,
      userId: (req as any).ctx?.userId,
      cookieId: (req as any).ctx?.cookieId,
    }).catch(err => {
      // Don't fail the request if telemetry fails
      console.error('Telemetry recording failed:', err);
    });

    next();
  };
}

/**
 * Helper function to get error code from HTTP status
 */
function getErrorCodeFromStatus(statusCode: number): string {
  if (statusCode >= 500) return 'INTERNAL_ERROR';
  if (statusCode === 429) return 'RATE_LIMITED';
  if (statusCode === 422) return 'VALIDATION_FAILED';
  if (statusCode === 401) return 'UNAUTHORIZED';
  if (statusCode === 403) return 'FORBIDDEN';
  if (statusCode === 404) return 'NOT_FOUND';
  if (statusCode === 409) return 'CONFLICT';
  return 'UNKNOWN_ERROR';
}

/**
 * Helper function to get error code from Error object
 */
function getErrorCodeFromError(error: Error): string {
  if (error.message.includes('validation')) return 'VALIDATION_FAILED';
  if (error.message.includes('unauthorized')) return 'UNAUTHORIZED';
  if (error.message.includes('forbidden')) return 'FORBIDDEN';
  if (error.message.includes('not found')) return 'NOT_FOUND';
  if (error.message.includes('rate limit')) return 'RATE_LIMITED';
  if (error.message.includes('conflict')) return 'CONFLICT';
  return 'INTERNAL_ERROR';
}

/**
 * Helper function to get HTTP status code from Error object
 */
function getStatusCodeFromError(error: Error): number {
  if (error.message.includes('validation')) return 422;
  if (error.message.includes('unauthorized')) return 401;
  if (error.message.includes('forbidden')) return 403;
  if (error.message.includes('not found')) return 404;
  if (error.message.includes('rate limit')) return 429;
  if (error.message.includes('conflict')) return 409;
  return 500;
}
