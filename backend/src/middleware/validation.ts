import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';

// Validation middleware factory
// Supports both patterns:
// 1. validateRequest(schema, 'query' | 'body' | 'params')
// 2. validateRequest({ query: schema, body: schema, params: schema })
export function validateRequest<T>(
  schemaOrConfig: ZodSchema<T> | { query?: ZodSchema<any>; body?: ZodSchema<any>; params?: ZodSchema<any> },
  source?: 'body' | 'params' | 'query'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Pattern 2: Object config with query/body/params
      if (schemaOrConfig && typeof schemaOrConfig === 'object' && !('parse' in schemaOrConfig)) {
        const config = schemaOrConfig as { query?: ZodSchema<any>; body?: ZodSchema<any>; params?: ZodSchema<any> };
        
        // Validate query if schema provided
        if (config.query) {
          const validatedQuery = config.query.parse(req.query);
          req.query = validatedQuery as any;
        }
        
        // Validate body if schema provided
        if (config.body) {
          // Debug logging for lore entry creation
          if (req.path.includes('/lore') && req.method === 'POST') {
            console.log('[Validation] Request body:', JSON.stringify(req.body, null, 2));
            console.log('[Validation] Request body type:', typeof req.body);
            console.log('[Validation] Request body keys:', req.body ? Object.keys(req.body) : 'null/undefined');
            console.log('[Validation] Content-Type:', req.headers['content-type']);
          }
          const validatedBody = config.body.parse(req.body);
          req.body = validatedBody;
        }
        
        // Validate params if schema provided
        if (config.params) {
          const validatedParams = config.params.parse(req.params);
          req.params = validatedParams as any;
        }
        
        return next();
      }
      
      // Pattern 1: Direct schema with source
      const schema = schemaOrConfig as ZodSchema<T>;
      const validationSource = source || 'body';
      
      let data: unknown;
      
      switch (validationSource) {
        case 'body':
          data = req.body;
          // Debug logging for lore entry creation
          if (req.path.includes('/lore') && req.method === 'POST') {
            console.log('[Validation] Request body:', JSON.stringify(req.body, null, 2));
            console.log('[Validation] Request body type:', typeof req.body);
            console.log('[Validation] Request body keys:', req.body ? Object.keys(req.body) : 'null/undefined');
            console.log('[Validation] Content-Type:', req.headers['content-type']);
          }
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
      switch (validationSource) {
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

        // Log validation errors with request details for debugging
        console.error('[Validation] Request validation failed:', {
          method: req.method,
          path: req.path,
          validationErrors: details,
          requestBody: req.body,
          requestParams: req.params,
          requestQuery: req.query,
        });

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
