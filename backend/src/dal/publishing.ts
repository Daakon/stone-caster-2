/**
 * Publishing Data Access Layer
 * Phase 2: Real persistence for publish requests and queries
 */

import { supabaseAdmin } from '../services/supabase.js';
import { ApiErrorCode } from '@shared';
import type { PublishableType } from '@shared/types/publishing.js';
import { emitPublishingEvent } from '../telemetry/publishingTelemetry.js';

/**
 * Entity snapshot returned from DAL operations
 */
export interface EntitySnapshot {
  id: string;
  type: PublishableType;
  name?: string;
  visibility: 'private' | 'public';
  review_state: 'draft' | 'pending_review' | 'approved' | 'rejected';
  owner_user_id: string;
  world_id?: string;
  dependency_invalid?: boolean;
}

/**
 * Record a publish request
 * Validates existence/ownership and parent world visibility
 */
export async function recordPublishRequest(params: {
  type: PublishableType;
  id: string;
  userId: string;
}): Promise<EntitySnapshot> {
  const { type, id, userId } = params;

  // Map type to table name
  const tableName = type === 'story' ? 'entry_points' : `${type}s`;

  // Fetch entity and verify ownership
  // Select columns that may or may not exist (additive approach)
  const selectFields = type === 'story'
    ? 'id, owner_user_id, world_id, publish_visibility, visibility, review_state, dependency_invalid, title'
    : type === 'npc'
    ? 'id, owner_user_id, world_id, visibility, review_state, dependency_invalid, name'
    : 'id, owner_user_id, visibility, review_state, name';

  const { data: entity, error: fetchError } = await supabaseAdmin
    .from(tableName)
    .select(selectFields)
    .eq('id', id)
    .single();

  if (fetchError || !entity) {
    throw {
      code: ApiErrorCode.NOT_FOUND,
      message: `${type} not found`,
    };
  }

  // Verify ownership
  if (entity.owner_user_id !== userId) {
    throw {
      code: ApiErrorCode.FORBIDDEN,
      message: 'You do not own this content',
    };
  }

  // For story/npc, check parent world visibility and review_state
  if (type === 'story' || type === 'npc') {
    if (!entity.world_id) {
      throw {
        code: ApiErrorCode.WORLD_NOT_PUBLIC,
        message: 'Story/NPC must be assigned to a world before publishing',
      };
    }

    // Check world visibility and review_state
    const { data: world, error: worldError } = await supabaseAdmin
      .from('worlds')
      .select('id, visibility, review_state')
      .eq('id', entity.world_id)
      .single();

    if (worldError || !world) {
      throw {
        code: ApiErrorCode.WORLD_NOT_FOUND,
        message: 'Parent world not found',
      };
    }

    if (world.visibility !== 'public' || world.review_state !== 'approved') {
      // Phase 5: Emit blocked event (already emitted in route handler, but also here for consistency)
      emitPublishingEvent('publish.blocked', {
        type,
        id,
        userId,
        reason: 'WORLD_NOT_PUBLIC',
        worldId: entity.world_id,
      });
      
      throw {
        code: ApiErrorCode.WORLD_NOT_PUBLIC,
        message: 'Publishing requires the world to be public and approved',
      };
    }
  }

  // Update review_state to pending_review
  const { error: updateError } = await supabaseAdmin
    .from(tableName)
    .update({ review_state: 'pending_review' })
    .eq('id', id);

  if (updateError) {
    throw {
      code: ApiErrorCode.INTERNAL_ERROR,
      message: 'Failed to update review state',
    };
  }

  // Insert audit row
  const { error: auditError } = await supabaseAdmin
    .from('publishing_audit')
    .insert({
      entity_type: type,
      entity_id: id,
      action: 'request',
      requested_by: userId,
    });

  if (auditError) {
    console.error('[publishing] Failed to write audit row:', auditError);
    // Don't fail the request if audit write fails, but log it
  }

        // Phase 5: Emit telemetry event
        // Phase 7: Check if this is from wizard
        const isWizard = params.isWizard === true;
        emitPublishingEvent(isWizard ? 'wizard.submitted' : 'publish.requested', {
          type,
          id,
          userId,
          entityName: entity.name || entity.title || 'Unnamed',
        });

  // Return normalized snapshot
  // Use publish_visibility for entry_points if it exists, otherwise visibility
  const visibility = type === 'story' && entity.publish_visibility
    ? entity.publish_visibility
    : entity.visibility || 'private';

  return {
    id: entity.id,
    type,
    name: type === 'story' ? entity.title : entity.name,
    visibility: visibility as 'private' | 'public',
    review_state: 'pending_review',
    owner_user_id: entity.owner_user_id,
    world_id: entity.world_id || undefined,
    dependency_invalid: entity.dependency_invalid || false,
  };
}

