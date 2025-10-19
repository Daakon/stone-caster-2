/**
 * Seed AWF Core Contract
 * Inserts the default core contract with the new AWF schema
 */

import { createClient } from '@supabase/supabase-js';
import { CoreContract } from '../src/types/awf-core-contract.js';
import { validateCoreContract } from '../src/validators/awf-core-contract.schema.js';
import { computeDocumentHash } from '../src/utils/awf-hashing.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const defaultCoreContract: CoreContract = {
  contract: {
    awf_return: "json",
    "scn.phases": ["setup", "play", "resolution"],
    "txt.policy": "narrative",
    "choices.policy": "player_choice",
    "acts.policy": "system_controlled"
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
      sim_nearby_token_cap: 260,
      mods_micro_slice_cap_per_namespace: 80,
      mods_micro_slice_cap_global: 200,
      episodic_cap: 60,
      episodic_note_max_chars: 120
    },
    time: {
      require_time_advance_each_nonfirst_turn: true,
      allow_time_advance_on_first_turn: false
    },
    menus: {
      min_choices: 1,
      max_choices: 5,
      label_max_chars: 48
    },
    mechanics_visibility: {
      no_mechanics_in_txt: true
    },
    safety: {
      consent_required_for_impactful_actions: true,
      offer_player_reaction_when_npc_initiates: true
    }
  },
  acts_catalog: [
    { type: "TIME_ADVANCE", mode: "add_number", target: "time.ticks" },
    { type: "SCENE_SET", mode: "set_value", target: "hot.scene" },
    { type: "OBJECTIVE_UPDATE", mode: "upsert_by_id", target: "hot.objectives" },
    { type: "FLAG_SET", mode: "set_by_key", target: "hot.flags" },
    { type: "REL_DELTA", mode: "merge_delta_by_npc", target: "warm.relationships" },
    { type: "RESOURCE_DELTA", mode: "merge_delta_by_key", target: "mechanics.resources" },
    { type: "EPISODIC_ADD", mode: "append_unique_by_key", target: "warm.episodic" },
    { type: "PIN_ADD", mode: "add_unique", target: "warm.pins" },
    { type: "TAG_MEMORY", mode: "tag_by_key", target: "warm.tags" },
    { type: "MEMORY_REMOVE", mode: "remove_by_key", target: "warm.episodic" },
    { type: "CHECK_RESULT", mode: "append_unique_by_key", target: "mechanics.checks" },
    { type: "APPLY_STATUS", mode: "upsert_by_id", target: "mechanics.status" },
    { type: "ITEM_ADD", mode: "upsert_by_id", target: "economy.inventory" },
    { type: "ITEM_REMOVE", mode: "upsert_by_id", target: "economy.inventory" },
    { type: "EQUIP", mode: "upsert_by_id", target: "economy.equipment" },
    { type: "UNEQUIP", mode: "upsert_by_id", target: "economy.equipment" },
    { type: "PARTY_RECRUIT", mode: "upsert_by_id", target: "party.members" },
    { type: "PARTY_DISMISS", mode: "upsert_by_id", target: "party.members" },
    { type: "PARTY_SET_INTENT", mode: "upsert_by_id", target: "party.intents" }
  ],
  defaults: {
    txt_sentences_min: 2,
    txt_sentences_max: 6,
    time_ticks_min_step: 1,
    time_band_cycle: ["Dawn", "Mid-Day", "Evening", "Mid-Night"],
    cooldowns: {
      dialogue_candidate_cooldown_turns: 1
    }
  }
};

async function seedCoreContract() {
  try {
    console.log('Validating core contract schema...');
    validateCoreContract(defaultCoreContract);
    console.log('✓ Schema validation passed');

    console.log('Computing document hash...');
    const hash = computeDocumentHash(defaultCoreContract);
    console.log(`✓ Hash computed: ${hash.substring(0, 8)}...`);

    console.log('Inserting core contract...');
    const { data, error } = await supabase
      .from('core_contracts')
      .upsert({
        id: 'core.default',
        version: '1.0.0',
        doc: defaultCoreContract,
        hash,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id,version' })
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    console.log('✓ Core contract seeded successfully');
    console.log(`  ID: ${data.id}`);
    console.log(`  Version: ${data.version}`);
    console.log(`  Active: ${data.active}`);
    console.log(`  Hash: ${data.hash.substring(0, 8)}...`);

  } catch (error) {
    console.error('❌ Failed to seed core contract:', error);
    process.exit(1);
  }
}

// Run the seed function
seedCoreContract();
