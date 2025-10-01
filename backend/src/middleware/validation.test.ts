import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiErrorCode } from 'shared';
import {
  validateRequest,
  requireIdempotencyKey,
  rateLimit,
  clearRateLimitStore,
} from './validation.js';

// Mock response utilities
vi.mock('../utils/response.js', () => ({
  sendErrorWithStatus: vi.fn(),
}));

import { sendErrorWithStatus } from '../utils/response.js';

// Mock Express objects
const createMockRequest = (body: any = {}, params: any = {}, query: any = {}, headers: any = {}): Partial<Request> => ({
  body,
  params,
  query,
  headers,
  ctx: { userId: 'test-user' },
  ip: '127.0.0.1',
});

const createMockResponse = (): Partial<Response> => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const createMockNext = (): NextFunction => vi.fn() as unknown as NextFunction;

describe('Validation Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateRequest', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      age: z.number().int().min(0),
    });

    it('should validate request body successfully', () => {
      const req = createMockRequest({ name: 'John', age: 25 });
      const res = createMockResponse();
      const next = createMockNext();
      
      const middleware = validateRequest(testSchema, 'body');
      middleware(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
      expect(req.body).toEqual({ name: 'John', age: 25 });
    });

    it('should validate request params successfully', () => {
      const req = createMockRequest({}, { id: '123e4567-e89b-12d3-a456-426614174000' });
      const res = createMockResponse();
      const next = createMockNext();
      
      const paramSchema = z.object({
        id: z.string().uuid(),
      });
      
      const middleware = validateRequest(paramSchema, 'params');
      middleware(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
      expect(req.params).toEqual({ id: '123e4567-e89b-12d3-a456-426614174000' });
    });

    it('should validate request query successfully', () => {
      const req = createMockRequest({}, {}, { limit: '10', offset: '0' });
      const res = createMockResponse();
      const next = createMockNext();
      
      const querySchema = z.object({
        limit: z.coerce.number().int().min(1).max(100),
        offset: z.coerce.number().int().min(0),
      });
      
      const middleware = validateRequest(querySchema, 'query');
      middleware(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
      expect(req.query).toEqual({ limit: 10, offset: 0 });
    });

    it('should return validation error for invalid body', () => {
      const req = createMockRequest({ name: '', age: -5 });
      const res = createMockResponse();
      const next = createMockNext();
      
      const middleware = validateRequest(testSchema, 'body');
      middleware(req as Request, res as Response, next);
      
      expect(sendErrorWithStatus).toHaveBeenCalledWith(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Request validation failed',
        req,
        expect.objectContaining({
          validationErrors: expect.arrayContaining([
            expect.objectContaining({
              field: 'name',
              message: expect.stringContaining('String must contain at least 1 character(s)'),
            }),
            expect.objectContaining({
              field: 'age',
              message: expect.stringContaining('Number must be greater than or equal to 0'),
            }),
          ]),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return validation error for missing required fields', () => {
      const req = createMockRequest({ name: 'John' }); // missing age
      const res = createMockResponse();
      const next = createMockNext();
      
      const middleware = validateRequest(testSchema, 'body');
      middleware(req as Request, res as Response, next);
      
      expect(sendErrorWithStatus).toHaveBeenCalledWith(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Request validation failed',
        req,
        expect.objectContaining({
          validationErrors: expect.arrayContaining([
            expect.objectContaining({
              field: 'age',
              message: expect.stringContaining('Required'),
            }),
          ]),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireIdempotencyKey', () => {
    it('should pass when valid UUID is provided', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const req = createMockRequest({}, {}, {}, { 'idempotency-key': validUuid });
      const res = createMockResponse();
      const next = createMockNext();
      
      requireIdempotencyKey(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('should return error when idempotency key is missing', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();
      
      requireIdempotencyKey(req as Request, res as Response, next);
      
      expect(sendErrorWithStatus).toHaveBeenCalledWith(
        res,
        ApiErrorCode.IDEMPOTENCY_REQUIRED,
        'Idempotency-Key header is required',
        req
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return error when idempotency key is not a valid UUID', () => {
      const req = createMockRequest({}, {}, {}, { 'idempotency-key': 'invalid-uuid' });
      const res = createMockResponse();
      const next = createMockNext();
      
      requireIdempotencyKey(req as Request, res as Response, next);
      
      expect(sendErrorWithStatus).toHaveBeenCalledWith(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Idempotency-Key must be a valid UUID',
        req
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('rateLimit', () => {
    beforeEach(() => {
      // Clear rate limit store and mocks
      vi.clearAllMocks();
      clearRateLimitStore();
    });

    it('should allow requests within limit', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();
      
      const middleware = rateLimit(60000, 5); // 5 requests per minute
      
      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        middleware(req as Request, res as Response, next);
      }
      
      expect(next).toHaveBeenCalledTimes(3);
    });

    it('should block requests when limit exceeded', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();
      
      const middleware = rateLimit(60000, 2); // 2 requests per minute
      
      // Make 3 requests
      middleware(req as Request, res as Response, next);
      middleware(req as Request, res as Response, next);
      middleware(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalledTimes(2);
      expect(sendErrorWithStatus).toHaveBeenCalledWith(
        res,
        ApiErrorCode.RATE_LIMITED,
        'Rate limit exceeded',
        req,
        expect.objectContaining({
          limit: 2,
          windowMs: 60000,
        })
      );
    });

    it('should reset limit after window expires', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();
      
      const middleware = rateLimit(100, 1); // 1 request per 100ms
      
      // First request should pass
      middleware(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(1);
      
      // Second request should be blocked
      middleware(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(sendErrorWithStatus).toHaveBeenCalled();
      
      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Third request should pass
      middleware(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(2);
    });
  });
});