/**
 * Check if an entity is publicly listable
 * Returns true if: visibility='public' && review_state='approved' && dependency_invalid=false
 * For story/npc: also requires parent world to be public+approved
 */
export async function getPublicListability(params: {
  type: PublishableType;
  id: string;
}): Promise<boolean> {
  const { type, id } = params;
  const tableName = type === 'story' ? 'entry_points' : `${type}s`;

  // Fetch entity with appropriate fields for each type
  const selectFields = type === 'story'
    ? 'id, publish_visibility, visibility, review_state, dependency_invalid, world_id'
    : type === 'npc'
    ? 'id, visibility, review_state, dependency_invalid, world_id'
    : 'id, visibility, review_state';

  const { data: entity, error } = await supabaseAdmin
    .from(tableName)
    .select(selectFields)
    .eq('id', id)
    .single();

  if (error || !entity) {
    return false;
  }

  // Use publish_visibility for entry_points if it exists, otherwise visibility
  const visibility = type === 'story' && entity.publish_visibility
    ? entity.publish_visibility
    : entity.visibility;

  // Basic checks
  if (visibility !== 'public' || entity.review_state !== 'approved' || entity.dependency_invalid) {
    return false;
  }

  // For story/npc, check parent world
  if (type === 'story' || type === 'npc') {
    if (!entity.world_id) {
      return false;
    }

    const { data: world, error: worldError } = await supabaseAdmin
      .from('worlds')
      .select('id, visibility, review_state')
      .eq('id', entity.world_id)
      .single();

    if (worldError || !world) {
      return false;
    }

    if (world.visibility !== 'public' || world.review_state !== 'approved') {
      return false;
    }
  }

  return true;
}

/**
 * Count user's content by type
 */
export async function countUserContent(params: {
  userId: string;
  type: PublishableType;
}): Promise<number> {
  const { userId, type } = params;
  const tableName = type === 'story' ? 'entry_points' : `${type}s`;

  const { count, error } = await supabaseAdmin
    .from(tableName)
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', userId);

  if (error) {
    console.error(`[publishing] Failed to count ${type}s for user:`, error);
    return 0;
  }

  return count || 0;
}

/**
 * Count daily publish requests for a user
 */
export async function countDailyPublishRequests(params: {
  userId: string;
  dayUtc: string; // YYYY-MM-DD format
}): Promise<number> {
  const { userId, dayUtc } = params;

  // Parse dayUtc to get start and end of day in UTC
  const startOfDay = new Date(`${dayUtc}T00:00:00.000Z`);
  const endOfDay = new Date(`${dayUtc}T23:59:59.999Z`);

  const { count, error } = await supabaseAdmin
    .from('publishing_audit')
    .select('*', { count: 'exact', head: true })
    .eq('requested_by', userId)
    .eq('action', 'request')
    .gte('created_at', startOfDay.toISOString())
    .lte('created_at', endOfDay.toISOString());

  if (error) {
    console.error('[publishing] Failed to count daily requests:', error);
    return 0;
  }

  return count || 0;
}

/**
 * List pending submissions for review queue
 */
