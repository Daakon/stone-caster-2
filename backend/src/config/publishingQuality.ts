/**
 * Publishing Quality Configuration
 * Phase 6: Quality gates and scoring thresholds
 */

/**
 * Minimum score required for approval when hard enforcement is enabled
 * @default 60
 */
export const MIN_SCORE_FOR_APPROVAL = parseInt(
  process.env.MIN_SCORE_FOR_APPROVAL ?? '60',
  10
);

/**
 * Whether to hard-enforce quality thresholds (block approvals below threshold)
 * Only applies when FF_PUBLISHING_QUALITY_GATES is enabled
 * @default false
 */
export const HARD_ENFORCE = process.env.QUALITY_HARD_ENFORCE === 'true';

/**
 * Quality rule weights (penalties subtracted from 100)
 */
export const QUALITY_WEIGHTS = {
  MISSING_NAME: 20,
  NAME_TOO_SHORT: 10,
  NAME_TOO_LONG: 5,
  MISSING_DESCRIPTION: 25,
  DESCRIPTION_TOO_SHORT: 15,
  DESCRIPTION_TOO_LONG: 5,
  PARENT_WORLD_NOT_PUBLIC: 30,
  PARENT_WORLD_NOT_APPROVED: 30,
  DEPENDENCY_INVALID: 30,
  MISSING_TAGS: 5,
  CONTENT_TOO_SHORT: 10,
} as const;

/**
 * Minimum/maximum length requirements
 */
export const QUALITY_LIMITS = {
  NAME_MIN_LENGTH: 3,
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MIN_LENGTH: 10,
  DESCRIPTION_MAX_LENGTH: 5000,
  CONTENT_MIN_LENGTH: 50,
} as const;



