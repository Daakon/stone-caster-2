/**
 * Publishing Audit Data Access Layer
 * Phase 5: Read-only queries for publishing_audit table
 */

import { supabaseAdmin } from '../services/supabase.js';

/**
 * Audit row from database
 */
export interface AuditRow {
  id: string;
  entity_type: 'world' | 'story' | 'npc';
  entity_id: string;
  action: 'request' | 'approve' | 'reject' | 'auto-reject' | 'auto-clear';
  requested_by: string | null;
  reviewed_by: string | null;
  reason: string | null;
  created_at: string;
}

/**
 * Filters for audit queries
 */
export interface AuditFilters {
  entity_type?: 'world' | 'story' | 'npc';
  entity_id?: string;
  action?: 'request' | 'approve' | 'reject' | 'auto-reject' | 'auto-clear';
  owner_user_id?: string; // Maps to requested_by
  reviewed_by?: string;
}

/**
 * Cursor for pagination (simple created_at,id tuple encoding)
 */
export interface AuditCursor {
  created_at: string;
  id: string;
}

/**
 * Encode cursor to opaque string
 */
function encodeCursor(cursor: AuditCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
}

/**
 * Decode cursor from opaque string
 */
function decodeCursor(encoded: string): AuditCursor | null {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    return JSON.parse(decoded) as AuditCursor;
  } catch {
    return null;
  }
}

/**
 * List audit rows with filters and pagination
 */
export async function listAudit(params: {
  filters?: AuditFilters;
  limit?: number;
  cursor?: string;
}): Promise<{ items: AuditRow[]; next_cursor?: string }> {
  const { filters = {}, limit = 50, cursor } = params;

  let query = supabaseAdmin
    .from('publishing_audit')
    .select('id, entity_type, entity_id, action, requested_by, reviewed_by, reason, created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  // Apply filters
  if (filters.entity_type) {
    query = query.eq('entity_type', filters.entity_type);
  }

  if (filters.entity_id) {
    query = query.eq('entity_id', filters.entity_id);
  }

  if (filters.action) {
    query = query.eq('action', filters.action);
  }

  if (filters.owner_user_id) {
    query = query.eq('requested_by', filters.owner_user_id);
  }

  if (filters.reviewed_by) {
    query = query.eq('reviewed_by', filters.reviewed_by);
  }

  // Apply cursor (pagination)
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      // Use lt (less than) for descending order
      query = query.or(
        `created_at.lt.${decoded.created_at},and(created_at.eq.${decoded.created_at},id.lt.${decoded.id})`
      );
    }
  }

  // Apply limit
  const { data, error } = await query.limit(limit + 1); // Fetch one extra to detect has_more

  if (error) {
    console.error('[publishingAudit] Error listing audit:', error);
    throw {
      code: 'INTERNAL_ERROR',
      message: 'Failed to list audit rows',
    };
  }

  const items = (data || []).slice(0, limit) as AuditRow[];
  const hasMore = (data || []).length > limit;

  // Generate next cursor if there are more items
  let next_cursor: string | undefined;
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1];
    next_cursor = encodeCursor({
      created_at: lastItem.created_at,
      id: lastItem.id,
    });
  }

  return { items, next_cursor };
}

/**
 * List recent activity (convenience endpoint for admin feed)
 */
export async function listRecentActivity(params?: {
  limit?: number;
}): Promise<AuditRow[]> {
  const limit = params?.limit || 50;

  const { data, error } = await supabaseAdmin
    .from('publishing_audit')
    .select('id, entity_type, entity_id, action, requested_by, reviewed_by, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[publishingAudit] Error listing recent activity:', error);
    throw {
      code: 'INTERNAL_ERROR',
      message: 'Failed to list recent activity',
    };
  }

  return (data || []) as AuditRow[];
}



