import { describe, it, expect, vi } from 'vitest';
import { Request, Response } from 'express';
import { ApiErrorCode } from '@shared';
import {
  getTraceId,
  createSuccessResponse,
  createErrorResponse,
  sendSuccess,
  sendError,
  sendErrorWithStatus,
  ERROR_STATUS_MAP,
} from './response.js';

// Mock Express Request and Response
const createMockRequest = (headers: Record<string, string> = {}): Partial<Request> => ({
  headers,
});

const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
};

describe('Response Utilities', () => {
  describe('getTraceId', () => {
    it('should return existing valid trace ID from headers', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const req = createMockRequest({ 'x-trace-id': validUuid });
      const traceId = getTraceId(req as Request);
      expect(traceId).toBe(validUuid);
    });

    it('should generate new UUID when no trace ID header', () => {
      const req = createMockRequest();
      const traceId = getTraceId(req as Request);
      expect(traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate new UUID when invalid trace ID header', () => {
      const req = createMockRequest({ 'x-trace-id': 'invalid-uuid' });
      const traceId = getTraceId(req as Request);
      expect(traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe('createSuccessResponse', () => {
    it('should create success response with data and trace ID', () => {
      const req = createMockRequest();
      const data = { message: 'test' };
      const response = createSuccessResponse(data, req as Request);
      
      expect(response.ok).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.meta.traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should include version when provided', () => {
      const req = createMockRequest();
      const data = { message: 'test' };
      const version = '1.0.0';
      const response = createSuccessResponse(data, req as Request, version);
      
      expect(response.meta.version).toBe(version);
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response with code, message, and trace ID', () => {
      const req = createMockRequest();
      const response = createErrorResponse(
        ApiErrorCode.VALIDATION_FAILED,
        'Test error',
        req as Request
      );
      
      expect(response.ok).toBe(false);
      expect(response.error.code).toBe(ApiErrorCode.VALIDATION_FAILED);
      expect(response.error.message).toBe('Test error');
      expect(response.meta.traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should include details when provided', () => {
      const req = createMockRequest();
      const details = { field: 'test' };
      const response = createErrorResponse(
        ApiErrorCode.VALIDATION_FAILED,
        'Test error',
        req as Request,
        details
      );
      
      expect(response.error.details).toEqual(details);
    });
  });

  describe('sendSuccess', () => {
    it('should send success response with default status 200', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const data = { message: 'test' };
      
      sendSuccess(res as Response, data, req as Request);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        data,
        meta: {
          traceId: expect.any(String),
        },
      });
    });

    it('should send success response with custom status code', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const data = { message: 'test' };
      
      sendSuccess(res as Response, data, req as Request, 201);
      
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should include version when provided', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const data = { message: 'test' };
      const version = '1.0.0';
      
      sendSuccess(res as Response, data, req as Request, 200, version);
      
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        data,
        meta: {
          traceId: expect.any(String),
          version,
        },
      });
    });
  });

  describe('sendError', () => {
    it('should send error response with custom status code', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      
      sendError(res as Response, ApiErrorCode.NOT_FOUND, 'Not found', req as Request, 404);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        ok: false,
        error: {
          code: ApiErrorCode.NOT_FOUND,
          message: 'Not found',
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });
  });

  describe('sendErrorWithStatus', () => {
    it('should use correct status code from ERROR_STATUS_MAP', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      
      sendErrorWithStatus(res as Response, ApiErrorCode.UNAUTHORIZED, 'Unauthorized', req as Request);
      
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should include details when provided', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const details = { field: 'test' };
      
      sendErrorWithStatus(res as Response, ApiErrorCode.VALIDATION_FAILED, 'Validation failed', req as Request, details);
      
      expect(res.json).toHaveBeenCalledWith({
        ok: false,
        error: {
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'Validation failed',
          details,
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });
  });

  describe('ERROR_STATUS_MAP', () => {
    it('should have correct status codes for all error codes', () => {
      expect(ERROR_STATUS_MAP[ApiErrorCode.VALIDATION_FAILED]).toBe(422);
      expect(ERROR_STATUS_MAP[ApiErrorCode.UNAUTHORIZED]).toBe(401);
      expect(ERROR_STATUS_MAP[ApiErrorCode.FORBIDDEN]).toBe(403);
      expect(ERROR_STATUS_MAP[ApiErrorCode.NOT_FOUND]).toBe(404);
      expect(ERROR_STATUS_MAP[ApiErrorCode.CONFLICT]).toBe(409);
      expect(ERROR_STATUS_MAP[ApiErrorCode.RATE_LIMITED]).toBe(429);
      expect(ERROR_STATUS_MAP[ApiErrorCode.IDEMPOTENCY_REQUIRED]).toBe(400);
      expect(ERROR_STATUS_MAP[ApiErrorCode.INSUFFICIENT_STONES]).toBe(402);
      expect(ERROR_STATUS_MAP[ApiErrorCode.COOKIE_CAP]).toBe(429);
      expect(ERROR_STATUS_MAP[ApiErrorCode.INTERNAL_ERROR]).toBe(500);
    });
  });
});
