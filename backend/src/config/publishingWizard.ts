/**
 * Publishing Wizard Configuration
 * Phase 8: Rollout controls and settings
 */

/**
 * Rollout allowlist: comma-separated user IDs or emails
 * Example: WIZARD_ROLLOUT_ALLOWLIST="user-id-1,user-id-2,admin@example.com"
 */
export const ROLLOUT_ALLOWLIST = (process.env.WIZARD_ROLLOUT_ALLOWLIST ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Rollout percentage: 0-100
 * Example: WIZARD_ROLLOUT_PERCENT=10 (10% of users)
 */
export const ROLLOUT_PERCENT = parseInt(process.env.WIZARD_ROLLOUT_PERCENT ?? '0', 10);

/**
 * Check if a user is allowed to use the wizard based on rollout settings
 * Phase 8: Implements allowlist and percentage-based rollout
 * 
 * @param userId - User ID to check
 * @param userEmail - Optional user email (for allowlist matching)
 * @returns true if user is allowed, false otherwise
 */
export function isWizardAllowed(userId: string, userEmail?: string): boolean {
  // Dynamic import to avoid circular dependency
  const featureFlags = require('./featureFlags.js');
  
  // If rollout gating is disabled, allow everyone (when wizard is enabled)
  if (!featureFlags.isPublishingWizardRolloutEnabled()) {
    return true;
  }

  // Check allowlist first (exact match on userId or email)
  if (ROLLOUT_ALLOWLIST.length > 0) {
    const normalizedEmail = userEmail?.toLowerCase().trim();
    if (
      ROLLOUT_ALLOWLIST.includes(userId) ||
      (normalizedEmail && ROLLOUT_ALLOWLIST.includes(normalizedEmail))
    ) {
      return true;
    }
  }

  // Percentage-based rollout: hash userId to 0-99, allow if < ROLLOUT_PERCENT
  if (ROLLOUT_PERCENT > 0) {
    // Simple hash function for consistent assignment
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    const bucket = Math.abs(hash) % 100;
    return bucket < ROLLOUT_PERCENT;
  }

  // If rollout is enabled but no allowlist/percent set, deny by default
  return false;
}

