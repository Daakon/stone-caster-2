// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * World Fetch Integration Tests
 * Phase 10-C: Fix Asset Data Flow
 * Tests that images are correctly extracted from definition JSONB
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabaseAdmin } from '../../services/supabase';
import type { Database } from '../../db/types';

describe('World Fetch Integration - Images Data Flow', () => {
  let testWorldId: string | null = null;

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

  it('should extract images from definition JSONB when fetching selectable worlds', async () => {
    // Create a test world with images in definition JSONB
    const testUserId = '00000000-0000-0000-0000-000000000000'; // Test user ID
    const testImages = [
      {
        id: 'test-banner-id',
        url: 'http://test.com/banner.png',
        role: 'banner',
        label: 'Test Banner',
      },
      {
        id: 'test-icon-id',
        url: 'http://test.com/icon.png',
        role: 'icon',
        label: 'Test Icon',
      },
    ];

    const definition = {
      id: 'test-world-key',
      name: 'Test World with Images',
      description_short: 'A test world',
      description_long: 'A test world description',
      ruleset_template_ids: [],
      images: testImages,
    };

    // Insert test world
    const { data: insertedWorld, error: insertError } = await supabaseAdmin
      .from('chimera_worlds')
      .insert({
        owner_user_id: testUserId,
        key: 'test-world-key',
        definition: definition as any,
        name: 'Test World with Images',
        slug: 'test-world-with-images',
        description_short: 'A test world',
        description_long: 'A test world description',
        visibility: 'public',
        tags: [],
        character_schema_contributions: {},
      })
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Failed to create test world: ${insertError.message}`);
    }

    testWorldId = insertedWorld.id;

    // Fetch selectable worlds (simulating the /selectable endpoint)
    const { data: worlds, error: fetchError } = await supabaseAdmin
      .from('chimera_worlds')
      .select('*')
      .or(`visibility.eq.public,owner_user_id.eq.${testUserId}`)
      .eq('id', testWorldId);

    if (fetchError) {
      throw new Error(`Failed to fetch worlds: ${fetchError.message}`);
    }

    expect(worlds).toBeDefined();
    expect(worlds?.length).toBeGreaterThan(0);

    const fetchedWorld = worlds?.find((w) => w.id === testWorldId);
    expect(fetchedWorld).toBeDefined();

    // Verify definition contains images
    const fetchedDefinition = fetchedWorld?.definition as any;
    expect(fetchedDefinition).toBeDefined();
    expect(fetchedDefinition.images).toBeDefined();
    expect(Array.isArray(fetchedDefinition.images)).toBe(true);
    expect(fetchedDefinition.images.length).toBe(2);
    expect(fetchedDefinition.images[0].url).toBe('http://test.com/banner.png');
    expect(fetchedDefinition.images[0].role).toBe('banner');
    expect(fetchedDefinition.images[1].url).toBe('http://test.com/icon.png');
    expect(fetchedDefinition.images[1].role).toBe('icon');
  });

  it('should handle worlds without images gracefully', async () => {
    const testUserId = '00000000-0000-0000-0000-000000000000';
    const definition = {
      id: 'test-world-no-images',
      name: 'Test World No Images',
      description_short: 'A test world',
      description_long: 'A test world description',
      ruleset_template_ids: [],
      // No images field
    };

    const { data: insertedWorld, error: insertError } = await supabaseAdmin
      .from('chimera_worlds')
      .insert({
        owner_user_id: testUserId,
        key: 'test-world-no-images',
        definition: definition as any,
        name: 'Test World No Images',
        slug: 'test-world-no-images',
        description_short: 'A test world',
        description_long: 'A test world description',
        visibility: 'public',
        tags: [],
        character_schema_contributions: {},
      })
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Failed to create test world: ${insertError.message}`);
    }

    const testWorldIdNoImages = insertedWorld.id;

    // Fetch selectable worlds
    const { data: worlds, error: fetchError } = await supabaseAdmin
      .from('chimera_worlds')
      .select('*')
      .or(`visibility.eq.public,owner_user_id.eq.${testUserId}`)
      .eq('id', testWorldIdNoImages);

    if (fetchError) {
      throw new Error(`Failed to fetch worlds: ${fetchError.message}`);
    }

    expect(worlds).toBeDefined();
    const fetchedWorld = worlds?.find((w) => w.id === testWorldIdNoImages);
    expect(fetchedWorld).toBeDefined();

    const fetchedDefinition = fetchedWorld?.definition as any;
    expect(fetchedDefinition).toBeDefined();
    // Images should be undefined or empty array
    expect(fetchedDefinition.images === undefined || Array.isArray(fetchedDefinition.images)).toBe(true);

    // Clean up
    await supabaseAdmin
      .from('chimera_worlds')
      .delete()
      .eq('id', testWorldIdNoImages);
  });
});

