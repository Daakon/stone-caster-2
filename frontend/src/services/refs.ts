/**
 * Refs Service
 * Scope-filtered lookups for polymorphic pickers
 * Always returns { id, name, slug } for consistent UI display
 */

import { supabase } from '@/lib/supabase';

export type RefScope = 'world' | 'ruleset' | 'entry' | 'npc';

export interface RefItem {
  id: string;
  name: string;
  slug: string;
}

export interface RefSearchOptions {
  limit?: number;
  scope?: RefScope;
}

/**
 * Search for references by scope with name/slug filtering
 * @param scope The type of reference to search
 * @param query Search query (searches name and slug)
 * @param limit Maximum number of results
 * @returns Array of reference items
 */
export async function searchRefs(
  scope: RefScope,
  query: string,
  limit: number = 20
): Promise<RefItem[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('No authentication token available');
  }

  let tableName: string;
  let selectFields: string;

  switch (scope) {
    case 'world':
      tableName = 'worlds';
      selectFields = 'id, name, slug';
      break;
    case 'ruleset':
      tableName = 'rulesets';
      selectFields = 'id, name, slug';
      break;
    case 'entry':
      tableName = 'entry_points';
      selectFields = 'id, name, slug';
      break;
    case 'npc':
      tableName = 'npcs';
      selectFields = 'id, doc->npc->name as name, id as slug'; // NPCs use id as slug
      break;
    default:
      throw new Error(`Unsupported scope: ${scope}`);
  }

  const { data, error } = await supabase
    .from(tableName)
    .select(selectFields)
    .or(`name.ilike.%${query}%,slug.ilike.%${query}%`)
    .order('name', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to search ${scope}s: ${error.message}`);
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    name: item.name || `Unnamed ${scope}`,
    slug: item.slug || item.id
  }));
}

/**
 * Get a specific reference by ID and scope
 * @param scope The type of reference
 * @param id The reference ID
 * @returns Reference item or null if not found
 */
export async function getRefById(scope: RefScope, id: string): Promise<RefItem | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('No authentication token available');
  }

  let tableName: string;
  let selectFields: string;

  switch (scope) {
    case 'world':
      tableName = 'worlds';
      selectFields = 'id, name, slug';
      break;
    case 'ruleset':
      tableName = 'rulesets';
      selectFields = 'id, name, slug';
      break;
    case 'entry':
      tableName = 'entry_points';
      selectFields = 'id, name, slug';
      break;
    case 'npc':
      tableName = 'npcs';
      selectFields = 'id, doc->npc->name as name, id as slug';
      break;
    default:
      throw new Error(`Unsupported scope: ${scope}`);
  }

  const { data, error } = await supabase
    .from(tableName)
    .select(selectFields)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get ${scope}: ${error.message}`);
  }

  return {
    id: data.id,
    name: data.name || `Unnamed ${scope}`,
    slug: data.slug || data.id
  };
}

/**
 * Get multiple references by IDs and scope
 * @param scope The type of reference
 * @param ids Array of reference IDs
 * @returns Array of reference items
 */
export async function getRefsByIds(scope: RefScope, ids: string[]): Promise<RefItem[]> {
  if (ids.length === 0) return [];

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('No authentication token available');
  }

  let tableName: string;
  let selectFields: string;

  switch (scope) {
    case 'world':
      tableName = 'worlds';
      selectFields = 'id, name, slug';
      break;
    case 'ruleset':
      tableName = 'rulesets';
      selectFields = 'id, name, slug';
      break;
    case 'entry':
      tableName = 'entry_points';
      selectFields = 'id, name, slug';
      break;
    case 'npc':
      tableName = 'npcs';
      selectFields = 'id, doc->npc->name as name, id as slug';
      break;
    default:
      throw new Error(`Unsupported scope: ${scope}`);
  }

  const { data, error } = await supabase
    .from(tableName)
    .select(selectFields)
    .in('id', ids)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to get ${scope}s: ${error.message}`);
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    name: item.name || `Unnamed ${scope}`,
    slug: item.slug || item.id
  }));
}

/**
 * Get all references for a scope (with optional filtering)
 * @param scope The type of reference
 * @param filters Optional filters
 * @returns Array of reference items
 */
export async function getAllRefs(
  scope: RefScope,
  filters?: {
    worldId?: string; // For NPCs, filter by world
    status?: string; // For entries, filter by status
    active?: boolean; // For rulesets, filter by active
  }
): Promise<RefItem[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('No authentication token available');
  }

  let tableName: string;
  let selectFields: string;
  let query = supabase;

  switch (scope) {
    case 'world':
      tableName = 'worlds';
      selectFields = 'id, name, slug';
      query = supabase.from(tableName).select(selectFields);
      break;
    case 'ruleset':
      tableName = 'rulesets';
      selectFields = 'id, name, slug';
      query = supabase.from(tableName).select(selectFields);
      if (filters?.active !== undefined) {
        query = query.eq('active', filters.active);
      }
      break;
    case 'entry':
      tableName = 'entry_points';
      selectFields = 'id, name, slug';
      query = supabase.from(tableName).select(selectFields);
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      break;
    case 'npc':
      tableName = 'npcs';
      selectFields = 'id, doc->npc->name as name, id as slug';
      query = supabase.from(tableName).select(selectFields);
      if (filters?.worldId) {
        query = query.eq('doc->npc->world_id', filters.worldId);
      }
      break;
    default:
      throw new Error(`Unsupported scope: ${scope}`);
  }

  const { data, error } = await query.order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to get all ${scope}s: ${error.message}`);
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    name: item.name || `Unnamed ${scope}`,
    slug: item.slug || item.id
  }));
}











