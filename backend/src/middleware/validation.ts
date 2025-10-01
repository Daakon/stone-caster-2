import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from 'shared';

// Validation middleware factory
export function validateRequest<T>(
  schema: ZodSchema<T>,
  source: 'body' | 'params' | 'query' = 'body'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      let data: unknown;
      
      switch (source) {
        case 'body':
          data = req.body;
          break;
        case 'params':
          data = req.params;
          break;
        case 'query':
          data = req.query;
          break;
        default:
          data = req.body;
      }

      const validatedData = schema.parse(data);
      
      // Attach validated data to request
      switch (source) {
        case 'body':
          req.body = validatedData;
          break;
        case 'params':
          req.params = validatedData as any;
          break;
        case 'query':
          req.query = validatedData as any;
          break;
      }
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Request validation failed',
          req,
          { validationErrors: details }
        );
      }
      
      console.error('Validation middleware error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Validation failed',
        req
      );
    }
  };
}

// Idempotency key validation middleware
export function requireIdempotencyKey(req: Request, res: Response, next: NextFunction): void {
  const idempotencyKey = req.headers['idempotency-key'] as string;
  
  if (!idempotencyKey) {
    return sendErrorWithStatus(
      res,
      ApiErrorCode.IDEMPOTENCY_REQUIRED,
      'Idempotency-Key header is required',
      req
    );
  }
  
  // Basic UUID validation for idempotency key
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(idempotencyKey)) {
    return sendErrorWithStatus(
      res,
      ApiErrorCode.VALIDATION_FAILED,
      'Idempotency-Key must be a valid UUID',
      req
    );
  }
  
  next();
}

// Rate limiting middleware (basic implementation)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Export for testing
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}

export function rateLimit(windowMs: number = 60000, maxRequests: number = 100) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ctx?.userId || req.ip || 'anonymous';
    const now = Date.now();
    
    // Clean up expired entries
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < now) {
        rateLimitStore.delete(k);
      }
    }
    
    const current = rateLimitStore.get(key);
    
    if (!current || current.resetTime < now) {
      // New window or expired
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }
    
    if (current.count >= maxRequests) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.RATE_LIMITED,
        'Rate limit exceeded',
        req,
        {
          limit: maxRequests,
          windowMs,
          resetTime: current.resetTime,
        }
      );
    }
    
    current.count++;
    next();
  };
}
