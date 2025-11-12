/**
 * Extras Service Tests
 * Test validation and merging of pack extras
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { validateExtras, mergeDefaults, pruneDeprecated } from '../src/services/extras.service.js';
import { upsertFieldDef } from '../src/services/field-defs.service.js';
import { supabaseAdmin } from '../src/services/supabase.js';

describe('Extras Service', () => {
  beforeAll(async () => {
    // Clean up test data
    await supabaseAdmin.from('field_defs').delete().neq('id', 0);
  });

  it('should validate extras against field definitions', async () => {
    // Create a test field definition
    await upsertFieldDef({
      pack_type: 'npc',
      key: 'test_field',
      label: 'Test Field',
      schema_json: {
        type: 'string',
        minLength: 3,
        maxLength: 10,
      },
      default_json: 'default',
    });

    // Valid extras
    const validResult = await validateExtras('npc', { test_field: 'valid' });
    expect(validResult.ok).toBe(true);
    expect(validResult.errors).toHaveLength(0);

    // Invalid extras (too short)
    const invalidResult = await validateExtras('npc', { test_field: 'ab' });
    expect(invalidResult.ok).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
  });

  it('should merge defaults into existing extras', async () => {
    await upsertFieldDef({
      pack_type: 'world',
      key: 'default_field',
      label: 'Default Field',
      schema_json: { type: 'string' },
      default_json: 'default_value',
    });

    const result = await mergeDefaults('world', {});
    expect(result.default_field).toBe('default_value');
  });

  it('should not override existing values with defaults', async () => {
    await upsertFieldDef({
      pack_type: 'ruleset',
      key: 'override_test',
      label: 'Override Test',
      schema_json: { type: 'string' },
      default_json: 'default',
    });

    const result = await mergeDefaults('ruleset', { override_test: 'custom' });
    expect(result.override_test).toBe('custom');
  });

  it('should prune deprecated fields', async () => {
    // Create active field
    await upsertFieldDef({
      pack_type: 'npc',
      key: 'active_field',
      label: 'Active Field',
      schema_json: { type: 'string' },
      status: 'active',
    });

    // Create deprecated field
    await upsertFieldDef({
      pack_type: 'npc',
      key: 'deprecated_field',
      label: 'Deprecated Field',
      schema_json: { type: 'string' },
      status: 'deprecated',
    });

    const extras = {
      active_field: 'value1',
      deprecated_field: 'value2',
    };

    const result = await pruneDeprecated('npc', extras);
    expect(result.active_field).toBe('value1');
    expect(result.deprecated_field).toBeUndefined();
  });
});

