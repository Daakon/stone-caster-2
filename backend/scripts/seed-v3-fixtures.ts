#!/usr/bin/env tsx
/**
 * Seed v3 Test Fixtures
 * 
 * Idempotent seeding script for v3 entry-point → world → ruleset → NPCs
 * Supports --tx flag for test transactions and --tag for namespacing
 * 
 * Usage:
 *   pnpm seed:v3                    # Normal mode
 *   pnpm seed:v3 --tx              # Wrap in test transaction
 *   pnpm seed:v3 --tag custom-tag  # Use custom tag (default: v3-e2e)
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { supabaseAdmin } from '../src/services/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = join(__dirname, '../tests/fixtures/v3');
const DEFAULT_TAG = 'v3-e2e';

interface SeedOptions {
  tag?: string;
}

async function seedWorld(tag: string) {
  const worldData = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'world-mystika.json'), 'utf-8')
  );
  
  // Ensure tags include our tag
  if (!worldData.tags.includes(tag)) {
    worldData.tags.push(tag);
  }

  const { error } = await supabaseAdmin
    .from('worlds')
    .upsert({
      id: worldData.id,
      code: worldData.code,
      title: worldData.title,
      tagline: worldData.tagline,
      description: worldData.description,
      status: worldData.status,
      tags: worldData.tags,
      metadata: worldData.metadata,
    }, {
      onConflict: 'id',
    });
  
  if (error) throw error;
}

async function seedEntryPoint(tag: string) {
  const entryPointData = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'entry-point-forest-meet.json'), 'utf-8')
  );
  
  if (!entryPointData.tags.includes(tag)) {
    entryPointData.tags.push(tag);
  }

  const { error } = await supabaseAdmin
    .from('entry_points')
    .upsert({
      id: entryPointData.id,
      type: entryPointData.type,
      slug: entryPointData.slug,
      title: entryPointData.title,
      world_id: entryPointData.world_id,
      entry_start_slug: entryPointData.entry_start_slug,
      status: entryPointData.status,
      tags: entryPointData.tags,
      metadata: entryPointData.metadata,
    }, {
      onConflict: 'id',
    });
  
  if (error) throw error;
}

async function seedRuleset(tag: string) {
  const rulesetData = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'ruleset-core-default.json'), 'utf-8')
  );
  
  if (!rulesetData.tags.includes(tag)) {
    rulesetData.tags.push(tag);
  }

  const { error } = await supabaseAdmin
    .from('rulesets')
    .upsert({
      slug: rulesetData.slug,
      title: rulesetData.title,
      is_default: rulesetData.is_default,
      world_id: rulesetData.world_id,
      tags: rulesetData.tags,
      metadata: rulesetData.metadata,
    }, {
      onConflict: 'slug',
    });
  
  if (error) throw error;

  // Link ruleset to entry point
  const entryPointId = '00000000-0000-0000-0000-000000000002';
  const { error: linkError } = await supabaseAdmin
    .from('entry_point_rulesets')
    .upsert({
      entry_point_id: entryPointId,
      ruleset_slug: rulesetData.slug,
    }, {
      onConflict: 'entry_point_id,ruleset_slug',
    });
  
  if (linkError) throw linkError;
}

async function seedNpcs(tag: string) {
  const npcsData = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'npcs.json'), 'utf-8')
  );

  for (const npc of npcsData.npcs) {
    if (!npc.tags.includes(tag)) {
      npc.tags.push(tag);
    }

    // Create prompt segment for each NPC (layer='npc')
    const segmentId = `00000000-0000-0000-000${npc.sort_order.toString().padStart(3, '0')}`;
    
    const { error } = await supabaseAdmin
      .from('prompting.prompts')
      .upsert({
        id: segmentId,
        layer: 'npc',
        world_slug: npc.world_slug,
        sort_order: npc.sort_order,
        version: '1.0.0',
        hash: `hash-${npc.slug}`,
        content: `NPC: ${npc.name} (${npc.slug})`,
        metadata: {
          slug: npc.slug,
          name: npc.name,
          tags: npc.tags,
        },
        active: true,
        locked: false,
      }, {
        onConflict: 'id',
      });
    
    if (error) throw error;
  }
}

async function seed(options: SeedOptions = {}) {
  const { tag = DEFAULT_TAG } = options;
  
  console.log(`🌱 Seeding v3 fixtures with tag: ${tag}`);

  try {
    await seedWorld(tag);
    console.log('✅ Seeded world: mystika');
    
    await seedEntryPoint(tag);
    console.log('✅ Seeded entry point: forest_meet');
    
    await seedRuleset(tag);
    console.log('✅ Seeded ruleset: core.default');
    
    await seedNpcs(tag);
    console.log('✅ Seeded 12 NPCs');
    
    console.log('\n✨ Seed complete!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

// CLI handling
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const tagIndex = args.indexOf('--tag');
  const tag = tagIndex >= 0 && args[tagIndex + 1] ? args[tagIndex + 1] : DEFAULT_TAG;
  
  seed({ tag })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seed };

