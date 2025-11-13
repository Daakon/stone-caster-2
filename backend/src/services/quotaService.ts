/**
 * Quota Service
 * Phase 8: Enforce per-user quotas for worlds, stories, and NPCs
 */

import { supabaseAdmin } from './supabase.js';
import { ApiErrorCode } from '@shared';

export interface QuotaLimits {
  worlds?: number;
  stories?: number;
  npcs?: number;
}

export interface QuotaCheck {
  type: 'world' | 'story' | 'npc';
  limit: number;
  current: number;
  remaining: number;
}

/**
 * User quota limits (Phase 8)
 * Refinement: Centralized config for easy updates and documentation
 */
export const USER_QUOTAS = {
  worlds: 1,
  stories: 3,
  npcs: 6,
} as const;

/**
 * Default quota limits (uses USER_QUOTAS)
 */
const DEFAULT_QUOTAS: QuotaLimits = USER_QUOTAS;

/**
 * Count entities for a user (excluding published ones)
 * Phase 8: Counts draft, in_review, and rejected items
 */
async function countUserEntities(
  userId: string,
  entityType: 'world' | 'story' | 'npc'
): Promise<number> {
  const tableName = entityType === 'story' ? 'entry_points' : `${entityType}s`;

  // Count entities where owner_user_id matches and publish_status is not 'published'
  // Note: We check both publish_status (if exists) and review_state/visibility for backward compatibility
  // Phase 8: Count draft, in_review, and rejected items (not published)
  const { count, error } = await supabaseAdmin
    .from(tableName)
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', userId)
    .or('publish_status.is.null,publish_status.eq.draft,publish_status.eq.in_review,publish_status.eq.rejected');

  if (error) {
    console.error(`[quotaService] Error counting ${entityType} for user ${userId}:`, error);
    // Fail open - don't block if we can't count
    return 0;
  }

  return count || 0;
}

/**
 * Assert user is within quota for specified entity types
 * Throws QUOTA_EXCEEDED error if limit would be exceeded
 */
export async function assertUserWithinQuota(
  userId: string,
  quotas: QuotaLimits = DEFAULT_QUOTAS
): Promise<void> {
  const checks: QuotaCheck[] = [];

  if (quotas.worlds !== undefined) {
    const current = await countUserEntities(userId, 'world');
    const remaining = quotas.worlds - current;
    checks.push({ type: 'world', limit: quotas.worlds, current, remaining });

    if (remaining <= 0) {
      throw {
        code: ApiErrorCode.QUOTA_EXCEEDED,
        message: `You've reached the maximum (${quotas.worlds}) world${quotas.worlds === 1 ? '' : 's'}. Delete a draft or wait for review to complete.`,
        details: {
          type: 'world',
          limit: quotas.worlds,
          current,
          remaining: 0,
        },
      };
    }
  }

  if (quotas.stories !== undefined) {
    const current = await countUserEntities(userId, 'story');
    const remaining = quotas.stories - current;
    checks.push({ type: 'story', limit: quotas.stories, current, remaining });

    if (remaining <= 0) {
      throw {
        code: ApiErrorCode.QUOTA_EXCEEDED,
        message: `You've reached the maximum (${quotas.stories}) stor${quotas.stories === 1 ? 'y' : 'ies'}. Delete a draft or wait for review to complete.`,
        details: {
          type: 'story',
          limit: quotas.stories,
          current,
          remaining: 0,
        },
      };
    }
  }

  if (quotas.npcs !== undefined) {
    const current = await countUserEntities(userId, 'npc');
    const remaining = quotas.npcs - current;
    checks.push({ type: 'npc', limit: quotas.npcs, current, remaining });

    if (remaining <= 0) {
      throw {
        code: ApiErrorCode.QUOTA_EXCEEDED,
        message: `You've reached the maximum (${quotas.npcs}) NPC${quotas.npcs === 1 ? '' : 's'}. Delete a draft or wait for review to complete.`,
        details: {
          type: 'npc',
          limit: quotas.npcs,
          current,
          remaining: 0,
        },
      };
    }
  }
}

/**
 * Get current quota status for a user
 */
export async function getUserQuotaStatus(
  userId: string,
  quotas: QuotaLimits = DEFAULT_QUOTAS
): Promise<QuotaCheck[]> {
  const checks: QuotaCheck[] = [];

  if (quotas.worlds !== undefined) {
    const current = await countUserEntities(userId, 'world');
    checks.push({
      type: 'world',
      limit: quotas.worlds,
      current,
      remaining: Math.max(0, quotas.worlds - current),
    });
  }

  if (quotas.stories !== undefined) {
    const current = await countUserEntities(userId, 'story');
    checks.push({
      type: 'story',
      limit: quotas.stories,
      current,
      remaining: Math.max(0, quotas.stories - current),
    });
  }

  if (quotas.npcs !== undefined) {
    const current = await countUserEntities(userId, 'npc');
    checks.push({
      type: 'npc',
      limit: quotas.npcs,
      current,
      remaining: Math.max(0, quotas.npcs - current),
    });
  }

  return checks;
}

