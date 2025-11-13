/**
 * Publishing Preflight Helpers
 * Refinement: Single source of truth for preflight logic shared between wizard and recordPublishRequest
 */

import { supabaseAdmin } from './supabase.js';
import type { PublishableType } from '@shared';

export interface DependencyCheckResult {
  missingWorld: boolean;
  missingRuleset: boolean;
  invalidRefs: string[];
  worldPublished: boolean;
}

/**
 * Check dependencies for an entity (shared logic)
 */
export async function checkDependencies(params: {
  type: PublishableType;
  id: string;
}): Promise<DependencyCheckResult> {
  const { type, id } = params;

  const result: DependencyCheckResult = {
    missingWorld: false,
    missingRuleset: false,
    invalidRefs: [],
    worldPublished: false,
  };

  if (type === 'story') {
    const { data: entryPoint } = await supabaseAdmin
      .from('entry_points')
      .select('world_id')
      .eq('id', id)
      .single();

    if (!entryPoint?.world_id) {
      result.missingWorld = true;
      result.invalidRefs.push('world_id');
    } else {
      const { data: world } = await supabaseAdmin
        .from('worlds')
        .select('id, visibility, review_state')
        .eq('id', entryPoint.world_id)
        .single();

      if (!world) {
        result.missingWorld = true;
        result.invalidRefs.push('world_id');
      } else {
        result.worldPublished = world.visibility === 'public' && world.review_state === 'approved';
        if (!result.worldPublished) {
          result.invalidRefs.push('world_not_published');
        }
      }
    }

    // Check for ruleset
    const { data: rulesetBinding } = await supabaseAdmin
      .from('entry_point_rulesets')
      .select('ruleset_id')
      .eq('entry_point_id', id)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!rulesetBinding) {
      result.missingRuleset = true;
      result.invalidRefs.push('ruleset');
    }
  } else if (type === 'npc') {
    const { data: npc } = await supabaseAdmin
      .from('npcs')
      .select('world_id')
      .eq('id', id)
      .single();

    if (!npc?.world_id) {
      result.missingWorld = true;
      result.invalidRefs.push('world_id');
    } else {
      const { data: world } = await supabaseAdmin
        .from('worlds')
        .select('id, visibility, review_state')
        .eq('id', npc.world_id)
        .single();

      if (!world) {
        result.missingWorld = true;
        result.invalidRefs.push('world_id');
      } else {
        result.worldPublished = world.visibility === 'public' && world.review_state === 'approved';
        if (!result.worldPublished) {
          result.invalidRefs.push('world_not_published');
        }
      }
    }
  } else {
    // Worlds have no dependencies
    result.worldPublished = true; // Worlds are self-contained
  }

  return result;
}

export interface FieldValidationResult {
  fieldsMissing: string[];
  fieldsInvalid: string[];
}

/**
 * Validate required fields for an entity (shared logic)
 */
export async function validateRequiredFields(params: {
  type: PublishableType;
  id: string;
}): Promise<FieldValidationResult> {
  const { type, id } = params;
  const tableName = type === 'story' ? 'entry_points' : `${type}s`;

  const { data: entity } = await supabaseAdmin
    .from(tableName)
    .select('*')
    .eq('id', id)
    .single();

  const result: FieldValidationResult = {
    fieldsMissing: [],
    fieldsInvalid: [],
  };

  if (!entity) {
    return result;
  }

  if (type === 'story') {
    if (!entity.title) result.fieldsMissing.push('title');
    if (!entity.description) result.fieldsMissing.push('description');
  } else if (type === 'world') {
    if (!entity.name) result.fieldsMissing.push('name');
    if (!entity.description) result.fieldsMissing.push('description');
  } else if (type === 'npc') {
    if (!entity.name) result.fieldsMissing.push('name');
  }

  return result;
}

