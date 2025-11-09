/**
 * Field Definitions Service
 * Manage dynamic field definitions for pack extras
 */

import { supabaseAdmin } from './supabase.js';

export type PackType = 'world' | 'ruleset' | 'npc' | 'scenario';

export interface FieldDefinition {
  id: number;
  pack_type: PackType;
  key: string;
  label: string;
  group_label: string | null;
  schema_json: Record<string, unknown>;
  default_json: unknown | null;
  help: string | null;
  status: 'active' | 'deprecated';
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CreateFieldDefParams {
  pack_type: PackType;
  key: string;
  label: string;
  group_label?: string | null;
  schema_json: Record<string, unknown>;
  default_json?: unknown | null;
  help?: string | null;
  status?: 'active' | 'deprecated';
  created_by?: string | null;
}

export interface UpdateFieldDefParams {
  label?: string;
  group_label?: string | null;
  schema_json?: Record<string, unknown>;
  default_json?: unknown | null;
  help?: string | null;
  status?: 'active' | 'deprecated';
}

/**
 * List field definitions by pack type
 */
export async function listFieldDefs(
  packType?: PackType,
  status?: 'active' | 'deprecated'
): Promise<FieldDefinition[]> {
  let query = supabaseAdmin
    .from('field_defs')
    .select('*')
    .order('group_label', { ascending: true, nullsFirst: false })
    .order('key', { ascending: true });

  if (packType) {
    query = query.eq('pack_type', packType);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list field definitions: ${error.message}`);
  }

  return (data || []) as FieldDefinition[];
}

/**
 * Get a specific field definition
 */
export async function getFieldDef(
  packType: PackType,
  key: string
): Promise<FieldDefinition | null> {
  const { data, error } = await supabaseAdmin
    .from('field_defs')
    .select('*')
    .eq('pack_type', packType)
    .eq('key', key)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get field definition: ${error.message}`);
  }

  return data as FieldDefinition;
}

/**
 * Create or update a field definition
 */
export async function upsertFieldDef(
  params: CreateFieldDefParams
): Promise<FieldDefinition> {
  const { data, error } = await supabaseAdmin
    .from('field_defs')
    .upsert(
      {
        pack_type: params.pack_type,
        key: params.key,
        label: params.label,
        group_label: params.group_label || null,
        schema_json: params.schema_json,
        default_json: params.default_json || null,
        help: params.help || null,
        status: params.status || 'active',
        created_by: params.created_by || null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'pack_type,key',
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert field definition: ${error.message}`);
  }

  return data as FieldDefinition;
}

/**
 * Update a field definition
 */
export async function updateFieldDef(
  packType: PackType,
  key: string,
  params: UpdateFieldDefParams
): Promise<FieldDefinition> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (params.label !== undefined) updateData.label = params.label;
  if (params.group_label !== undefined) updateData.group_label = params.group_label;
  if (params.schema_json !== undefined) updateData.schema_json = params.schema_json;
  if (params.default_json !== undefined) updateData.default_json = params.default_json;
  if (params.help !== undefined) updateData.help = params.help;
  if (params.status !== undefined) updateData.status = params.status;

  const { data, error } = await supabaseAdmin
    .from('field_defs')
    .update(updateData)
    .eq('pack_type', packType)
    .eq('key', key)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Field definition not found');
    }
    throw new Error(`Failed to update field definition: ${error.message}`);
  }

  return data as FieldDefinition;
}

/**
 * Deprecate a field definition
 */
export async function deprecateFieldDef(
  packType: PackType,
  key: string
): Promise<FieldDefinition> {
  return updateFieldDef(packType, key, { status: 'deprecated' });
}

/**
 * Build JSON Schema from active field definitions for a pack type
 */
export async function buildPackSchema(packType: PackType): Promise<Record<string, unknown> | null> {
  const defs = await listFieldDefs(packType, 'active');
  
  if (defs.length === 0) {
    return null;
  }

  // Combine schemas using allOf
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const def of defs) {
    properties[def.key] = def.schema_json;
    // Check if schema requires this field
    if (def.schema_json && typeof def.schema_json === 'object' && 'required' in def.schema_json) {
      // Schema-level required is handled per-field
    }
    // If schema has required array, add to our required list
    const schema = def.schema_json as { required?: string[] };
    if (schema.required && schema.required.includes(def.key)) {
      required.push(def.key);
    }
  }

  return {
    type: 'object',
    properties,
    additionalProperties: false,
    ...(required.length > 0 ? { required } : {}),
  };
}

