/**
 * Seed AWF Core Data
 * Creates the initial core contract and ruleset data
 */

import { createClient } from '@supabase/supabase-js';
import { CoreContractsRepository } from '../src/repositories/awf-core-contracts-repository.js';
import { CoreRulesetsRepository } from '../src/repositories/awf-core-rulesets-repository.js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seedCoreData() {
  console.log('🌱 Seeding AWF Core Data...');

  const coreContractsRepo = new CoreContractsRepository({ supabase });
  const coreRulesetsRepo = new CoreRulesetsRepository(supabase);

  // Seed Active Core Contract (core.default@2.0.0)
  const coreContractData = {
    contract: {
      name: "StoneCaster Core Contract",
      awf_return: "Return exactly one JSON object named AWF with keys scn, txt, and optional choices, optional acts, optional val. No markdown, no code fences, no extra keys.",
      keys: { required: ["scn","txt"], optional: ["choices","acts","val"] },
      language: { one_language_only: true },
      time: { 
        first_turn_time_advance_allowed: false, 
        require_time_advance_on_nonfirst_turn: true, 
        ticks_min_step: 1 
      },
      menus: { min: 1, max: 5, label_max_chars: 48 },
      validation: { policy: "No extra top-level keys; avoid nulls; compact values." }
    },
    core: {
      acts_catalog: [
        { "type": "TIME_ADVANCE",     "mode": "add_number",           "target": "time.ticks" },
        { "type": "SCENE_SET",        "mode": "set_value",            "target": "hot.scene" },
        { "type": "OBJECTIVE_UPDATE", "mode": "upsert_by_id",         "target": "hot.objectives" },
        { "type": "FLAG_SET",         "mode": "set_by_key",           "target": "hot.flags" },
        { "type": "REL_DELTA",        "mode": "merge_delta_by_npc",   "target": "warm.relationships" },
        { "type": "RESOURCE_DELTA",   "mode": "merge_delta_by_key",   "target": "mechanics.resources" },
        { "type": "EPISODIC_ADD",     "mode": "append_unique_by_key", "target": "warm.episodic" },
        { "type": "PIN_ADD",          "mode": "add_unique",           "target": "warm.pins" },
        { "type": "TAG_MEMORY",       "mode": "tag_by_key",           "target": "warm.tags" },
        { "type": "MEMORY_REMOVE",    "mode": "remove_by_key",        "target": "warm.episodic" },
        { "type": "CHECK_RESULT",     "mode": "append_unique_by_key", "target": "mechanics.checks" },
        { "type": "APPLY_STATUS",     "mode": "upsert_by_id",         "target": "mechanics.status" },
        { "type": "ITEM_ADD",         "mode": "upsert_by_id",         "target": "economy.inventory" },
        { "type": "ITEM_REMOVE",      "mode": "remove_by_id",          "target": "economy.inventory" },
        { "type": "EQUIP",            "mode": "upsert_by_id",         "target": "economy.equipment" },
        { "type": "UNEQUIP",          "mode": "remove_by_id",         "target": "economy.equipment" },
        { "type": "PARTY_RECRUIT",    "mode": "upsert_by_id",         "target": "party.members" },
        { "type": "PARTY_DISMISS",    "mode": "remove_by_id",         "target": "party.members" },
        { "type": "PARTY_SET_INTENT", "mode": "upsert_by_id",         "target": "party.intents" }
      ],
      scales: {
        "skill":        { "min": 0, "baseline": 50, "max": 100 },
        "relationship": { "min": 0, "baseline": 50, "max": 100 }
      },
      budgets: { "input_max_tokens": 6000, "output_max_tokens": 1200 }
    }
  };

  try {
    await coreContractsRepo.create('core.default', '2.0.0', coreContractData);
    await coreContractsRepo.activate('core.default', '2.0.0');
    console.log('✅ Core Contract seeded and activated');
  } catch (error) {
    console.error('❌ Failed to seed core contract:', error);
  }

  // Seed Default Ruleset (ruleset.core.default@1.0.0)
  const rulesetData = {
    ruleset: {
      name: "Default Narrative & Pacing",
      "scn.phases": ["setup","play","resolution"],
      "txt.policy": "2–6 sentences, cinematic, second-person. No mechanics in txt; mechanics/deltas belong only in acts.",
      "choices.policy": "Only when a menu is available; 1–5 items; label ≤ 48 chars; include a stable id per item.",
      language: { "one_language_only": true, "use_meta_locale": true },
      mechanics_visibility: { "no_mechanics_in_txt": true },
      safety: {
        "consent_required_for_impactful_actions": true,
        "offer_player_reaction_when_npc_initiates": true
      },
      token_discipline: {
        "npcs_active_cap": 5,
        "sim_nearby_token_cap": 260,
        "mods_micro_slice_cap_per_namespace": 80,
        "mods_micro_slice_cap_global": 200,
        "episodic_cap": 60,
        "episodic_note_max_chars": 120
      },
      time: { "bands_cycle": ["Dawn","Mid-Day","Evening","Mid-Night"], "ticks_per_band": 60 },
      menus: { "min_choices": 1, "max_choices": 5, "label_max_chars": 48 },
      defaults: {
        "txt_sentences_min": 2,
        "txt_sentences_max": 6,
        "time_ticks_min_step": 1,
        "cooldowns": { "dialogue_candidate_cooldown_turns": 1 }
      }
    }
  };

  try {
    await coreRulesetsRepo.create('ruleset.core.default', '1.0.0', rulesetData);
    await coreRulesetsRepo.activate('ruleset.core.default', '1.0.0');
    console.log('✅ Core Ruleset seeded and activated');
  } catch (error) {
    console.error('❌ Failed to seed core ruleset:', error);
  }

  console.log('🎉 AWF Core Data seeding completed!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedCoreData().catch(console.error);
}

export { seedCoreData };