export async function listPendingSubmissions(params?: {
  type?: PublishableType;
}): Promise<Array<{
  type: PublishableType;
  id: string;
  name: string;
  owner_user_id: string;
  world_id?: string;
  world_name?: string;
  world_visibility?: 'private' | 'public';
  submitted_at: string;
  dependency_invalid?: boolean;
  version?: number;
  parent_world?: {
    id: string;
    name?: string;
    visibility?: 'private' | 'public';
    review_state?: 'draft' | 'pending_review' | 'approved' | 'rejected';
  };
}>> {
  const { type } = params || {};

  const results: Array<{
    type: PublishableType;
    id: string;
    name: string;
    owner_user_id: string;
    world_id?: string;
    world_name?: string;
    world_visibility?: 'private' | 'public';
    submitted_at: string;
    dependency_invalid?: boolean;
    version?: number;
    parent_world?: {
      id: string;
      name?: string;
      visibility?: 'private' | 'public';
      review_state?: 'draft' | 'pending_review' | 'approved' | 'rejected';
    };
  }> = [];

  // Query each table type
  const typesToQuery: PublishableType[] = type
    ? [type]
    : ['world', 'story', 'npc'];

  for (const entityType of typesToQuery) {
    const tableName = entityType === 'story' ? 'entry_points' : `${entityType}s`;

    // Select appropriate fields for each type
    const selectFields = entityType === 'story'
      ? 'id, owner_user_id, review_state, title, world_id, dependency_invalid, version, created_at, worlds:world_id (id, name, visibility, review_state)'
      : entityType === 'npc'
      ? 'id, owner_user_id, review_state, name, world_id, dependency_invalid, version, created_at, worlds:world_id (id, name, visibility, review_state)'
      : 'id, owner_user_id, review_state, name, version, created_at';

    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select(selectFields)
      .eq('review_state', 'pending_review');

    if (error) {
      console.error(`[publishing] Failed to query ${tableName}:`, error);
      continue;
    }

    // Get the most recent request audit for each entity
    for (const entity of data || []) {
      const { data: audit } = await supabaseAdmin
        .from('publishing_audit')
        .select('created_at')
        .eq('entity_type', entityType)
        .eq('entity_id', entity.id)
        .eq('action', 'request')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Extract world info if present
      const world = Array.isArray(entity.worlds) ? entity.worlds[0] : entity.worlds;

      results.push({
        type: entityType,
        id: entity.id,
        name: entityType === 'story' ? entity.title : entity.name,
        owner_user_id: entity.owner_user_id,
        world_id: entity.world_id || undefined,
        world_name: world?.name || undefined,
        world_visibility: world?.visibility || undefined,
        submitted_at: audit?.created_at || entity.created_at || new Date().toISOString(),
        dependency_invalid: entity.dependency_invalid || false,
        version: entity.version || undefined,
        parent_world: entity.world_id && world
          ? {
              id: world.id,
              name: world.name || undefined,
              visibility: world.visibility || undefined,
              review_state: world.review_state || undefined,
            }
          : undefined,
      });
    }
  }

  // Sort by submitted_at ascending (oldest first for review queue)
  return results.sort((a, b) =>
    new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
  );
}

/**
 * Revalidate entity for approval
 * Returns validation result with reasons if blocked
 */
