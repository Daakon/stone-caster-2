/**
 * Publishing Utility Functions
 * Phase 2/3: Helper functions for public listability, owner bypass, and approval reasons
 */

import type { PublishableType } from '@shared/types/publishing.js';
import { getPublicListability } from '../dal/publishing.js';

/**
 * Check if an entity is publicly listable
 * Used in catalog/search endpoints only (not owner read/play paths)
 */
export async function isPubliclyListable(params: {
  type: PublishableType;
  id: string;
}): Promise<boolean> {
  return await getPublicListability(params);
}

/**
 * Check if user is the owner of an entity
 * Used for private-play bypass
 */
export async function isOwner(params: {
  type: PublishableType;
  id: string;
  userId: string;
}): Promise<boolean> {
  const { type, id, userId } = params;
  const { supabaseAdmin } = await import('../services/supabase.js');
  
  const tableName = type === 'story' ? 'entry_points' : `${type}s`;
  
  const { data, error } = await supabaseAdmin
    .from(tableName)
    .select('owner_user_id')
    .eq('id', id)
    .single();
  
  if (error || !data) {
    return false;
  }
  
  return data.owner_user_id === userId;
}

/**
 * Normalize approval block reasons for consistent client messages
 * Phase 3: Converts reason codes to human-readable strings
 */
export function normalizeApprovalReasons(reasons: string[]): string[] {
  const reasonMap: Record<string, string> = {
    entity_not_found: 'Entity not found',
    not_pending_review: 'Item is not in pending review state',
    parent_world_missing: 'Parent world is missing',
    parent_world_not_found: 'Parent world not found',
    parent_world_not_public: 'Parent world is not public',
    parent_world_not_approved: 'Parent world is not approved',
    dependency_invalid: 'Dependencies are invalid',
    version_mismatch: 'Version has changed since request',
  };

  return reasons.map((reason) => reasonMap[reason] || reason.replace(/_/g, ' '));
}

/**
 * Check if a world row is approved and public
 * Phase 4: Helper for dependency monitoring
 */
export function isWorldApprovedPublic(worldRow: {
  visibility?: string | null;
  review_state?: string | null;
}): boolean {
  return (
    worldRow.visibility === 'public' &&
    worldRow.review_state === 'approved'
  );
}

/**
 * Derive dependency_invalid flag from world status
 * Phase 4: Returns true if world is NOT approved+public (inverse of isWorldApprovedPublic)
 */
export function deriveDependencyInvalidFromWorld(worldRow: {
  visibility?: string | null;
  review_state?: string | null;
}): boolean {
  return !isWorldApprovedPublic(worldRow);
}

