/**
 * Feature flag helpers for backend
 * Reads environment variables and provides typed access to feature flags
 */

/**
 * Get the EARLY_ACCESS_MODE flag value
 * @returns true if EARLY_ACCESS_MODE is 'on', false otherwise
 * @default true (defaults to 'on' if missing)
 */
export function isEarlyAccessOn(): boolean {
  return (process.env.EARLY_ACCESS_MODE || 'on').toLowerCase() === 'on';
}

/**
 * World-First Publishing feature flags
 * Phase 0/1: All default to false (additive-only bootstrap)
 */

/**
 * Enable publish gates for owners (request publish flow)
 * @default false
 */
export function isPublishGatesOwnerEnabled(): boolean {
  return process.env.FF_PUBLISH_GATES_OWNER === 'true' || process.env.FF_PUBLISH_GATES_OWNER === '1';
}

/**
 * Enable admin review queue
 * @default false
 */
export function isAdminReviewQueueEnabled(): boolean {
  return process.env.FF_ADMIN_REVIEW_QUEUE === 'true' || process.env.FF_ADMIN_REVIEW_QUEUE === '1';
}

/**
 * Enable dependency monitor
 * @default false
 */
export function isDependencyMonitorEnabled(): boolean {
  return process.env.FF_DEPENDENCY_MONITOR === 'true' || process.env.FF_DEPENDENCY_MONITOR === '1';
}

/**
 * Enable publishing wizard entry point in admin UI
 * @default false
 */
export function isPublishingWizardEntryEnabled(): boolean {
  return process.env.FF_PUBLISHING_WIZARD_ENTRY === 'true' || process.env.FF_PUBLISHING_WIZARD_ENTRY === '1';
}

/**
 * Enable publishing audit viewer and admin activity feed
 * Phase 5: @default false
 */
export function isPublishingAuditViewerEnabled(): boolean {
  return process.env.FF_PUBLISHING_AUDIT_VIEWER === 'true' || process.env.FF_PUBLISHING_AUDIT_VIEWER === '1';
}

/**
 * Enable publishing notifications and creator messaging polish
 * Phase 5: @default false
 */
export function isPublishingNotificationsEnabled(): boolean {
  return process.env.FF_PUBLISHING_NOTIFICATIONS === 'true' || process.env.FF_PUBLISHING_NOTIFICATIONS === '1';
}

/**
 * Enable publishing telemetry events
 * Phase 5: @default false
 */
export function isPublishingTelemetryEnabled(): boolean {
  return process.env.FF_PUBLISHING_TELEMETRY === 'true' || process.env.FF_PUBLISHING_TELEMETRY === '1';
}

/**
 * Enable publishing preflight checks for creators
 * Phase 6: @default false
 */
export function isPublishingPreflightEnabled(): boolean {
  return process.env.FF_PUBLISHING_PREFLIGHT === 'true' || process.env.FF_PUBLISHING_PREFLIGHT === '1';
}

/**
 * Enable publishing quality gates
 * Phase 6: @default false
 */
export function isPublishingQualityGatesEnabled(): boolean {
  return process.env.FF_PUBLISHING_QUALITY_GATES === 'true' || process.env.FF_PUBLISHING_QUALITY_GATES === '1';
}

/**
 * Enable publishing admin checklists
 * Phase 6: @default false
 */
export function isPublishingChecklistsEnabled(): boolean {
  return process.env.FF_PUBLISHING_CHECKLISTS === 'true' || process.env.FF_PUBLISHING_CHECKLISTS === '1';
}

/**
 * Enable publishing wizard (admin-only unified preflight)
 * Phase 7: @default false
 */
export function isPublishingWizardEnabled(): boolean {
  return process.env.FF_PUBLISHING_WIZARD === 'true' || process.env.FF_PUBLISHING_WIZARD === '1';
}

/**
 * Enable server-side wizard sessions (save/resume)
 * Phase 8: @default false
 */
export function isPublishingWizardSessionsEnabled(): boolean {
  return process.env.FF_PUBLISHING_WIZARD_SESSIONS === 'true' || process.env.FF_PUBLISHING_WIZARD_SESSIONS === '1';
}

/**
 * Enable wizard rollout gating (allowlist/percentage)
 * Phase 8: @default false
 */
export function isPublishingWizardRolloutEnabled(): boolean {
  return process.env.FF_PUBLISHING_WIZARD_ROLLOUT === 'true' || process.env.FF_PUBLISHING_WIZARD_ROLLOUT === '1';
}

/**
 * Enable admin media uploads (image management)
 * Phase 1: @default false
 */
export function isAdminMediaEnabled(): boolean {
  return process.env.FF_ADMIN_MEDIA === 'true' || process.env.FF_ADMIN_MEDIA === '1';
}

