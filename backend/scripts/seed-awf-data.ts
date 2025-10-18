/**
 * Seed script for AWF (Adventure World Format) bundle system
 * Phase 1: Data Model - Seed minimal core/world/adventure/start/injection_map data
 */

import { createClient } from '@supabase/supabase-js';
import { AWFRepositoryFactory } from '../src/repositories/awf-repository-factory.js';
import { CoreContractDoc, WorldDoc, AdventureDoc, AdventureStartDoc, InjectionMapDoc } from '../src/types/awf-docs.js';
import { computeDocumentHash } from '../src/utils/awf-hashing.js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'service-local';
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize repository factory
const repoFactory = new AWFRepositoryFactory({ supabase });

// Seed data
const coreContractDoc: CoreContractDoc = {
  contract: {
    version: 'v4',
    name: 'Stone Caster Core Contract',
    description: 'Core contract for Stone Caster AWF bundle system',
  },
  acts: {
    allowed: ['move', 'interact', 'inventory', 'save', 'load', 'quit'],
  },
  memory: {
    exemplars: [
      {
        id: 'exemplar-1',
        content: 'Player moves to the forest clearing and discovers an ancient stone.',
        metadata: { type: 'movement', location: 'forest_clearing' },
      },
      {
        id: 'exemplar-2',
        content: 'Player interacts with the mysterious NPC and learns about the prophecy.',
        metadata: { type: 'interaction', npc: 'mysterious_wanderer' },
      },
    ],
  },
};

const worldDoc: WorldDoc = {
  id: 'world.mystika.v1',
  name: 'Mystika',
  version: 'v1',
  hash: '', // Will be computed
  timeworld: {
    timezone: 'UTC',
    calendar: 'mystika_calendar',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
  },
  slices: [
    {
      id: 'slice.forest',
      name: 'Enchanted Forest',
      description: 'A mystical forest filled with ancient magic and mysterious creatures.',
      type: 'location',
      metadata: { biome: 'forest', magic_level: 'high' },
    },
    {
      id: 'slice.tower',
      name: 'Crystal Tower',
      description: 'An ancient tower made of pure crystal, pulsing with magical energy.',
      type: 'location',
      metadata: { biome: 'tower', magic_level: 'extreme' },
    },
  ],
};

const adventureDoc: AdventureDoc = {
  id: 'adv.whispercross.v1',
  world_ref: 'world.mystika.v1',
  version: 'v1',
  hash: '', // Will be computed
  locations: [
    {
      id: 'loc.forest_clearing',
      name: 'Forest Clearing',
      description: 'A peaceful clearing in the enchanted forest, bathed in golden sunlight.',
      connections: ['loc.forest_path', 'loc.ancient_tree'],
      metadata: { atmosphere: 'peaceful', lighting: 'golden' },
    },
    {
      id: 'loc.forest_path',
      name: 'Forest Path',
      description: 'A winding path through the dense forest, leading deeper into the woods.',
      connections: ['loc.forest_clearing', 'loc.mysterious_glade'],
      metadata: { atmosphere: 'mysterious', lighting: 'dim' },
    },
  ],
  objectives: [
    {
      id: 'obj.find_stone',
      title: 'Find the Ancient Stone',
      description: 'Discover the mysterious stone mentioned in the prophecy.',
      type: 'main',
      status: 'active',
      metadata: { priority: 'high', difficulty: 'medium' },
    },
    {
      id: 'obj.explore_forest',
      title: 'Explore the Forest',
      description: 'Learn about the forest and its magical inhabitants.',
      type: 'side',
      status: 'active',
      metadata: { priority: 'low', difficulty: 'easy' },
    },
  ],
  npcs: [
    {
      id: 'npc.mysterious_wanderer',
      name: 'The Mysterious Wanderer',
      description: 'A hooded figure who seems to know more than they let on.',
      role: 'guide',
      location: 'loc.forest_clearing',
      metadata: { knowledge: 'high', friendliness: 'neutral' },
    },
  ],
  slices: [
    {
      id: 'slice.forest_encounter',
      name: 'Forest Encounter',
      description: 'A chance meeting with a forest guardian.',
      type: 'encounter',
      metadata: { trigger: 'location', difficulty: 'easy' },
    },
  ],
};

const adventureStartDoc: AdventureStartDoc = {
  start: {
    scene: 'loc.forest_clearing',
    description: 'You find yourself in a peaceful forest clearing, bathed in golden sunlight.',
    initial_state: {
      time: 'morning',
      weather: 'clear',
      mood: 'peaceful',
    },
  },
  rules: {
    no_time_advance: true,
    allow_save: true,
    allow_load: true,
  },
};

const injectionMapDoc: InjectionMapDoc = {
  build: {
    'core.contract': '/core/contract',
    'world.data': '/world/data',
    'adventure.data': '/adventure/data',
    'session.state': '/session/state',
  },
  acts: {
    'move': '/acts/move',
    'interact': '/acts/interact',
    'inventory': '/acts/inventory',
    'save': '/acts/save',
    'load': '/acts/load',
    'quit': '/acts/quit',
  },
};

async function seedData(): Promise<void> {
  console.log('🌱 Starting AWF bundle data seeding...');

  try {
    // Compute hashes
    const coreContractHash = computeDocumentHash(coreContractDoc);
    const worldHash = computeDocumentHash(worldDoc);
    const adventureHash = computeDocumentHash(adventureDoc);

    // Update docs with computed hashes
    worldDoc.hash = worldHash;
    adventureDoc.hash = adventureHash;

    // Get repositories
    const coreContractsRepo = repoFactory.getCoreContractsRepository();
    const worldsRepo = repoFactory.getWorldsRepository();
    const adventuresRepo = repoFactory.getAdventuresRepository();
    const adventureStartsRepo = repoFactory.getAdventureStartsRepository();
    const injectionMapRepo = repoFactory.getInjectionMapRepository();

    // Seed core contract
    console.log('📄 Seeding core contract...');
    const coreContractRecord = await coreContractsRepo.upsert({
      id: 'core.contract.v4',
      version: 'v4',
      doc: coreContractDoc,
      hash: coreContractHash,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    console.log(`✅ Core contract seeded: ${coreContractRecord.id}`);

    // Seed world
    console.log('🌍 Seeding world...');
    const worldRecord = await worldsRepo.upsert({
      id: worldDoc.id,
      version: worldDoc.version,
      doc: worldDoc,
      hash: worldHash,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    console.log(`✅ World seeded: ${worldRecord.id}`);

    // Seed adventure
    console.log('🎯 Seeding adventure...');
    const adventureRecord = await adventuresRepo.upsert({
      id: adventureDoc.id,
      world_ref: adventureDoc.world_ref,
      version: adventureDoc.version,
      doc: adventureDoc,
      hash: adventureHash,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    console.log(`✅ Adventure seeded: ${adventureRecord.id}`);

    // Seed adventure start
    console.log('🚀 Seeding adventure start...');
    const adventureStartRecord = await adventureStartsRepo.upsert({
      adventure_ref: adventureDoc.id,
      doc: adventureStartDoc,
      use_once: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    console.log(`✅ Adventure start seeded: ${adventureStartRecord.adventure_ref}`);

    // Seed injection map
    console.log('🗺️ Seeding injection map...');
    const injectionMapRecord = await injectionMapRepo.upsert({
      id: 'default',
      doc: injectionMapDoc,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    console.log(`✅ Injection map seeded: ${injectionMapRecord.id}`);

    console.log('🎉 AWF bundle data seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding AWF bundle data:', error);
    process.exit(1);
  }
}

// Run seeding if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedData();
}

export { seedData };


