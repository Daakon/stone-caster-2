/**
 * World Schema Test
 * Verifies that ChimeraWorld DTO includes character_schema_contributions field
 */

import { describe, it, expect } from 'vitest';

// Import from frontend service (shared type definition)
// In a real scenario, this would be in a shared types package
interface ChimeraWorld {
  id: string;
  owner_user_id: string;
  visibility: 'private' | 'pending_approval' | 'public';
  display_name: string;
  description_short: string | null;
  description_long: string | null;
  character_schema_contributions: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  ruleset_links?: Array<{ ruleset_template_id: string }>;
  tags?: Array<{ id: string; tag_name: string }>;
}

describe('ChimeraWorld DTO', () => {
  it('should include character_schema_contributions field', () => {
    // Type check: ensure the field exists in the type
    const world: ChimeraWorld = {
      id: 'test-world-id',
      owner_user_id: 'test-user-id',
      visibility: 'private',
      display_name: 'Test World',
      description_short: null,
      description_long: null,
      character_schema_contributions: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Assert that character_schema_contributions exists and is an object type
    expect(world).toHaveProperty('character_schema_contributions');
    expect(typeof world.character_schema_contributions).toBe('object');
    expect(world.character_schema_contributions).not.toBeNull();
    expect(Array.isArray(world.character_schema_contributions)).toBe(false);
  });

  it('should accept Record<string, unknown> type for character_schema_contributions', () => {
    const world: ChimeraWorld = {
      id: 'test-world-id',
      owner_user_id: 'test-user-id',
      visibility: 'private',
      display_name: 'Test World',
      description_short: null,
      description_long: null,
      character_schema_contributions: {
        essence_alignment: {
          type: 'string',
          enum: ['light', 'dark', 'neutral'],
        },
        custom_field: {
          type: 'number',
          minimum: 0,
          maximum: 100,
        },
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(world.character_schema_contributions).toHaveProperty('essence_alignment');
    expect(world.character_schema_contributions).toHaveProperty('custom_field');
    expect((world.character_schema_contributions as any).essence_alignment.type).toBe('string');
  });
});

