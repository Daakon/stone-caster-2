/**
 * Feature flag helpers for Cloudflare Worker
 * Reads environment variables and provides typed access to feature flags
 */

/**
 * Get the EARLY_ACCESS_MODE flag value from Worker env
 * @param env Worker environment object
 * @returns true if EARLY_ACCESS_MODE is 'on', false otherwise
 * @default true (defaults to 'on' if missing)
 */
export function isEarlyAccessOn(env: { EARLY_ACCESS_MODE?: string }): boolean {
  return (env.EARLY_ACCESS_MODE || 'on').toLowerCase() === 'on';
}

