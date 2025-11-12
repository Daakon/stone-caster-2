/**
 * Error taxonomy and standardized toasts
 * PR11-E: Map common API errors to user-friendly messages
 */

import { toast } from 'sonner';
import type { AppError } from './errors';

export interface ErrorToast {
  code: string;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Map API error codes to user-friendly toast messages
 */
export function mapErrorToToast(error: AppError): ErrorToast | null {
  const http = error.http;
  const code = error.code;
  
  // 4xx Client Errors
  if (http >= 400 && http < 500) {
    switch (code) {
      case 'unauthorized':
        return {
          code,
          title: 'Authentication Required',
          message: 'Please sign in to continue.',
        };
      
      case 'forbidden':
      case 'EARLY_ACCESS_REQUIRED':
        return {
          code,
          title: 'Access Denied',
          message: error.message || 'You don\'t have permission to perform this action.',
        };
      
      case 'not_found':
        return {
          code,
          title: 'Not Found',
          message: error.message || 'The requested resource could not be found.',
        };
      
      case 'validation_failed':
        return {
          code,
          title: 'Validation Error',
          message: error.message || 'Please check your input and try again.',
        };
      
      case 'INSUFFICIENT_STONES':
        return {
          code,
          title: 'Insufficient Stones',
          message: error.message || 'You don\'t have enough stones to perform this action.',
          action: {
            label: 'View Wallet',
            onClick: () => {
              window.location.href = '/profile';
            },
          },
        };
      
      case 'WORLD_NOT_FOUND':
      case 'SCENARIO_NOT_FOUND':
      case 'ENTRY_START_NOT_FOUND':
        return {
          code,
          title: 'Content Not Found',
          message: error.message || 'The requested content could not be found.',
        };
      
      default:
        return {
          code,
          title: 'Request Error',
          message: error.message || 'There was a problem with your request. Please try again.',
        };
    }
  }
  
  // 5xx Server Errors
  if (http >= 500) {
    switch (code) {
      case 'DB_CONFLICT':
      case 'IDEMPOTENCY_CONFLICT':
        return {
          code,
          title: 'Conflict',
          message: 'A duplicate request was detected. Retrying...',
        };
      
      case 'RATE_LIMIT_EXCEEDED':
        return {
          code,
          title: 'Rate Limit Exceeded',
          message: 'Too many requests. Please wait a moment and try again.',
        };
      
      default:
        return {
          code,
          title: 'Server Error',
          message: 'Something went wrong on our end. Please try again in a moment.',
        };
    }
  }
  
  // Network errors
  if (code === 'network_error' || code === 'timeout') {
    return {
      code,
      title: 'Connection Error',
      message: 'Unable to connect to the server. Please check your internet connection.',
    };
  }
  
  // Unknown errors
  return {
    code: code || 'unknown',
    title: 'Error',
    message: error.message || 'An unexpected error occurred.',
  };
}

/**
 * Show error toast from AppError
 */
export function showErrorToast(error: AppError): void {
  const toastData = mapErrorToToast(error);
  if (!toastData) return;
  
  toast.error(toastData.title, {
    description: toastData.message,
    action: toastData.action,
    duration: 5000,
  });
}

/**
 * Hook to show toast on query/mutation error
 * Reads meta.toastOnError from query/mutation options
 */
export function useToastOnError<TError = Error>(
  queryResult: { error?: TError | null; isError?: boolean },
  meta?: { toastOnError?: boolean }
): void {
  const { error, isError } = queryResult;
  
  if (isError && error && meta?.toastOnError) {
    // Check if error is AppError
    if (error && typeof error === 'object' && 'code' in error && 'http' in error) {
      showErrorToast(error as AppError);
    } else if (error instanceof Error) {
      // Fallback for generic errors
      toast.error('Error', {
        description: error.message || 'An unexpected error occurred.',
      });
    }
  }
}

