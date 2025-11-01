/**
 * Phase 5: Centralized API error mapping for frontend
 * Maps backend error codes to user-friendly messages and UI actions
 */

import { ApiErrorCode } from '@shared/types/api';
import type { AppError } from './errors';

export interface FieldError {
  field: string;
  message: string;
}

export interface ErrorMappingResult {
  fieldErrors?: FieldError[];
  globalMessage?: string;
  shouldShowToast?: boolean;
  shouldShowInline?: boolean;
}

/**
 * Map API error codes to user-facing error handling
 */
export function mapApiError(error: AppError): ErrorMappingResult {
  switch (error.code as ApiErrorCode) {
    case ApiErrorCode.VALIDATION_FAILED:
      // Extract field errors from details
      const details = error.details as { fieldErrors?: Array<{ field: string; message: string }> } | undefined;
      const fieldErrors: FieldError[] = details?.fieldErrors?.map((fe) => ({
        field: fe.field,
        message: fe.message,
      })) || [];
      
      return {
        fieldErrors,
        shouldShowInline: true,
        shouldShowToast: false, // Field errors are shown inline
      };

    case ApiErrorCode.ENTRY_START_NOT_FOUND:
    case ApiErrorCode.SCENARIO_NOT_FOUND:
      return {
        globalMessage: error.message,
        shouldShowInline: true,
        shouldShowToast: false,
      };

    case ApiErrorCode.LEGACY_ROUTE_RETIRED:
      return {
        globalMessage: 'This flow is no longer available. Please use the "New Game" form.',
        shouldShowInline: true,
        shouldShowToast: false,
      };

    case ApiErrorCode.DB_CONFLICT:
    case ApiErrorCode.IDEMPOTENCY_CONFLICT:
      // Retry logic should handle this, but show a transient message
      return {
        globalMessage: 'A duplicate request was detected. Retrying...',
        shouldShowToast: true,
        shouldShowInline: false,
      };

    case ApiErrorCode.RULESET_NOT_FOUND:
    case ApiErrorCode.WORLD_NOT_FOUND:
    case ApiErrorCode.WORLD_MISMATCH:
      return {
        globalMessage: error.message,
        shouldShowInline: true,
        shouldShowToast: true,
      };

    default:
      // Generic errors - show toast for transient issues
      return {
        globalMessage: error.message || 'An unexpected error occurred',
        shouldShowToast: true,
        shouldShowInline: false,
      };
  }
}

/**
 * Get human-readable error message for display
 */
export function getErrorMessage(error: AppError): string {
  const mapping = mapApiError(error);
  return mapping.globalMessage || error.message || 'An unexpected error occurred';
}

