import { ApiErrorCode } from '@shared';

/**
 * User-friendly error messages that translate technical API errors
 * into actionable, human-readable guidance
 */
export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  [ApiErrorCode.VALIDATION_FAILED]: "Please check your selection and try again.",
  [ApiErrorCode.UNAUTHORIZED]: "Please sign in to continue your adventure.",
  [ApiErrorCode.FORBIDDEN]: "You don't have permission to access this content.",
  [ApiErrorCode.NOT_FOUND]: "That adventure or character wasn't found. Please try selecting from the list above.",
  [ApiErrorCode.CONFLICT]: "This character is already in an active adventure. Would you like to resume that game instead?",
  [ApiErrorCode.RATE_LIMITED]: "You're moving too fast! Please wait a moment and try again.",
  [ApiErrorCode.IDEMPOTENCY_REQUIRED]: "Something went wrong. Please try again.",
  [ApiErrorCode.INSUFFICIENT_STONES]: "You need more magic stones to continue. Visit the shop to get more.",
  [ApiErrorCode.INSUFFICIENT_INVENTORY]: "You don't have the right items for this action.",
  [ApiErrorCode.INVALID_PACK]: "That pack isn't available right now. Please try a different one.",
  [ApiErrorCode.PAYMENT_FAILED]: "Payment didn't go through. Please check your payment method and try again.",
  [ApiErrorCode.COOKIE_CAP]: "You've reached the limit for guest characters. Sign up to create more!",
  [ApiErrorCode.CONFIG_NOT_FOUND]: "Something's not set up right. We're working on it!",
  [ApiErrorCode.FLAG_NOT_FOUND]: "This feature isn't available yet.",
  [ApiErrorCode.PROMPT_NOT_FOUND]: "The story content isn't ready yet. Please try again later.",
  [ApiErrorCode.PROMPT_TEMPLATE_MISSING]: "The story template is missing. Please contact support.",
  [ApiErrorCode.PROMPT_VERSION_CONFLICT]: "The story has been updated. Please refresh and try again.",
  [ApiErrorCode.CSRF_TOKEN_INVALID]: "Your session expired. Please refresh the page and try again.",
  [ApiErrorCode.REQUIRES_AUTH]: "Please sign in to access this feature.",
  [ApiErrorCode.UPSTREAM_TIMEOUT]: "The story server is taking longer than usual. Please try again in a moment.",
  [ApiErrorCode.INTERNAL_ERROR]: "Something went wrong on our end. We're working to fix it!",
};

/**
 * Get a user-friendly error message for an API error code
 */
export function getFriendlyErrorMessage(errorCode: ApiErrorCode, customMessage?: string): string {
  if (customMessage) {
    return customMessage;
  }
  return ERROR_MESSAGES[errorCode] || "Something unexpected happened. Please try again.";
}

/**
 * Check if an error indicates the user should resume an existing game
 */
export function isResumeError(errorCode: ApiErrorCode): boolean {
  return errorCode === ApiErrorCode.CONFLICT;
}

/**
 * Check if an error indicates the user should sign in
 */
export function isAuthError(errorCode: ApiErrorCode): boolean {
  return errorCode === ApiErrorCode.UNAUTHORIZED || errorCode === ApiErrorCode.REQUIRES_AUTH;
}

/**
 * Check if an error indicates a temporary issue that might resolve with retry
 */
export function isRetryableError(errorCode: ApiErrorCode): boolean {
  return [
    ApiErrorCode.RATE_LIMITED,
    ApiErrorCode.UPSTREAM_TIMEOUT,
    ApiErrorCode.INTERNAL_ERROR,
  ].includes(errorCode);
}
