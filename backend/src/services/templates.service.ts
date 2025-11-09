/**
 * Templates Service
 * DAO for template definitions with versioning
 */

import { supabaseAdmin } from './supabase.js';
import type { SlotType } from '../slots/registry.js';

export interface TemplateRecord {
  id: string;
  type: SlotType;
  slot: string;
  version: number;
  body: string;
  status: 'draft' | 'published';
  created_at: string;
  created_by?: string;
}

export interface PublishTemplateParams {
  type: SlotType;
  slot: string;
  body: string;
  baseVersion?: number;
  created_by?: string;
}

export interface TemplateHistoryRecord {
  version: number;
  status: 'draft' | 'published';
  created_at: string;
  created_by?: string;
}

/**
 * Get active templates (latest published per slot)
 */
export async function getActiveTemplates(
  type?: SlotType,
  templatesVersion?: number
): Promise<TemplateRecord[]> {
  // If templatesVersion is specified, get that specific version
  if (templatesVersion) {
    let query = supabaseAdmin
      .from('templates')
      .select('*')
      .eq('status', 'published')
      .eq('version', templatesVersion)
      .order('type', { ascending: true })
      .order('slot', { ascending: true });

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get active templates: ${error.message}`);
    }

    return (data || []).map(row => ({
      id: row.id,
      type: row.type as SlotType,
      slot: row.slot,
      version: row.version,
      body: row.body,
      status: row.status as 'draft' | 'published',
      created_at: row.created_at,
      created_by: row.created_by || undefined,
    }));
  }

  // Otherwise, get latest published version per (type, slot)
  // Use a subquery to find max version per (type, slot) where status='published'
  const { data, error } = await supabaseAdmin
    .from('templates')
    .select('*')
    .eq('status', 'published')
    .order('type', { ascending: true })
    .order('slot', { ascending: true })
    .order('version', { ascending: false });

  if (error) {
    throw new Error(`Failed to get active templates: ${error.message}`);
  }

  // Group by (type, slot) and take the latest version
  const latestBySlot = new Map<string, TemplateRecord>();
  for (const row of data || []) {
    const key = `${row.type}:${row.slot}`;
    if (!latestBySlot.has(key)) {
      if (type && row.type !== type) continue;
      
      latestBySlot.set(key, {
        id: row.id,
        type: row.type as SlotType,
        slot: row.slot,
        version: row.version,
        body: row.body,
        status: row.status as 'draft' | 'published',
        created_at: row.created_at,
        created_by: row.created_by || undefined,
      });
    }
  }

  return Array.from(latestBySlot.values());
}

/**
 * Get template by type, slot, and version
 */
export async function getTemplate(
  type: SlotType,
  slot: string,
  version?: number
): Promise<TemplateRecord | null> {
  let query = supabaseAdmin
    .from('templates')
    .select('*')
    .eq('type', type)
    .eq('slot', slot);

  if (version) {
    query = query.eq('version', version);
  } else {
    // Get latest published, or latest draft if no published
    query = query
      .order('status', { ascending: false }) // 'published' > 'draft'
      .order('version', { ascending: false })
      .limit(1);
  }

  const { data, error } = await query;

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get template: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return null;
  }

  const row = data[0];
  return {
    id: row.id,
    type: row.type as SlotType,
    slot: row.slot,
    version: row.version,
    body: row.body,
    status: row.status as 'draft' | 'published',
    created_at: row.created_at,
    created_by: row.created_by || undefined,
  };
}

/**
 * Publish a new version of a template
 */
export async function publishNewVersion(
  params: PublishTemplateParams
): Promise<TemplateRecord> {
  // Get current max version for this (type, slot)
  const { data: existing } = await supabaseAdmin
    .from('templates')
    .select('version')
    .eq('type', params.type)
    .eq('slot', params.slot)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  const nextVersion = params.baseVersion
    ? params.baseVersion + 1
    : (existing?.version || 0) + 1;

  // Insert new version
  const { data, error } = await supabaseAdmin
    .from('templates')
    .insert({
      type: params.type,
      slot: params.slot,
      version: nextVersion,
      body: params.body,
      status: 'published',
      created_by: params.created_by || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to publish template: ${error.message}`);
  }

  // Invalidate caches
  const { invalidateCache } = await import('./templates-cache.js');
  invalidateCache();
  const { invalidateCache: invalidateMustacheCache } = await import('./mustache-cache.js');
  invalidateMustacheCache();

  return {
    id: data.id,
    type: data.type as SlotType,
    slot: data.slot,
    version: data.version,
    body: data.body,
    status: data.status as 'draft' | 'published',
    created_at: data.created_at,
    created_by: data.created_by || undefined,
  };
}

/**
 * Get template history for a specific (type, slot)
 */
export async function getTemplateHistory(
  type: SlotType,
  slot: string
): Promise<TemplateHistoryRecord[]> {
  const { data, error } = await supabaseAdmin
    .from('templates')
    .select('version, status, created_at, created_by')
    .eq('type', type)
    .eq('slot', slot)
    .order('version', { ascending: false });

  if (error) {
    throw new Error(`Failed to get template history: ${error.message}`);
  }

  return (data || []).map(row => ({
    version: row.version,
    status: row.status as 'draft' | 'published',
    created_at: row.created_at,
    created_by: row.created_by || undefined,
  }));
}

