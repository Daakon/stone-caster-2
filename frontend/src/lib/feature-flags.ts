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

