/**
 * Frontend Constants
 * Phase 8: Shared constants for UI
 */

// Re-export USER_QUOTAS from backend (we'll import from shared if available, otherwise use fallback)
// For now, use fallback values matching backend
export const USER_QUOTAS = {
  worlds: 1,
  stories: 3,
  npcs: 6,
} as const;

