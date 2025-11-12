/**
 * Modules Lint Service
 * Validates module configurations and detects issues
 */

import { supabaseAdmin } from './supabase.js';
import { actionRegistry } from '../actions/registry.js';

export interface LintWarning {
  severity: 'warning' | 'error';
  message: string;
  moduleId?: string;
}

/**
 * Lint all modules or a specific module
 */
export async function lintModules(moduleId?: string): Promise<LintWarning[]> {
  const warnings: LintWarning[] = [];

  try {
    let query = supabaseAdmin
      .from('modules')
      .select('id, base_id, state_slice, exports');

    if (moduleId) {
      query = query.eq('id', moduleId);
    }

    const { data: modules, error } = await query;

    if (error) {
      warnings.push({
        severity: 'error',
        message: `Failed to load modules: ${error.message}`,
      });
      return warnings;
    }

    if (!modules || modules.length === 0) {
      return warnings;
    }

    // Check for duplicate state slices
    const stateSliceMap = new Map<string, string[]>();
    for (const module of modules) {
      const slice = module.state_slice;
      if (!stateSliceMap.has(slice)) {
        stateSliceMap.set(slice, []);
      }
      stateSliceMap.get(slice)!.push(module.id);
    }

    for (const [slice, moduleIds] of stateSliceMap.entries()) {
      if (moduleIds.length > 1) {
        warnings.push({
          severity: 'warning',
          message: `Multiple modules declare state_slice "${slice}": ${moduleIds.join(', ')}`,
        });
      }
    }

    // Check each module's exported actions
    for (const module of modules) {
      const exports = module.exports as {
        actions?: Array<{
          type: string;
          payload_schema: string;
        }>;
      };

      if (!exports?.actions) {
        continue;
      }

      for (const actionDef of exports.actions) {
        const entry = actionRegistry.get(actionDef.type);
        if (!entry) {
          warnings.push({
            severity: 'warning',
            message: `Module ${module.id} exports action "${actionDef.type}" but no schema/reducer is registered`,
            moduleId: module.id,
          });
        } else if (entry.owner !== module.state_slice) {
          warnings.push({
            severity: 'warning',
            message: `Module ${module.id} exports action "${actionDef.type}" but owner mismatch: expected ${module.state_slice}, got ${entry.owner}`,
            moduleId: module.id,
          });
        }
      }

      // Check params schema if present
      const { getModuleParamsDef } = await import('./module-params.service.js');
      const paramsDef = await getModuleParamsDef(module.id);
      if (paramsDef?.schema) {
        // Validate defaults
        if (paramsDef.defaults) {
          const { validateModuleParams } = await import('./module-params.service.js');
          const defaultsValidation = await validateModuleParams(module.id, paramsDef.defaults);
          if (!defaultsValidation.valid) {
            warnings.push({
              severity: 'error',
              message: `Module ${module.id} params.defaults do not conform to schema`,
              moduleId: module.id,
            });
          }
        }

        // Validate presets
        if (paramsDef.presets) {
          for (const preset of paramsDef.presets) {
            // Merge defaults with preset overrides
            const merged = {
              ...(paramsDef.defaults || {}),
              ...(preset.overrides || {}),
            };
            const { validateModuleParams } = await import('./module-params.service.js');
            const presetValidation = await validateModuleParams(module.id, merged);
            if (!presetValidation.valid) {
              warnings.push({
                severity: 'error',
                message: `Module ${module.id} preset "${preset.id}" does not conform to schema`,
                moduleId: module.id,
              });
            }
          }
        }
      }
    }
  } catch (error) {
    warnings.push({
      severity: 'error',
      message: `Error linting modules: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  return warnings;
}

