/**
 * Slots Service
 * DAO for slot definitions
 */

import { supabaseAdmin } from './supabase.js';
import type { SlotType } from '../slots/registry.js';

export interface SlotRecord {
  id: string;
  type: SlotType;
  name: string;
  description: string;
  max_len?: number;
  priority: number;
  must_keep: boolean;
  min_chars?: number;
  created_at: string;
  updated_at: string;
}

export interface UpsertSlotParams {
  type: SlotType;
  name: string;
  description: string;
  max_len?: number;
  priority?: number;
  must_keep?: boolean;
  min_chars?: number;
}

/**
 * List all slots, optionally filtered by type
 */
export async function listSlots(type?: SlotType): Promise<SlotRecord[]> {
  let query = supabaseAdmin
    .from('slots')
    .select('*')
    .order('type', { ascending: true })
    .order('priority', { ascending: false })
    .order('name', { ascending: true });

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list slots: ${error.message}`);
  }

  return (data || []).map(row => ({
    id: row.id,
    type: row.type as SlotType,
    name: row.name,
    description: row.description,
    max_len: row.max_len || undefined,
    priority: row.priority || 0,
    must_keep: row.must_keep ?? false,
    min_chars: row.min_chars || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/**
 * Get slot by type and name
 */
export async function getSlotByTypeAndName(
  type: SlotType,
  name: string
): Promise<SlotRecord | null> {
  const { data, error } = await supabaseAdmin
    .from('slots')
    .select('*')
    .eq('type', type)
    .eq('name', name)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get slot: ${error.message}`);
  }

  return {
    id: data.id,
    type: data.type as SlotType,
    name: data.name,
    description: data.description,
    max_len: data.max_len || undefined,
    priority: data.priority || 0,
    must_keep: data.must_keep ?? false,
    min_chars: data.min_chars || undefined,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Upsert slot (insert or update)
 */
export async function upsertSlot(params: UpsertSlotParams): Promise<SlotRecord> {
  const { data, error } = await supabaseAdmin
    .from('slots')
    .upsert({
      type: params.type,
      name: params.name,
      description: params.description,
      max_len: params.max_len || null,
      priority: params.priority || 0,
      must_keep: params.must_keep ?? false,
      min_chars: params.min_chars || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'type,name',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert slot: ${error.message}`);
  }

  return {
    id: data.id,
    type: data.type as SlotType,
    name: data.name,
    description: data.description,
    max_len: data.max_len || undefined,
    priority: data.priority || 0,
    must_keep: data.must_keep ?? false,
    min_chars: data.min_chars || undefined,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