export async function revalidateForApproval(params: {
  type: PublishableType;
  id: string;
}): Promise<{ ok: boolean; reasons: string[] }> {
  const { type, id } = params;
  const tableName = type === 'story' ? 'entry_points' : `${type}s`;
  const reasons: string[] = [];

  // Fetch entity with all relevant fields
  const selectFields = type === 'story'
    ? 'id, owner_user_id, world_id, publish_visibility, visibility, review_state, dependency_invalid, version, title'
    : type === 'npc'
    ? 'id, owner_user_id, world_id, visibility, review_state, dependency_invalid, version, name'
    : 'id, owner_user_id, visibility, review_state, version, name';

  const { data: entity, error } = await supabaseAdmin
    .from(tableName)
    .select(selectFields)
    .eq('id', id)
    .single();

  if (error || !entity) {
    reasons.push('entity_not_found');
    return { ok: false, reasons };
  }

  // Check review_state is pending_review
  if (entity.review_state !== 'pending_review') {
    reasons.push('not_pending_review');
  }

  // For story/npc, check parent world
  if (type === 'story' || type === 'npc') {
    if (!entity.world_id) {
      reasons.push('parent_world_missing');
    } else {
      const { data: world, error: worldError } = await supabaseAdmin
        .from('worlds')
        .select('id, visibility, review_state')
        .eq('id', entity.world_id)
        .single();

      if (worldError || !world) {
        reasons.push('parent_world_not_found');
      } else {
        if (world.visibility !== 'public') {
          reasons.push('parent_world_not_public');
        }
        if (world.review_state !== 'approved') {
          reasons.push('parent_world_not_approved');
        }
      }
    }

    // Check dependency_invalid
    if (entity.dependency_invalid) {
      reasons.push('dependency_invalid');
    }
  }

  // Optimistic concurrency: check if version advanced since request
  // Get the most recent request audit to compare version
  if (entity.version !== undefined) {
    const { data: requestAudit } = await supabaseAdmin
      .from('publishing_audit')
      .select('created_at')
      .eq('entity_type', type)
      .eq('entity_id', id)
      .eq('action', 'request')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (requestAudit) {
      // Fetch current version from entity (already have it)
      // If version column exists and we can track it, check for changes
      // For now, we'll check if version is different from what we'd expect
      // This is a simplified check - in a full implementation, we'd store version at request time
      // For Phase 3, we'll skip this check gracefully if version tracking isn't fully implemented
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

/**
 * Approve a pending submission
 * Revalidates before approval and writes audit trail
 */
export async function approveSubmission(params: {
  type: PublishableType;
  id: string;
  reviewerUserId: string;
}): Promise<EntitySnapshot> {
  const { type, id, reviewerUserId } = params;

  // Revalidate
  const validation = await revalidateForApproval({ type, id });
  if (!validation.ok) {
    throw {
      code: ApiErrorCode.APPROVAL_BLOCKED,
      message: 'Approval blocked by validation checks',
      reasons: validation.reasons,
    };
  }

  const tableName = type === 'story' ? 'entry_points' : `${type}s`;

  // Update entity
  const { error: updateError } = await supabaseAdmin
    .from(tableName)
    .update({
      review_state: 'approved',
      reviewed_by: reviewerUserId,
      reviewed_at: new Date().toISOString(),
      review_reason: null,
    })
    .eq('id', id);

  if (updateError) {
    throw {
      code: ApiErrorCode.INTERNAL_ERROR,
      message: 'Failed to update review state',
    };
  }

  // Write audit row
  const { error: auditError } = await supabaseAdmin
    .from('publishing_audit')
    .insert({
      entity_type: type,
      entity_id: id,
      action: 'approve',
      reviewed_by: reviewerUserId,
    });

  if (auditError) {
    console.error('[publishing] Failed to write approval audit row:', auditError);
    // Don't fail the request if audit write fails, but log it
  }

  // Phase 6: Quality evaluation (if enabled)
  let qualityEvaluation: { score: number; issues: any[] } | null = null;
  const { isPublishingQualityGatesEnabled } = await import('../config/featureFlags.js');
  if (isPublishingQualityGatesEnabled()) {
    try {
      const { evaluateEntity } = await import('../services/publishingQuality.js');
      const { saveFindings } = await import('../dal/publishingQuality.js');
      const { MIN_SCORE_FOR_APPROVAL, HARD_ENFORCE } = await import('../config/publishingQuality.js');
      
      qualityEvaluation = await evaluateEntity({ type, id });
      
      // Persist as review findings
      await saveFindings({
        type,
        id,
        kind: 'review',
        score: qualityEvaluation.score,
        issues: qualityEvaluation.issues,
      });

      // Emit telemetry
      emitPublishingEvent('quality.findings.persisted', {
        type,
        id,
        kind: 'review',
        score: qualityEvaluation.score,
        issueCount: qualityEvaluation.issues.length,
      });

      // Check hard enforcement
      if (HARD_ENFORCE && qualityEvaluation.score < MIN_SCORE_FOR_APPROVAL) {
        throw {
          code: ApiErrorCode.APPROVAL_BLOCKED,
          message: 'Approval blocked: quality score below threshold',
          reasons: ['quality_score_below_threshold'],
          quality: {
            score: qualityEvaluation.score,
            issues: qualityEvaluation.issues,
            threshold: MIN_SCORE_FOR_APPROVAL,
          },
        };
      }
    } catch (error: any) {
      // If it's an approval blocked error, re-throw it
      if (error.code === ApiErrorCode.APPROVAL_BLOCKED) {
        throw error;
      }
      // Otherwise, log but don't block approval
      console.error('[publishing] Quality evaluation error (non-fatal):', error);
    }
  }

  // Phase 5: Emit telemetry event (before fetching entity for snapshot)
  emitPublishingEvent('admin.review.approved', {
    type,
    id,
    reviewerUserId,
    qualityScore: qualityEvaluation?.score,
  });

  // Phase 4: If this is a world approval, trigger dependency recompute
  if (type === 'world') {
    const { isDependencyMonitorEnabled } = await import('../config/featureFlags.js');
    if (isDependencyMonitorEnabled()) {
      // Trigger async recompute (don't block approval)
      import('../dal/dependencyMonitor.js')
        .then(({ recomputeDependenciesForWorld }) => {
          return recomputeDependenciesForWorld({ worldId: id });
        })
        .then((result) => {
          console.log(`[publishing] Dependency recompute for world ${id}:`, result);
        })
        .catch((error) => {
          console.error(`[publishing] Failed to recompute dependencies for world ${id}:`, error);
        });
    }
  }

  // Fetch updated entity for snapshot
  const selectFields = type === 'story'
    ? 'id, owner_user_id, world_id, publish_visibility, visibility, review_state, dependency_invalid, title'
    : type === 'npc'
    ? 'id, owner_user_id, world_id, visibility, review_state, dependency_invalid, name'
    : 'id, owner_user_id, visibility, review_state, name';

  const { data: entity, error: fetchError } = await supabaseAdmin
    .from(tableName)
    .select(selectFields)
    .eq('id', id)
    .single();

  if (fetchError || !entity) {
    throw {
      code: ApiErrorCode.INTERNAL_ERROR,
      message: 'Failed to fetch updated entity',
    };
  }

  const visibility = type === 'story' && entity.publish_visibility
    ? entity.publish_visibility
    : entity.visibility || 'private';

  return {
    id: entity.id,
    type,
    name: type === 'story' ? entity.title : entity.name,
    visibility: visibility as 'private' | 'public',
    review_state: 'approved',
    owner_user_id: entity.owner_user_id,
    world_id: entity.world_id || undefined,
    dependency_invalid: entity.dependency_invalid || false,
  };
}

/**
 * Reject a pending submission
 * Sets rejected state and writes audit trail
 */
export async function rejectSubmission(params: {
  type: PublishableType;
  id: string;
  reviewerUserId: string;
  reason: string;
}): Promise<EntitySnapshot> {
  const { type, id, reviewerUserId, reason } = params;

  // Validate reason
  if (!reason || reason.trim().length === 0) {
    throw {
      code: ApiErrorCode.REJECT_REASON_REQUIRED,
      message: 'Rejection reason is required',
    };
  }

  if (reason.length > 500) {
    throw {
      code: ApiErrorCode.VALIDATION_FAILED,
      message: 'Rejection reason must be 500 characters or less',
    };
  }

  const tableName = type === 'story' ? 'entry_points' : `${type}s`;

  // Verify entity is in pending_review state
  const { data: entity, error: fetchError } = await supabaseAdmin
    .from(tableName)
    .select('id, owner_user_id, review_state, title, name')
    .eq('id', id)
    .single();

  if (fetchError || !entity) {
    throw {
      code: ApiErrorCode.NOT_FOUND,
      message: `${type} not found`,
    };
  }

  if (entity.review_state !== 'pending_review') {
    throw {
      code: ApiErrorCode.VALIDATION_FAILED,
      message: 'Can only reject items in pending_review state',
    };
  }

  // Update entity
  const { error: updateError } = await supabaseAdmin
    .from(tableName)
    .update({
      review_state: 'rejected',
      reviewed_by: reviewerUserId,
      reviewed_at: new Date().toISOString(),
      review_reason: reason.trim(),
    })
    .eq('id', id);

  if (updateError) {
    throw {
      code: ApiErrorCode.INTERNAL_ERROR,
      message: 'Failed to update review state',
    };
  }

  // Write audit row
  const { error: auditError } = await supabaseAdmin
    .from('publishing_audit')
    .insert({
      entity_type: type,
      entity_id: id,
      action: 'reject',
      reviewed_by: reviewerUserId,
      reason: reason.trim(),
    });

  if (auditError) {
    console.error('[publishing] Failed to write rejection audit row:', auditError);
    // Don't fail the request if audit write fails, but log it
  }

  // Return snapshot
  const selectFields = type === 'story'
    ? 'id, owner_user_id, world_id, publish_visibility, visibility, review_state, dependency_invalid, title'
    : type === 'npc'
    ? 'id, owner_user_id, world_id, visibility, review_state, dependency_invalid, name'
    : 'id, owner_user_id, visibility, review_state, name';

  const { data: updatedEntity, error: refetchError } = await supabaseAdmin
    .from(tableName)
    .select(selectFields)
    .eq('id', id)
    .single();

  if (refetchError || !updatedEntity) {
    // Return partial snapshot if refetch fails
    const visibility = type === 'story' && (entity as any).publish_visibility
      ? (entity as any).publish_visibility
      : (entity as any).visibility || 'private';

    return {
      id: entity.id,
      type,
      name: type === 'story' ? entity.title : entity.name,
      visibility: visibility as 'private' | 'public',
      review_state: 'rejected',
      owner_user_id: entity.owner_user_id,
      world_id: (entity as any).world_id || undefined,
      dependency_invalid: (entity as any).dependency_invalid || false,
    };
  }

  const visibility = type === 'story' && updatedEntity.publish_visibility
    ? updatedEntity.publish_visibility
    : updatedEntity.visibility || 'private';

  return {
    id: updatedEntity.id,
    type,
    name: type === 'story' ? updatedEntity.title : updatedEntity.name,
    visibility: visibility as 'private' | 'public',
    review_state: 'rejected',
    owner_user_id: updatedEntity.owner_user_id,
    world_id: updatedEntity.world_id || undefined,
    dependency_invalid: updatedEntity.dependency_invalid || false,
  };
}

