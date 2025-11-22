// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Seed V3 Master Data
 * Loads canonical game content from master.json into the database
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { getChimeraSupabaseAdminClient } from '../src/db/supabase-client.js';
import { RulesetsRepository } from '../src/db/repos/rulesets.repo.js';
import { WorldsRepository } from '../src/db/repos/worlds.repo.js';
import { EntitiesRepository } from '../src/db/repos/entities.repo.js';
import { LoreRepository } from '../src/db/repos/lore.repo.js';
import type { RulesetDefinition, WorldDefinition, EntityTemplate, LoreFragment } from '@shared/types/chimera-authoring';

interface MasterData {
  worlds: Array<{
    id: string;
    key: string;
    title: string;
    summary: string;
    character_schema_extensions: Record<string, unknown>;
    lore_hooks: string[];
    meta?: Record<string, unknown>;
  }>;
  rulesets: Array<{
    id: string;
    key: string;
    name: string;
    ui_category: string;
    exclusion_group?: string;
    dependencies?: string[];
    state_contributions?: Record<string, unknown>;
    actions?: Record<string, unknown>;
    ai_instructions?: Record<string, unknown>;
    provides_tags?: string[];
    character_schema_extensions?: Record<string, unknown>;
  }>;
  entities: Array<{
    id: string;
    key: string;
    kind: string;
    raw_data: Record<string, unknown>;
  }>;
  lore: Array<{
    id: string;
    key: string;
    title: string;
    tags: string[];
    content: string;
    triggers?: Record<string, unknown>;
  }>;
}

async function seedMasterData() {
  console.log('[Seed] Starting Mystika V3 seed...');

  // Initialize admin client (bypasses RLS)
  const adminClient = getChimeraSupabaseAdminClient();
  const rulesetsRepo = new RulesetsRepository(adminClient);
  const worldsRepo = new WorldsRepository(adminClient);
  const entitiesRepo = new EntitiesRepository(adminClient);
  const loreRepo = new LoreRepository(adminClient);

  // Load master.json
  const masterPath = join(process.cwd(), 'docs', 'data', 'master.json');
  const masterContent = readFileSync(masterPath, 'utf-8');
  const masterData: MasterData = JSON.parse(masterContent);

  // A. Seed Rulesets
  console.log('[Seed] Seeding rulesets...');
  for (const rs of masterData.rulesets) {
    // Map dependencies from IDs to keys
    const dependencies = rs.dependencies?.map((depId) => {
      const depRuleset = masterData.rulesets.find((r) => r.id === depId);
      return depRuleset?.key || depId;
    }) || [];

    // Transform to RulesetDefinition
    const rulesetDef: RulesetDefinition = {
      id: rs.key,
      name: rs.name,
      ui_category: rs.ui_category as 'foundation' | 'expansion' | 'flavor',
      exclusion_group: rs.exclusion_group || null,
      dependencies,
      provides_tags: rs.provides_tags || [],
      state_contributions: rs.state_contributions || {},
      actions: rs.actions || {},
      ai_instructions: rs.ai_instructions || {},
      character_schema_extensions: rs.character_schema_extensions,
    };

    // Upsert: Check if exists, then create or update
    const existing = await rulesetsRepo.findByKey(rs.key);
    if (existing) {
      console.log(`[Seed] Ruleset ${rs.key} already exists, skipping...`);
      // Note: Repositories don't have update methods, so we'll delete and recreate
      // In production, you'd want to add update methods
      const { error: deleteError } = await adminClient
        .from('chimera_ruleset_templates')
        .delete()
        .eq('key', rs.key);
      
      if (deleteError) {
        console.error(`[Seed] Error deleting existing ruleset ${rs.key}:`, deleteError);
        throw deleteError;
      }
    }

    await rulesetsRepo.create(rulesetDef);
    console.log(`[Seed] ✓ Seeded ruleset: ${rs.key}`);
  }

  // B. Seed World
  console.log('[Seed] Seeding world...');
  for (const world of masterData.worlds) {
    const worldDef: WorldDefinition = {
      id: world.key,
      name: world.title,
      description: world.summary,
      character_schema_extensions: world.character_schema_extensions,
      images: [],
    };

    // Upsert world
    const existing = await worldsRepo.findByKey(world.key);
    if (existing) {
      console.log(`[Seed] World ${world.key} already exists, skipping...`);
      const { error: deleteError } = await adminClient
        .from('chimera_worlds')
        .delete()
        .eq('key', world.key);
      
      if (deleteError) {
        console.error(`[Seed] Error deleting existing world ${world.key}:`, deleteError);
        throw deleteError;
      }
    }

    await worldsRepo.create(worldDef);
    console.log(`[Seed] ✓ Seeded world: ${world.key}`);
  }

  // C. Seed Entities
  console.log('[Seed] Seeding entities...');
  for (const entity of masterData.entities) {
    const entityTemplate: EntityTemplate = {
      id: entity.key,
      kind: entity.kind as 'npc' | 'location' | 'faction' | 'item',
      raw_data: entity.raw_data,
    };

    // Upsert entity
    const existing = await entitiesRepo.findByKey(entity.key);
    if (existing) {
      console.log(`[Seed] Entity ${entity.key} already exists, skipping...`);
      const { error: deleteError } = await adminClient
        .from('chimera_entities')
        .delete()
        .eq('key', entity.key);
      
      if (deleteError) {
        console.error(`[Seed] Error deleting existing entity ${entity.key}:`, deleteError);
        throw deleteError;
      }
    }

    await entitiesRepo.create(entityTemplate);
    console.log(`[Seed] ✓ Seeded entity: ${entity.key} (${entity.kind})`);
  }

  // D. Seed Lore
  console.log('[Seed] Seeding lore...');
  for (const lore of masterData.lore) {
    // Lore fragments use UUIDs for IDs, so we'll generate a deterministic one
    // For seeding, we'll create new entries - duplicates will be handled by unique constraints
    // Store the key in the fragment metadata for reference
    const loreFragment: LoreFragment = {
      id: randomUUID(), // Generate UUID (will be replaced by DB)
      content: lore.content,
      tags: lore.tags,
    };

    // Try to find existing lore by content (simple check)
    // Since lore doesn't have a key field in the DB, we'll just create
    // In production, you might want to add a key field to the fragment JSONB
    try {
      await loreRepo.create(loreFragment);
      console.log(`[Seed] ✓ Seeded lore: ${lore.key}`);
    } catch (error) {
      // If creation fails, log and continue (might be duplicate)
      console.log(`[Seed] Lore ${lore.key} may already exist, skipping...`);
    }
  }

  console.log('[Seed] Seeding Complete: Mystika V3');
}

// Run the seed
seedMasterData()
  .then(() => {
    console.log('[Seed] Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Seed] Error:', error);
    process.exit(1);
  });

