/**
 * Extras Service
 * Validate and manage pack extras using field definitions
 */

import Ajv from 'ajv';
import { buildPackSchema, type PackType } from './field-defs.service.js';
import { listFieldDefs } from './field-defs.service.js';

const ajv = new Ajv({ allErrors: true, strict: false });

// Conditionally add formats if ajv-formats is available
// This is marked as external in tsup.config.ts, so it will be resolved at runtime
// Use IIFE to handle async initialization
(async () => {
  try {
    // Dynamic import to avoid build-time resolution issues
    const addFormats = (await import('ajv-formats')).default;
    addFormats(ajv);
  } catch {
    // ajv-formats not available, skip format validation
    // This is fine - format validation is optional
  }
})();

// Memoize compiled schemas (Phase 7: Performance)
const schemaCache = new Map<string, Ajv.ValidateFunction>();

function getSchemaKey(packType: PackType, schema: any): string {
  return `${packType}:${JSON.stringify(schema)}`;
}

export interface ValidationResult {
  ok: boolean;
  errors: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * Validate extras against field definitions
 */
export async function validateExtras(
  packType: PackType,
  extrasJson: Record<string, unknown> | null | undefined
): Promise<ValidationResult> {
  if (!extrasJson || Object.keys(extrasJson).length === 0) {
    return { ok: true, errors: [] };
  }

  const schema = await buildPackSchema(packType);
  if (!schema) {
    // No field definitions, allow any extras (backward compatibility)
    return { ok: true, errors: [] };
  }

  // Use memoized compiled schema (Phase 7: Performance)
  const cacheKey = getSchemaKey(packType, schema);
  let validate = schemaCache.get(cacheKey);
  if (!validate) {
    validate = ajv.compile(schema);
    schemaCache.set(cacheKey, validate);
  }

  const valid = validate(extrasJson);

  if (!valid) {
    const errors = (validate.errors || []).map(err => ({
      field: err.instancePath || err.params?.property || 'root',
      message: err.message || 'Validation error',
    }));
    return { ok: false, errors };
  }

  return { ok: true, errors: [] };
}

/**
 * Merge defaults into existing extras
 */
export async function mergeDefaults(
  packType: PackType,
  existingExtras: Record<string, unknown> | null | undefined
): Promise<Record<string, unknown>> {
  const defs = await listFieldDefs(packType, 'active');
  const result: Record<string, unknown> = { ...(existingExtras || {}) };

  for (const def of defs) {
    if (def.default_json !== null && !(def.key in result)) {
      result[def.key] = def.default_json;
    }
  }

  return result;
}

/**
 * Prune deprecated fields from extras
 */
export async function pruneDeprecated(
  packType: PackType,
  extras: Record<string, unknown> | null | undefined
): Promise<Record<string, unknown>> {
  if (!extras) {
    return {};
  }

  const activeDefs = await listFieldDefs(packType, 'active');
  const activeKeys = new Set(activeDefs.map(d => d.key));

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extras)) {
    if (activeKeys.has(key)) {
      result[key] = value;
    }
  }

  return result;
}

