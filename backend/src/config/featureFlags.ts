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

