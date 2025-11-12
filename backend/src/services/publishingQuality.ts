/**
 * Publishing Quality Service
 * Phase 6: Evaluates entities for quality issues and returns scores
 */

import { supabaseAdmin } from '../services/supabase.js';
import { QUALITY_WEIGHTS, QUALITY_LIMITS } from '../config/publishingQuality.js';
import type { PublishableType } from '@shared/types/publishing.js';

/**
 * Quality issue severity levels
 */
export type IssueSeverity = 'low' | 'medium' | 'high';

/**
 * Quality issue structure
 */
export interface QualityIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  path?: string;
  tip?: string;
}

/**
 * Quality evaluation result
 */
export interface QualityEvaluation {
  score: number;
  issues: QualityIssue[];
}

/**
 * Evaluate an entity for quality issues
 * Returns score (0-100) and list of issues
 */
export async function evaluateEntity(params: {
  type: PublishableType;
  id: string;
}): Promise<QualityEvaluation> {
  const { type, id } = params;
  const issues: QualityIssue[] = [];
  let score = 100;

  // Map type to table name
  const tableName = type === 'story' ? 'entry_points' : `${type}s`;

  // Fetch entity
  const selectFields = type === 'story'
    ? 'id, title, description, world_id, dependency_invalid, owner_user_id'
    : type === 'npc'
    ? 'id, name, description, world_id, dependency_invalid, owner_user_id'
    : 'id, name, description, owner_user_id';

  const { data: entity, error: fetchError } = await supabaseAdmin
    .from(tableName)
    .select(selectFields)
    .eq('id', id)
    .single();

  if (fetchError || !entity) {
    issues.push({
      code: 'ENTITY_NOT_FOUND',
      severity: 'high',
      message: `${type} not found`,
    });
    return { score: 0, issues };
  }

  // Get entity name/title
  const name = type === 'story' ? (entity as any).title : (entity as any).name;
  const description = (entity as any).description || '';

  // Check name
  if (!name || name.trim().length === 0) {
    issues.push({
      code: 'MISSING_NAME',
      severity: 'high',
      message: `${type === 'story' ? 'Title' : 'Name'} is required`,
      path: type === 'story' ? 'title' : 'name',
      tip: `Add a ${type === 'story' ? 'title' : 'name'} for your ${type}`,
    });
    score -= QUALITY_WEIGHTS.MISSING_NAME;
  } else {
    if (name.trim().length < QUALITY_LIMITS.NAME_MIN_LENGTH) {
      issues.push({
        code: 'NAME_TOO_SHORT',
        severity: 'medium',
        message: `${type === 'story' ? 'Title' : 'Name'} must be at least ${QUALITY_LIMITS.NAME_MIN_LENGTH} characters`,
        path: type === 'story' ? 'title' : 'name',
        tip: `Make your ${type === 'story' ? 'title' : 'name'} more descriptive`,
      });
      score -= QUALITY_WEIGHTS.NAME_TOO_SHORT;
    }
    if (name.length > QUALITY_LIMITS.NAME_MAX_LENGTH) {
      issues.push({
        code: 'NAME_TOO_LONG',
        severity: 'low',
        message: `${type === 'story' ? 'Title' : 'Name'} should be no more than ${QUALITY_LIMITS.NAME_MAX_LENGTH} characters`,
        path: type === 'story' ? 'title' : 'name',
        tip: 'Consider shortening the name for better readability',
      });
      score -= QUALITY_WEIGHTS.NAME_TOO_LONG;
    }
  }

  // Check description
  if (!description || description.trim().length === 0) {
    issues.push({
      code: 'MISSING_DESCRIPTION',
      severity: 'high',
      message: 'Description is required',
      path: 'description',
      tip: 'Add a description to help users understand your content',
    });
    score -= QUALITY_WEIGHTS.MISSING_DESCRIPTION;
  } else {
    if (description.trim().length < QUALITY_LIMITS.DESCRIPTION_MIN_LENGTH) {
      issues.push({
        code: 'DESCRIPTION_TOO_SHORT',
        severity: 'medium',
        message: `Description must be at least ${QUALITY_LIMITS.DESCRIPTION_MIN_LENGTH} characters`,
        path: 'description',
        tip: 'Provide more detail about your content',
      });
      score -= QUALITY_WEIGHTS.DESCRIPTION_TOO_SHORT;
    }
    if (description.length > QUALITY_LIMITS.DESCRIPTION_MAX_LENGTH) {
      issues.push({
        code: 'DESCRIPTION_TOO_LONG',
        severity: 'low',
        message: `Description should be no more than ${QUALITY_LIMITS.DESCRIPTION_MAX_LENGTH} characters`,
        path: 'description',
        tip: 'Consider condensing the description',
      });
      score -= QUALITY_WEIGHTS.DESCRIPTION_TOO_LONG;
    }
  }

  // For stories and NPCs, check parent world
  if (type === 'story' || type === 'npc') {
    const worldId = (entity as any).world_id;
    if (!worldId) {
      issues.push({
        code: 'MISSING_WORLD',
        severity: 'high',
        message: `${type} must be assigned to a world`,
        path: 'world_id',
        tip: 'Assign this content to a world before publishing',
      });
      score -= QUALITY_WEIGHTS.PARENT_WORLD_NOT_PUBLIC;
    } else {
      // Check world visibility and review_state
      const { data: world, error: worldError } = await supabaseAdmin
        .from('worlds')
        .select('id, visibility, review_state, name')
        .eq('id', worldId)
        .single();

      if (worldError || !world) {
        issues.push({
          code: 'WORLD_NOT_FOUND',
          severity: 'high',
          message: 'Parent world not found',
          path: 'world_id',
          tip: 'Assign this content to a valid world',
        });
        score -= QUALITY_WEIGHTS.PARENT_WORLD_NOT_PUBLIC;
      } else {
        if (world.visibility !== 'public') {
          issues.push({
            code: 'PARENT_WORLD_NOT_PUBLIC',
            severity: 'high',
            message: `Parent world "${world.name || worldId}" is not public`,
            path: 'world_id',
            tip: 'The parent world must be public before this content can be published',
          });
          score -= QUALITY_WEIGHTS.PARENT_WORLD_NOT_PUBLIC;
        }
        if (world.review_state !== 'approved') {
          issues.push({
            code: 'PARENT_WORLD_NOT_APPROVED',
            severity: 'high',
            message: `Parent world "${world.name || worldId}" is not approved`,
            path: 'world_id',
            tip: 'The parent world must be approved before this content can be published',
          });
          score -= QUALITY_WEIGHTS.PARENT_WORLD_NOT_APPROVED;
        }
      }

      // Check dependency_invalid
      const dependencyInvalid = (entity as any).dependency_invalid;
      if (dependencyInvalid === true) {
        issues.push({
          code: 'DEPENDENCY_INVALID',
          severity: 'high',
          message: 'This content has invalid dependencies',
          path: 'dependency_invalid',
          tip: 'The parent world must be public and approved to resolve this issue',
        });
        score -= QUALITY_WEIGHTS.DEPENDENCY_INVALID;
      }
    }
  }

  // Ensure score doesn't go below 0
  score = Math.max(0, score);

  return { score, issues };
}

