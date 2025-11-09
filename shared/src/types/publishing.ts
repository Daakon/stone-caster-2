import { z } from 'zod';

/**
 * World-First Publishing Types
 * Phase 0/1: Bootstrap types and constants
 */

/**
 * Visibility enum for content items
 */
export const VisibilitySchema = z.enum(['private', 'public']);
export type Visibility = z.infer<typeof VisibilitySchema>;

/**
 * Review state enum for publish workflow
 */
export const ReviewStateSchema = z.enum(['draft', 'pending_review', 'approved', 'rejected']);
export type ReviewState = z.infer<typeof ReviewStateSchema>;

/**
 * Publishable content types
 */
export const PublishableTypeSchema = z.enum(['world', 'story', 'npc']);
export type PublishableType = z.infer<typeof PublishableTypeSchema>;

/**
 * Publishing error codes
 */
export enum PublishingErrorCode {
  WORLD_NOT_PUBLIC = 'WORLD_NOT_PUBLIC',
  APPROVAL_BLOCKED_WORLD_NOT_PUBLIC = 'APPROVAL_BLOCKED_WORLD_NOT_PUBLIC',
  PUBLISH_REQUEST_SUBMITTED = 'PUBLISH_REQUEST_SUBMITTED',
  PUBLISH_REQUEST_DISABLED = 'PUBLISH_REQUEST_DISABLED',
}

/**
 * Publishing error messages
 */
export const PublishingErrorMessages = {
  [PublishingErrorCode.WORLD_NOT_PUBLIC]: 'Publishing requires the world to be public.',
  [PublishingErrorCode.APPROVAL_BLOCKED_WORLD_NOT_PUBLIC]: 'Approval blocked: World is not public.',
  [PublishingErrorCode.PUBLISH_REQUEST_SUBMITTED]: 'Publish request submitted',
  [PublishingErrorCode.PUBLISH_REQUEST_DISABLED]: 'Publish request feature is currently disabled',
} as const;

/**
 * Telemetry event names for publishing
 */
export const PublishingTelemetryEvents = {
  PUBLISH_REQUESTED: 'publish.requested',
  PUBLISH_BLOCKED: 'publish.blocked',
  ADMIN_REVIEW_APPROVED: 'admin.review.approved',
  ADMIN_REVIEW_REJECTED: 'admin.review.rejected',
  DEPENDENCY_INVALID_SET: 'dependency.invalid.set',
  DEPENDENCY_INVALID_CLEARED: 'dependency.invalid.cleared',
} as const;

/**
 * Request publish request schema
 */
export const RequestPublishRequestSchema = z.object({
  type: PublishableTypeSchema,
  id: z.string().uuid(),
});

export type RequestPublishRequest = z.infer<typeof RequestPublishRequestSchema>;

/**
 * Request publish response schema
 */
export const RequestPublishResponseSchema = z.object({
  id: z.string().uuid(),
  type: PublishableTypeSchema,
  review_state: ReviewStateSchema,
  visibility: VisibilitySchema,
});

export type RequestPublishResponse = z.infer<typeof RequestPublishResponseSchema>;

/**
 * Admin review approve request schema
 */
export const AdminReviewApproveRequestSchema = z.object({
  reason: z.string().optional(),
});

export type AdminReviewApproveRequest = z.infer<typeof AdminReviewApproveRequestSchema>;

/**
 * Admin review reject request schema
 */
export const AdminReviewRejectRequestSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

export type AdminReviewRejectRequest = z.infer<typeof AdminReviewRejectRequestSchema>;

/**
 * Pending submission item schema
 */
export const PendingSubmissionSchema = z.object({
  id: z.string().uuid(),
  type: PublishableTypeSchema,
  name: z.string(),
  owner_user_id: z.string().uuid(),
  world_id: z.string().optional(),
  world_name: z.string().optional(),
  world_visibility: VisibilitySchema.optional(),
  submitted_at: z.string().datetime(),
  dependency_invalid: z.boolean().optional(),
  version: z.number().optional(),
  parent_world: z
    .object({
      id: z.string(),
      name: z.string().optional(),
      visibility: VisibilitySchema.optional(),
      review_state: ReviewStateSchema.optional(),
    })
    .optional(),
});

export type PendingSubmission = z.infer<typeof PendingSubmissionSchema>;

/**
 * Publishing flags response schema
 */
export const PublishingFlagsResponseSchema = z.object({
  publishGatesOwner: z.boolean(),
  adminReviewQueue: z.boolean(),
  dependencyMonitor: z.boolean(),
  publishingWizardEntry: z.boolean(),
});

export type PublishingFlagsResponse = z.infer<typeof PublishingFlagsResponseSchema>;

/**
 * Publishing audit row schema (Phase 5)
 */
export const PublishingAuditRowSchema = z.object({
  id: z.string().uuid(),
  entity_type: PublishableTypeSchema,
  entity_id: z.string().uuid(),
  action: z.enum(['request', 'approve', 'reject', 'auto-reject', 'auto-clear']),
  requested_by: z.string().uuid().nullable(),
  reviewed_by: z.string().uuid().nullable(),
  reason: z.string().nullable(),
  created_at: z.string().datetime(),
});

export type PublishingAuditRow = z.infer<typeof PublishingAuditRowSchema>;

/**
 * Publishing event union for telemetry (Phase 5)
 */
export type PublishingEvent =
  | 'publish.requested'
  | 'publish.blocked'
  | 'admin.review.approved'
  | 'admin.review.rejected'
  | 'dependency.invalid.set'
  | 'dependency.invalid.cleared'
  | 'creator.preflight.run'
  | 'admin.checklist.saved'
  | 'quality.findings.persisted'
  | 'wizard.opened'
  | 'wizard.step.completed'
  | 'wizard.submitted'
  | 'wizard.session.saved'
  | 'wizard.session.cleared'
  | 'wizard.rollout.blocked'
  | 'wizard.step.timing';

/**
 * Quality issue (Phase 6)
 */
export interface QualityIssue {
  code: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  path?: string;
  tip?: string;
}

/**
 * Quality findings (Phase 6)
 */
export interface QualityFindings {
  score: number;
  issues: QualityIssue[];
  created_at: string;
  kind: 'preflight' | 'review';
}

/**
 * Checklist item (Phase 6)
 */
export interface ChecklistItem {
  key: string;
  label: string;
  checked: boolean;
  note?: string;
}

/**
 * Checklist record (Phase 6)
 */
export interface ChecklistRecord {
  items: ChecklistItem[];
  score: number;
  created_at: string;
}

