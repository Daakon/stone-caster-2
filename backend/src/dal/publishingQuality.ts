/**
 * Publishing Quality Data Access Layer
 * Phase 6: Persist and retrieve quality findings and checklists
 */

import { supabaseAdmin } from '../services/supabase.js';
import type { PublishableType } from '@shared/types/publishing.js';
import type { QualityIssue } from '../services/publishingQuality.js';

/**
 * Save quality findings
 */
export async function saveFindings(params: {
  type: PublishableType;
  id: string;
  kind: 'preflight' | 'review';
  score: number;
  issues: QualityIssue[];
}): Promise<void> {
  const { type, id, kind, score, issues } = params;

  const { error } = await supabaseAdmin
    .from('publishing_quality_findings')
    .insert({
      entity_type: type,
      entity_id: id,
      kind,
      issues: issues as any,
      score,
    });

  if (error) {
    console.error('[publishingQuality] Failed to save findings:', error);
    throw {
      code: 'INTERNAL_ERROR',
      message: 'Failed to save quality findings',
    };
  }
}

/**
 * Get latest findings for an entity
 */
export async function getLatestFindings(params: {
  type: PublishableType;
  id: string;
  kind?: 'preflight' | 'review';
}): Promise<{
  id: string;
  kind: 'preflight' | 'review';
  score: number;
  issues: QualityIssue[];
  created_at: string;
} | null> {
  const { type, id, kind } = params;

  let query = supabaseAdmin
    .from('publishing_quality_findings')
    .select('id, kind, score, issues, created_at')
    .eq('entity_type', type)
    .eq('entity_id', id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (kind) {
    query = query.eq('kind', kind);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[publishingQuality] Failed to get findings:', error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0] as any;
}

/**
 * List checklists for an entity
 */
export async function listChecklists(params: {
  type: PublishableType;
  id: string;
  limit?: number;
}): Promise<Array<{
  id: string;
  reviewer_user_id: string;
  items: Array<{ key: string; label: string; checked: boolean; note?: string }>;
  score: number;
  created_at: string;
}>> {
  const { type, id, limit = 10 } = params;

  const { data, error } = await supabaseAdmin
    .from('publishing_checklists')
    .select('id, reviewer_user_id, items, score, created_at')
    .eq('entity_type', type)
    .eq('entity_id', id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[publishingQuality] Failed to list checklists:', error);
    return [];
  }

  return (data || []) as any;
}

/**
 * Save a checklist
 */
export async function saveChecklist(params: {
  type: PublishableType;
  id: string;
  reviewerUserId: string;
  items: Array<{ key: string; label: string; checked: boolean; note?: string }>;
  score: number;
}): Promise<void> {
  const { type, id, reviewerUserId, items, score } = params;

  const { error } = await supabaseAdmin
    .from('publishing_checklists')
    .insert({
      entity_type: type,
      entity_id: id,
      reviewer_user_id: reviewerUserId,
      items: items as any,
      score,
    });

  if (error) {
    console.error('[publishingQuality] Failed to save checklist:', error);
    throw {
      code: 'INTERNAL_ERROR',
      message: 'Failed to save checklist',
    };
  }
}

