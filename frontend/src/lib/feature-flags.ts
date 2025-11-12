/**
 * Feature Flags
 * Centralized feature flag management
 */

/**
 * Check if admin prompt forms are enabled
 * Default: true in dev/staging, false in prod
 */
export function isAdminPromptFormsEnabled(): boolean {
  const envValue = import.meta.env.VITE_ADMIN_PROMPT_FORMS_ENABLED;
  
  // If explicitly set, use that value
  if (envValue !== undefined) {
    return envValue === 'true' || envValue === '1';
  }
  
  // Default: enabled in dev/staging, disabled in prod
  const isProd = import.meta.env.PROD;
  return !isProd;
}

/**
 * Check if legacy prompt textarea is retired
 * Default: false (keep legacy for rollback safety)
 */
export function isLegacyPromptTextareaRetired(): boolean {
  const envValue = import.meta.env.VITE_ADMIN_RETIRED_PROMPT_TEXTAREA;
  
  // If explicitly set, use that value
  if (envValue !== undefined) {
    return envValue === 'true' || envValue === '1';
  }
  
  // Default: false (keep legacy available)
  return false;
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
  const envValue = import.meta.env.VITE_FF_PUBLISH_GATES_OWNER;
  return envValue === 'true' || envValue === '1';
}

/**
 * Enable admin review queue
 * @default false
 */
export function isAdminReviewQueueEnabled(): boolean {
  const envValue = import.meta.env.VITE_FF_ADMIN_REVIEW_QUEUE;
  return envValue === 'true' || envValue === '1';
}

/**
 * Enable dependency monitor
 * @default false
 */
export function isDependencyMonitorEnabled(): boolean {
  const envValue = import.meta.env.VITE_FF_DEPENDENCY_MONITOR;
  return envValue === 'true' || envValue === '1';
}

/**
 * Enable publishing wizard entry point in admin UI
 * @default false
 */
export function isPublishingWizardEntryEnabled(): boolean {
  const envValue = import.meta.env.VITE_FF_PUBLISHING_WIZARD_ENTRY;
  return envValue === 'true' || envValue === '1';
}

/**
 * Enable publishing audit viewer and admin activity feed
 * Phase 5: @default false
 */
export function isPublishingAuditViewerEnabled(): boolean {
  const envValue = import.meta.env.VITE_FF_PUBLISHING_AUDIT_VIEWER;
  return envValue === 'true' || envValue === '1';
}

/**
 * Enable publishing notifications and creator messaging polish
 * Phase 5: @default false
 */
export function isPublishingNotificationsEnabled(): boolean {
  const envValue = import.meta.env.VITE_FF_PUBLISHING_NOTIFICATIONS;
  return envValue === 'true' || envValue === '1';
}

/**
 * Enable publishing preflight checks for creators
 * Phase 6: @default false
 */
export function isPublishingPreflightEnabled(): boolean {
  const envValue = import.meta.env.VITE_FF_PUBLISHING_PREFLIGHT;
  return envValue === 'true' || envValue === '1';
}

/**
 * Enable publishing quality gates
 * Phase 6: @default false
 */
export function isPublishingQualityGatesEnabled(): boolean {
  const envValue = import.meta.env.VITE_FF_PUBLISHING_QUALITY_GATES;
  return envValue === 'true' || envValue === '1';
}

/**
 * Enable publishing admin checklists
 * Phase 6: @default false
 */
export function isPublishingChecklistsEnabled(): boolean {
  const envValue = import.meta.env.VITE_FF_PUBLISHING_CHECKLISTS;
  return envValue === 'true' || envValue === '1';
}

/**
 * Enable publishing wizard MVP
 * Phase 7: @default false
 */
export function isPublishingWizardEnabled(): boolean {
  const envValue = import.meta.env.VITE_FF_PUBLISHING_WIZARD;
  return envValue === 'true' || envValue === '1';
}

/**
 * Enable server-side wizard sessions (save/resume)
 * Phase 8: @default false
 */
export function isPublishingWizardSessionsEnabled(): boolean {
  const envValue = import.meta.env.VITE_FF_PUBLISHING_WIZARD_SESSIONS;
  return envValue === 'true' || envValue === '1';
}

/**
 * Enable wizard rollout gating (allowlist/percentage)
 * Phase 8: @default false
 */
export function isPublishingWizardRolloutEnabled(): boolean {
  const envValue = import.meta.env.VITE_FF_PUBLISHING_WIZARD_ROLLOUT;
  return envValue === 'true' || envValue === '1';
}

