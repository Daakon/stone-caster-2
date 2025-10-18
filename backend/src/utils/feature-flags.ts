import { isAwfEnabled } from '../config/awf-mode.js';

// Session-level overrides for AWF bundle feature flag
const sessionOverrides = new Map<string, boolean>();

/**
 * Check if AWF bundle is enabled for a given session
 * @param ctx - Context containing sessionId and optionally userId
 * @returns true if AWF bundle is enabled, false otherwise
 */
export function isAwfBundleEnabled(ctx: { sessionId?: string; userId?: string }): boolean {
  // Use unified AWF mode manager for Phase 8
  return isAwfEnabled(ctx);
}

/**
 * Set session-level override for AWF bundle feature flag
 * @param sessionId - Session ID to override
 * @param enabled - Whether to enable AWF bundle for this session
 */
export function setAwfBundleOverride(sessionId: string, enabled: boolean): void {
  sessionOverrides.set(sessionId, enabled);
}

/**
 * Clear session-level override for AWF bundle feature flag
 * @param sessionId - Session ID to clear override for
 */
export function clearAwfBundleOverride(sessionId: string): void {
  sessionOverrides.delete(sessionId);
}

/**
 * Get all session overrides (for debugging/admin purposes)
 * @returns Map of session overrides
 */
export function getSessionOverrides(): Map<string, boolean> {
  return new Map(sessionOverrides);
}

/**
 * Clear all session overrides (for testing/cleanup)
 */
export function clearAllSessionOverrides(): void {
  sessionOverrides.clear();
}
