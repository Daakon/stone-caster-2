/**
 * Publishing Messages
 * Phase 5: Centralized map from API codes to user-facing strings
 */

import { ApiErrorCode } from '@shared';

/**
 * Map API error codes to user-friendly messages
 */
export const PublishingMessages: Record<string, string> = {
  // Success messages
  PUBLISH_REQUEST_SUBMITTED: 'Your request was submitted.',
  
  // Error messages
  [ApiErrorCode.WORLD_NOT_PUBLIC]: 'Publish blocked until the world is public and approved.',
  [ApiErrorCode.QUOTA_EXCEEDED]: "You've hit today's request limit.",
  [ApiErrorCode.APPROVAL_BLOCKED]: 'This submission cannot be approved due to validation issues.',
  [ApiErrorCode.REJECT_REASON_REQUIRED]: 'A rejection reason is required.',
  
  // Review state messages
  APPROVED: 'Your submission has been approved.',
  REJECTED: 'Your submission has been rejected.',
  PENDING_REVIEW: 'Your request is pending review.',
  
  // Activity action labels (Phase 5)
  'action.request': 'Requested',
  'action.approve': 'Approved',
  'action.reject': 'Rejected',
  'action.auto-reject': 'Auto-Rejected',
  'action.auto-clear': 'Dependency Cleared',
  
  // Quality severity labels (Phase 6)
  'severity.low': 'Low',
  'severity.medium': 'Medium',
  'severity.high': 'High',
  
  // Quality tips (Phase 6)
  'quality.low_score_warning': 'Quality score is below the recommended threshold. Consider addressing the issues before approval.',
  
  // Default fallback
  DEFAULT_ERROR: 'An error occurred. Please try again.',
};

/**
 * Get a user-friendly message for an API error code
 */
export function getPublishingMessage(code: string): string {
  return PublishingMessages[code] || PublishingMessages.DEFAULT_ERROR;
}

/**
 * Get a message for review state changes
 */
export function getReviewStateMessage(state: 'approved' | 'rejected', reason?: string): string {
  if (state === 'approved') {
    return PublishingMessages.APPROVED;
  }
  
  if (state === 'rejected') {
    const baseMessage = PublishingMessages.REJECTED;
    if (reason) {
      return `${baseMessage} Reason: ${reason}`;
    }
    return baseMessage;
  }
  
  return PublishingMessages.DEFAULT_ERROR;
}

