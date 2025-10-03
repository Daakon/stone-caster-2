import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';
import { ApiErrorCode, type ApiSuccessResponse, type ApiErrorResponse } from 'shared';

// Generate or extract trace ID from request
export function getTraceId(req: Request): string {
  const traceId = req.headers['x-trace-id'] as string;
  return traceId && isValidUuid(traceId) ? traceId : uuidv4();
}

// Check if string is valid UUID
function isValidUuid(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Create success response
export function createSuccessResponse<T>(
  data: T,
  req: Request,
  version?: string
): ApiSuccessResponse<T> {
  return {
    ok: true,
    data,
    meta: {
      traceId: getTraceId(req),
      version,
    },
  };
}

// Create error response
export function createErrorResponse(
  code: ApiErrorCode,
  message: string,
  req: Request,
  details?: unknown
): ApiErrorResponse {
  return {
    ok: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      traceId: getTraceId(req),
    },
  };
}

// Send success response
export function sendSuccess<T>(
  res: Response,
  data: T,
  req: Request,
  statusCode: number = 200,
  version?: string
): void {
  const response = createSuccessResponse(data, req, version);
  res.status(statusCode).json(response);
}

// Send error response
export function sendError(
  res: Response,
  code: ApiErrorCode,
  message: string,
  req: Request,
  statusCode: number = 500,
  details?: unknown
): void {
  const response = createErrorResponse(code, message, req, details);
  res.status(statusCode).json(response);
}

// HTTP status code mapping for error codes
export const ERROR_STATUS_MAP: Record<ApiErrorCode, number> = {
  [ApiErrorCode.VALIDATION_FAILED]: 422,
  [ApiErrorCode.UNAUTHORIZED]: 401,
  [ApiErrorCode.FORBIDDEN]: 403,
  [ApiErrorCode.NOT_FOUND]: 404,
  [ApiErrorCode.CONFLICT]: 409,
  [ApiErrorCode.RATE_LIMITED]: 429,
  [ApiErrorCode.IDEMPOTENCY_REQUIRED]: 400,
  [ApiErrorCode.INSUFFICIENT_STONES]: 402,
  [ApiErrorCode.INSUFFICIENT_INVENTORY]: 400,
  [ApiErrorCode.INVALID_PACK]: 400,
  [ApiErrorCode.PAYMENT_FAILED]: 400,
  [ApiErrorCode.COOKIE_CAP]: 429,
  [ApiErrorCode.CONFIG_NOT_FOUND]: 404,
  [ApiErrorCode.FLAG_NOT_FOUND]: 404,
  [ApiErrorCode.PROMPT_NOT_FOUND]: 404,
  [ApiErrorCode.PROMPT_VERSION_CONFLICT]: 409,
  [ApiErrorCode.CSRF_TOKEN_INVALID]: 400,
  [ApiErrorCode.REQUIRES_AUTH]: 401,
  [ApiErrorCode.INTERNAL_ERROR]: 500,
};

// Send error with appropriate status code
export function sendErrorWithStatus(
  res: Response,
  code: ApiErrorCode,
  message: string,
  req: Request,
  details?: unknown
): void {
  const statusCode = ERROR_STATUS_MAP[code];
  sendError(res, code, message, req, statusCode, details);
}
