// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * World Persistence Integration Tests
 * Phase 10-C: Asset Persistence Repair
 * Tests that images persist correctly through create/update/fetch round-trip
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabaseAdmin } from '../../services/supabase';

describe('World Persistence - Images Round-Trip', () => {
  let testWorldId: string | null = null;
  const testUserId = '00000000-0000-0000-0000-000000000000'; // Test user ID

  beforeEach(async () => {
    // Clean up any existing test worlds
    if (testWorldId) {
      await supabaseAdmin
        .from('chimera_worlds')
        .delete()
        .eq('id', testWorldId);
    }
  });

  afterEach(async () => {
    // Clean up test world
    if (testWorldId) {
      await supabaseAdmin
        .from('chimera_worlds')
        .delete()
        .eq('id', testWorldId);
      testWorldId = null;
    }
  });

  it('should persist images through create -> update -> fetch round-trip', async () => {
    // Step 1: Create a dummy world
    const createDefinition = {
      id: 'test-persistence-world',
      name: 'Test Persistence World',
      description: 'A test world for persistence testing',
      description_short: 'Test world',
      description_long: 'A test world for persistence testing',
      ruleset_template_ids: [],
      images: [], // Start with no images
    };

    const { data: createdWorld, error: createError } = await supabaseAdmin
      .from('chimera_worlds')
      .insert({
        owner_user_id: testUserId,
        key: 'test-persistence-world',
        definition: createDefinition as any,
        name: 'Test Persistence World',
        slug: 'test-persistence-world',
        description_short: 'Test world',
        description_long: 'A test world for persistence testing',
        visibility: 'public',
        tags: [],
        character_schema_contributions: {},
      })
      .select('id')
      .single();

    if (createError) {
      throw new Error(`Failed to create test world: ${createError.message}`);
    }

    testWorldId = createdWorld.id;
    expect(testWorldId).toBeDefined();

    // Step 2: Update the world with images
    const testImages = [
      {
        id: 'test-image-id-1',
        url: 'test.png',
        role: 'banner' as const,
        label: 'Test Banner',
      },
    ];

    // Fetch current definition
    const { data: currentWorld, error: fetchError } = await supabaseAdmin
      .from('chimera_worlds')
      .select('definition')
      .eq('id', testWorldId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch world for update: ${fetchError.message}`);
    }

    // Update definition with images
    const currentDefinition = (currentWorld?.definition as any) || {};
    const updatedDefinition = {
      ...currentDefinition,
      images: testImages,
    };

    const { error: updateError } = await supabaseAdmin
      .from('chimera_worlds')
      .update({
        definition: updatedDefinition,
        updated_at: new Date().toISOString(),
      })
      .eq('id', testWorldId);

    if (updateError) {
      throw new Error(`Failed to update world: ${updateError.message}`);
    }

    // Step 3: Fetch the world immediately after update
    const { data: fetchedWorld, error: fetchAfterError } = await supabaseAdmin
      .from('chimera_worlds')
      .select('*')
      .eq('id', testWorldId)
      .single();

    if (fetchAfterError) {
      throw new Error(`Failed to fetch world after update: ${fetchAfterError.message}`);
    }

    expect(fetchedWorld).toBeDefined();

    // Step 4: Assert images are present
    const fetchedDefinition = fetchedWorld?.definition as any;
    expect(fetchedDefinition).toBeDefined();
    expect(fetchedDefinition.images).toBeDefined();
    expect(Array.isArray(fetchedDefinition.images)).toBe(true);
    expect(fetchedDefinition.images.length).toBe(1);
    expect(fetchedDefinition.images[0].url).toBe('test.png');
    expect(fetchedDefinition.images[0].role).toBe('banner');
    expect(fetchedDefinition.images[0].id).toBe('test-image-id-1');
  });

  it('should preserve images when updating other fields', async () => {
    // Create world with images
    const initialDefinition = {
      id: 'test-preserve-images',
      name: 'Test Preserve Images',
      description: 'A test world',
      description_short: 'Test',
      description_long: 'A test world',
      ruleset_template_ids: [],
      images: [
        {
          id: 'preserved-image-id',
          url: 'preserved.png',
          role: 'banner' as const,
          label: 'Preserved Banner',
        },
      ],
    };

    const { data: createdWorld, error: createError } = await supabaseAdmin
      .from('chimera_worlds')
      .insert({
        owner_user_id: testUserId,
        key: 'test-preserve-images',
        definition: initialDefinition as any,
        name: 'Test Preserve Images',
        slug: 'test-preserve-images',
        description_short: 'Test',
        description_long: 'A test world',
        visibility: 'public',
        tags: [],
        character_schema_contributions: {},
      })
      .select('id')
      .single();

    if (createError) {
      throw new Error(`Failed to create test world: ${createError.message}`);
    }

    const preserveTestWorldId = createdWorld.id;

    // Update only the name (not images)
    const { error: updateError } = await supabaseAdmin
      .from('chimera_worlds')
      .update({
        name: 'Updated Name',
        updated_at: new Date().toISOString(),
      })
      .eq('id', preserveTestWorldId);

    if (updateError) {
      throw new Error(`Failed to update world: ${updateError.message}`);
    }

    // Fetch and verify images are still there
    const { data: fetchedWorld, error: fetchError } = await supabaseAdmin
      .from('chimera_worlds')
      .select('*')
      .eq('id', preserveTestWorldId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch world: ${fetchError.message}`);
    }

    const fetchedDefinition = fetchedWorld?.definition as any;
    expect(fetchedDefinition.images).toBeDefined();
    expect(Array.isArray(fetchedDefinition.images)).toBe(true);
    expect(fetchedDefinition.images.length).toBe(1);
    expect(fetchedDefinition.images[0].url).toBe('preserved.png');

    // Clean up
    await supabaseAdmin
      .from('chimera_worlds')
      .delete()
      .eq('id', preserveTestWorldId);
  });

  it('should handle empty images array correctly', async () => {
    // Create world with images
    const initialDefinition = {
      id: 'test-empty-images',
      name: 'Test Empty Images',
      description: 'A test world',
      description_short: 'Test',
      description_long: 'A test world',
      ruleset_template_ids: [],
      images: [
        {
          id: 'temp-image-id',
          url: 'temp.png',
          role: 'banner' as const,
        },
      ],
    };

    const { data: createdWorld, error: createError } = await supabaseAdmin
      .from('chimera_worlds')
      .insert({
        owner_user_id: testUserId,
        key: 'test-empty-images',
        definition: initialDefinition as any,
        name: 'Test Empty Images',
        slug: 'test-empty-images',
        description_short: 'Test',
        description_long: 'A test world',
        visibility: 'public',
        tags: [],
        character_schema_contributions: {},
      })
      .select('id')
      .single();

    if (createError) {
      throw new Error(`Failed to create test world: ${createError.message}`);
    }

    const emptyTestWorldId = createdWorld.id;

    // Update with empty images array
    const { data: currentWorld } = await supabaseAdmin
      .from('chimera_worlds')
      .select('definition')
      .eq('id', emptyTestWorldId)
      .single();

    const currentDefinition = (currentWorld?.definition as any) || {};
    const updatedDefinition = {
      ...currentDefinition,
      images: [], // Empty array
    };

    const { error: updateError } = await supabaseAdmin
      .from('chimera_worlds')
      .update({
        definition: updatedDefinition,
        updated_at: new Date().toISOString(),
      })
      .eq('id', emptyTestWorldId);

    if (updateError) {
      throw new Error(`Failed to update world: ${updateError.message}`);
    }

    // Fetch and verify images array is empty
    const { data: fetchedWorld, error: fetchError } = await supabaseAdmin
      .from('chimera_worlds')
      .select('*')
      .eq('id', emptyTestWorldId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch world: ${fetchError.message}`);
    }

    const fetchedDefinition = fetchedWorld?.definition as any;
    expect(fetchedDefinition.images).toBeDefined();
    expect(Array.isArray(fetchedDefinition.images)).toBe(true);
    expect(fetchedDefinition.images.length).toBe(0);

    // Clean up
    await supabaseAdmin
      .from('chimera_worlds')
      .delete()
      .eq('id', emptyTestWorldId);
  });
});

