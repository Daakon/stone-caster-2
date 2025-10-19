/**
 * Seed script for AWF (Adventure World Format) bundle system
 * Phase 1: Data Model - Seed minimal core/world/adventure/start/injection_map data
 */

import { createClient } from '@supabase/supabase-js';
import { AWFRepositoryFactory } from '../src/repositories/awf-repository-factory.js';
import { AdventureDoc, AdventureStartDoc, InjectionMapDoc } from '../src/types/awf-docs.js';
import { WorldDocFlex } from '../src/types/awf-world.js';
import { CoreContract } from '../src/types/awf-core-contract.js';
import { computeDocumentHash } from '../src/utils/awf-hashing.js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'service-local';
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize repository factory
const repoFactory = new AWFRepositoryFactory({ supabase });

// Seed data
const coreContractDoc: CoreContract = {
  contract: {
    awf_return: 'scn, txt, optional choices, optional acts, optional val',
    'scn.phases': ['scene_setup', 'narrative', 'choices', 'resolution'],
    'txt.policy': 'minimum 50 words, descriptive narrative',
    'choices.policy': 'offer 2-4 meaningful choices',
    'acts.policy': 'include TIME_ADVANCE with ticks >= 1'
  },
  rules: {
    language: {
      one_language_only: true,
      use_meta_locale: true
    },
    scales: {
      skill_min: 0,
      skill_max: 100,
      relationship_min: 0,
      relationship_max: 100,
      baseline: 50
    },
    token_discipline: {
      npcs_active_cap: 5,
      sim_nearby_token_cap: 1000,
      mods_micro_slice_cap_per_namespace: 200,
      mods_micro_slice_cap_global: 1000,
      episodic_cap: 50,
      episodic_note_max_chars: 200
    },
    time: {
      require_time_advance_each_nonfirst_turn: true,
      allow_time_advance_on_first_turn: false
    },
    menus: {
      min_choices: 2,
      max_choices: 4,
      label_max_chars: 50
    },
    mechanics_visibility: {
      no_mechanics_in_txt: false
    },
    safety: {
      consent_required_for_impactful_actions: true,
      offer_player_reaction_when_npc_initiates: true
    }
  },
  acts_catalog: [
    { type: 'move', mode: 'immediate', target: 'location' },
    { type: 'interact', mode: 'immediate', target: 'npc' },
    { type: 'inventory', mode: 'immediate', target: 'self' },
    { type: 'save', mode: 'immediate', target: 'session' },
    { type: 'load', mode: 'immediate', target: 'session' },
    { type: 'quit', mode: 'immediate', target: 'session' }
  ],
  defaults: {
    txt_sentences_min: 3,
    txt_sentences_max: 8,
    time_ticks_min_step: 1,
    time_band_cycle: ['Dawn', 'Mid-Day', 'Evening', 'Mid-Night'],
    cooldowns: {
      dialogue_candidate_cooldown_turns: 3
    }
  }
};

const worldDoc: WorldDocFlex = {
  id: 'world.mystika',
  name: 'Mystika',
  version: '1.0.0',
  // Optional timeworld section
  timeworld: {
    timezone: 'UTC',
    calendar: 'Gregorian',
    seasons: ['Spring', 'Summer', 'Autumn', 'Winter']
  },
  // Top-level sections (preferred over timeworld)
  bands: [
    { id: 'dawn_to_mid_day', label: 'Dawn→Mid-Day', ticks: 60 },
    { id: 'mid_day_to_evening', label: 'Mid-Day→Evening', ticks: 60 },
    { id: 'evening_to_mid_night', label: 'Evening→Mid-Night', ticks: 60 },
    { id: 'mid_night_to_dawn', label: 'Mid-Night→Dawn', ticks: 60 }
  ],
  weather_states: ['clear', 'overcast', 'rain', 'fog'],
  weather_transition_bias: { 'clear->rain': 0.10, 'rain->clear': 0.25, 'overcast->rain': 0.20, 'fog->clear': 0.15 },
  lexicon: {
    substitutions: { 'intel': 'gleanings', 'kilometer': 'league', 'okay': 'very well', 'minutes': 'ticks' },
    avoid: ['modern slang', 'explicit tech jargon']
  },
  magic: {
    domains: ['Creation', 'Destruction', 'Arcane', 'Void', 'Fire', 'Water', 'Earth', 'Air'],
    rules: [
      'Great workings require time and focus.',
      'Instant long-range teleport is impossible.',
      'Void use can corrupt outcomes with repetition.'
    ]
  },
  essence_behavior: {
    Life: 'empathetic, restorative',
    Death: 'stoic, accepts hardship',
    Order: 'dutiful, plans ahead',
    Chaos: 'impulsive, playful volatility'
  },
  species_rules: {
    shifter: { bond: 'spirit animal', speech_in_animal_form: false, costs: ['hunger↑', 'fatigue↑'] }
  },
  factions_world: [
    'Glade packs resist slavers',
    'Unaligned settlements waver',
    'Slavers feed distant markets where silence earns coin'
  ],
  lore_index: {
    entries: [
      'Whispercross: damp glades, ward-scarred roots, old paths watched by quiet eyes.',
      'Distant cities drive demand; caravans pay for silence and speed.'
    ]
  },
  tone: { 
    style: ['grounded high fantasy', 'sensory woods imagery', 'kinship under pressure'], 
    taboos: ['modern slang', 'explicit tech jargon'] 
  },
  locations: [
    { id: 'loc.whisper_docks', name: 'Whisper Docks' },
    { id: 'loc.gleam_market', name: 'Gleam Market' }
  ],
  slices: []
};

const adventureDoc: AdventureDoc = {
  id: 'adv.whispercross.v1',
  world_ref: 'world.mystika',
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
    'world.id': '/world/id',
    'world.name': '/world/name',
    'world.version': '/world/version',
    'world.timeworld': '/world/timeworld',
    'world.bands': '/world/bands',
    'world.weather_states': '/world/weather_states',
    'world.weather_transition_bias': '/world/weather_transition_bias',
    'world.lexicon': '/world/lexicon',
    'world.identity_language': '/world/identity_language',
    'world.magic': '/world/magic',
    'world.essence_behavior': '/world/essence_behavior',
    'world.species_rules': '/world/species_rules',
    'world.factions_world': '/world/factions_world',
    'world.lore_index': '/world/lore_index',
    'world.tone': '/world/tone',
    'world.locations': '/world/locations',
    'world.slices': '/world/slices',
    'world.custom': '/world/custom',
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
    // Note: WorldDocFlex doesn't have hash field, it's computed by repository

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
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('seed-awf-data')) {
  seedData();
}

export { seedData };


