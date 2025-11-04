/**
 * Feature flag helpers for backend
 * Reads environment variables and provides typed access to feature flags
 */

type FeatureFlagValue = 'on' | 'off';

/**
 * Get the EARLY_ACCESS_MODE flag value
 * @returns true if EARLY_ACCESS_MODE is 'on', false otherwise
 * @default true (defaults to 'on' if missing)
 */
export function isEarlyAccessOn(): boolean {
  const value = process.env.EARLY_ACCESS_MODE;
  
  if (!value) {
    console.warn('[FeatureFlags] EARLY_ACCESS_MODE not set, defaulting to "on"');
    return true;
  }
  
  const normalized = value.toLowerCase().trim() as FeatureFlagValue;
  
  if (normalized !== 'on' && normalized !== 'off') {
    console.warn(
      `[FeatureFlags] Invalid EARLY_ACCESS_MODE value: "${value}". Expected "on" or "off". Defaulting to "on".`
    );
    return true;
  }
  
  return normalized === 'on';
}

