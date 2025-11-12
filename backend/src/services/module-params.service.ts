/**
 * Module Parameters Service
 * Handles loading and merging module params with defaults
 */

import { supabaseAdmin } from './supabase.js';
import { readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ModuleParams {
  schema?: string;
  defaults?: Record<string, unknown>;
  presets?: Array<{
    id: string;
    label: string;
    overrides: Record<string, unknown>;
  }>;
}

/**
 * Load module manifest (including params)
 */
async function loadModuleManifest(moduleId: string): Promise<any | null> {
  try {
    // Find content/modules directory
    const possiblePaths = [
      join(__dirname, '../../../content/modules'),
      join(process.cwd(), 'content/modules'),
      join(process.cwd(), '../content/modules'),
    ];

    let modulesPath = '';
    for (const path of possiblePaths) {
      try {
        if (statSync(path).isDirectory()) {
          modulesPath = path;
          break;
        }
      } catch (e) {
        // Continue
      }
    }

    if (!modulesPath) {
      return null;
    }

    // Extract base_id and version from moduleId (e.g., "module.relationships.v3" -> "relationships", "3")
    const match = moduleId.match(/^module\.(.+)\.v(\d+)$/);
    if (!match) {
      return null;
    }

    const [, baseName, version] = match;
    const manifestPath = join(modulesPath, baseName, `manifest.v${version}.json`);

    try {
      const manifestContent = readFileSync(manifestPath, 'utf-8');
      return JSON.parse(manifestContent);
    } catch (e) {
      return null;
    }
  } catch (error) {
    console.error(`[ModuleParams] Error loading manifest for ${moduleId}:`, error);
    return null;
  }
}

/**
 * Get merged params for a module (story params override manifest defaults)
 */
export async function getModuleParams(
  storyId: string,
  moduleId: string
): Promise<Record<string, unknown> | null> {
  try {
    // Load story module params
    const { data: storyModule, error } = await supabaseAdmin
      .from('story_modules')
      .select('params')
      .eq('story_id', storyId)
      .eq('module_id', moduleId)
      .single();

    if (error || !storyModule) {
      return null;
    }

    // Load manifest defaults
    const manifest = await loadModuleManifest(moduleId);
    const defaults = manifest?.params?.defaults || {};

    // Merge: defaults first, then story params override
    return {
      ...defaults,
      ...(storyModule.params || {}),
    };
  } catch (error) {
    console.error(`[ModuleParams] Error getting params for ${storyId}/${moduleId}:`, error);
    return null;
  }
}

/**
 * Get module params definition (schema, defaults, presets)
 */
export async function getModuleParamsDef(moduleId: string): Promise<ModuleParams | null> {
  const manifest = await loadModuleManifest(moduleId);
  return manifest?.params || null;
}

/**
 * Validate params against module schema
 */
export async function validateModuleParams(
  moduleId: string,
  params: Record<string, unknown>
): Promise<{ valid: boolean; errors?: any[] }> {
  const paramsDef = await getModuleParamsDef(moduleId);
  if (!paramsDef?.schema) {
    // No schema defined, accept any params
    return { valid: true };
  }

  // Map schema names to actual schemas
  const schemaMap: Record<string, any> = {
    'zod:RelationshipsParams': (await import('../actions/schemas/relationships-params.js')).RelationshipsParamsSchema,
  };

  const schema = schemaMap[paramsDef.schema];
  if (!schema) {
    console.warn(`[ModuleParams] Unknown schema: ${paramsDef.schema} for module ${moduleId}`);
    return { valid: true }; // Allow if schema not found
  }

  const result = schema.safeParse(params);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors,
    };
  }

  return { valid: true };
}

