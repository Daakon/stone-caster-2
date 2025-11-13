/**
 * Publishing Quotas Configuration
 * Phase 2: Soft quotas for non-admin users
 */

import { supabaseAdmin } from '../services/supabase.js';
import { isAdmin } from '../middleware/auth-admin.js';
import type { Request } from 'express';

/**
 * Default quota limits for non-admin users
 */
export const QUOTA_DEFAULTS = {
  worldsMax: 1,
  storiesMax: 3,
  npcsMax: 6,
  publishRequestsDailyMax: 5,
} as const;

/**
 * User-specific quota overrides (from user_limits table if it exists)
 */
interface UserLimits {
  worlds_max?: number;
  stories_max?: number;
  npcs_max?: number;
  publish_requests_daily_max?: number;
}

/**
 * Read user-specific quota limits from user_limits table
 * Returns defaults if table doesn't exist or user has no overrides
 */
export async function readUserLimitsOrDefault(
  userId: string
): Promise<typeof QUOTA_DEFAULTS> {
  try {
    // Check if user_limits table exists
    const { data: tableExists } = await supabaseAdmin
      .from('user_limits')
      .select('worlds_max')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (!tableExists) {
      // Table might not exist, or query failed - return defaults
      return { ...QUOTA_DEFAULTS };
    }

    // Fetch user limits
    const { data: limits, error } = await supabaseAdmin
      .from('user_limits')
      .select('worlds_max, stories_max, npcs_max, publish_requests_daily_max')
      .eq('user_id', userId)
      .single();

    if (error || !limits) {
      return { ...QUOTA_DEFAULTS };
    }

    // Merge with defaults (only override if value is provided)
    return {
      worldsMax: limits.worlds_max ?? QUOTA_DEFAULTS.worldsMax,
      storiesMax: limits.stories_max ?? QUOTA_DEFAULTS.storiesMax,
      npcsMax: limits.npcs_max ?? QUOTA_DEFAULTS.npcsMax,
      publishRequestsDailyMax:
        limits.publish_requests_daily_max ??
        QUOTA_DEFAULTS.publishRequestsDailyMax,
    };
  } catch (error) {
    // If table doesn't exist or any error, return defaults gracefully
    console.warn('[quotas] Failed to read user limits, using defaults:', error);
    return { ...QUOTA_DEFAULTS };
  }
}

/**
 * Check if user is exempt from quotas (admin users)
 */
export async function isQuotaExempt(req: Request): Promise<boolean> {
  return await isAdmin(req);
}



