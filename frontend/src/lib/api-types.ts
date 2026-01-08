/**
 * API Type Utilities
 * Safe type guards and helpers for API responses
 */

import type { ApiResponse } from '@/lib/api';

/**
 * Type guard to check if API response is successful
 */
export function isApiSuccess<T>(response: ApiResponse<T>): response is { ok: true; data: T; meta?: unknown } {
  return 'ok' in response && response.ok === true && 'data' in response;
}

/**
 * Type guard to check if API response is an error
 */
export function isApiError<T>(response: ApiResponse<T>): response is { ok: false; error: { code: string; message: string; details?: unknown } } {
  return 'ok' in response && response.ok === false && 'error' in response;
}

/**
 * Safely extract data from API response
 */
export function getApiData<T>(response: ApiResponse<T>): T | undefined {
  return isApiSuccess(response) ? response.data : undefined;
}

/**
 * Safely extract error from API response
 */
export function getApiError<T>(response: ApiResponse<T>): { code: string; message: string; details?: unknown } | undefined {
  return isApiError(response) ? response.error : undefined;
}
