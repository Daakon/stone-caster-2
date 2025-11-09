/**
 * Action Validation Service
 * Validates actions against the Action Registry and checks module attachments
 */

import { actionRegistry } from '../actions/registry.js';
import { supabaseAdmin } from './supabase.js';

export interface ValidationResult {
  valid: boolean;
  reason?: 'unknown_action' | 'schema_invalid' | 'module_not_attached';
  errors?: any[];
  type?: string;
  owner?: string;
}

/**
 * Validate an action against the registry
 */
export async function validateAction(
  action: { t: string; payload?: any },
  storyId?: string
): Promise<ValidationResult> {
  const actionType = action.t;
  const entry = actionRegistry.get(actionType);

  // Unknown action
  if (!entry) {
    const allowUnknown = process.env.ALLOW_UNKNOWN_ACTIONS !== 'false';
    if (allowUnknown) {
      console.warn(`[ActionValidation] Unknown action type: ${actionType} (allowed)`);
      return { valid: true };
    }
    return {
      valid: false,
      reason: 'unknown_action',
      type: actionType,
    };
  }

  // Validate payload schema
  const validation = actionRegistry.validate(actionType, action.payload);
  if (!validation.valid) {
    return {
      valid: false,
      reason: 'schema_invalid',
      errors: validation.error?.errors || [],
      type: actionType,
    };
  }

  // Check module attachment if owner is module-owned (not 'core')
  if (entry.owner !== 'core' && storyId) {
    // Check if story has a module that owns this state slice
    const { data: storyModules, error } = await supabaseAdmin
      .from('story_modules')
      .select(`
        module_id,
        modules:module_id (state_slice)
      `)
      .eq('story_id', storyId);

    if (!error && storyModules) {
      const hasModule = storyModules.some((row: any) => {
        const module = row.modules;
        return module && module.state_slice === entry.owner;
      });

      if (!hasModule) {
        return {
          valid: false,
          reason: 'module_not_attached',
          owner: entry.owner,
          type: actionType,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Validate multiple actions
 */
export async function validateActions(
  actions: Array<{ t: string; payload?: any }>,
  storyId?: string
): Promise<Array<{ action: any; result: ValidationResult }>> {
  const results = await Promise.all(
    actions.map(async (action) => ({
      action,
      result: await validateAction(action, storyId),
    }))
  );

  // Log rejected actions for telemetry
  for (const { action, result } of results) {
    if (!result.valid) {
      console.warn('[ActionValidation] Rejected action:', {
        type: action.t,
        reason: result.reason,
        owner: result.owner,
        errors: result.errors,
      });
    }
  }

  return results;
}

