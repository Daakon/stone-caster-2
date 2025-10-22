-- Phase 1: Core vs Rulesets Framework Split - Seed Data
-- Migration: 20250129_awf_core_rulesets_seed.sql
-- Add default core contract (framework-only) and ruleset seed data

-- Insert default core contract (framework-only) if it doesn't exist
INSERT INTO core_contracts (id, version, doc, hash, active, created_at, updated_at)
VALUES (
  'core.default',
  '2.0.0',
  '{
    "contract": {
      "name": "StoneCaster Core Contract",
      "awf_return": "Return exactly one JSON object named AWF with keys scn, txt, and optional choices, optional acts, optional val. No markdown, no code fences, no extra keys.",
      "keys": { "required": ["scn","txt"], "optional": ["choices","acts","val"] },
      "language": { "one_language_only": true },
      "time": { 
        "first_turn_time_advance_allowed": false, 
        "require_time_advance_on_nonfirst_turn": true, 
        "ticks_min_step": 1 
      },
      "menus": { "min": 1, "max": 5, "label_max_chars": 48 },
      "validation": { "policy": "No extra top-level keys; avoid nulls; compact values." }
    },
    "core": {
      "acts_catalog": [
        { "type": "TIME_ADVANCE","mode": "add_number","target": "time.ticks" },
        { "type": "SCENE_SET","mode": "set_value","target": "hot.scene" },
        { "type": "OBJECTIVE_UPDATE","mode": "upsert_by_id","target": "hot.objectives" },
        { "type": "FLAG_SET","mode": "set_by_key","target": "hot.flags" },
        { "type": "REL_DELTA","mode": "merge_delta_by_npc","target": "warm.relationships" },
        { "type": "RESOURCE_DELTA","mode": "merge_delta_by_key","target": "mechanics.resources" },
        { "type": "EPISODIC_ADD","mode": "append_unique_by_key","target": "warm.episodic" },
        { "type": "PIN_ADD","mode": "add_unique","target": "warm.pins" },
        { "type": "TAG_MEMORY","mode": "tag_by_key","target": "warm.tags" },
        { "type": "MEMORY_REMOVE","mode": "remove_by_key","target": "warm.episodic" },
        { "type": "CHECK_RESULT","mode": "append_unique_by_key","target": "mechanics.checks" },
        { "type": "APPLY_STATUS","mode": "upsert_by_id","target": "mechanics.status" },
        { "type": "ITEM_ADD","mode": "upsert_by_id","target": "economy.inventory" },
        { "type": "ITEM_REMOVE","mode": "remove_by_id","target": "economy.inventory" },
        { "type": "EQUIP","mode": "upsert_by_id","target": "economy.equipment" },
        { "type": "UNEQUIP","mode": "remove_by_id","target": "economy.equipment" },
        { "type": "PARTY_RECRUIT","mode": "upsert_by_id","target": "party.members" },
        { "type": "PARTY_DISMISS","mode": "remove_by_id","target": "party.members" },
        { "type": "PARTY_SET_INTENT","mode": "upsert_by_id","target": "party.intents" }
      ],
      "scales": {
        "skill": { "min": 0, "baseline": 50, "max": 100 },
        "relationship": { "min": 0, "baseline": 50, "max": 100 }
      },
      "budgets": { "input_max_tokens": 6000, "output_max_tokens": 1200 }
    }
  }'::jsonb,
  'core-contract-v2-framework-hash',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id, version) DO UPDATE SET
  doc = EXCLUDED.doc,
  hash = EXCLUDED.hash,
  active = EXCLUDED.active,
  updated_at = NOW();

-- Insert default ruleset (narrative/pacing/style)
INSERT INTO core_rulesets (id, version, doc, created_at, updated_at)
VALUES (
  'ruleset.core.default',
  '1.0.0',
  '{
    "ruleset": {
      "name": "Default Narrative & Pacing",
      "scn.phases": ["setup","play","resolution"],
      "txt.policy": "2–6 sentences, cinematic, second-person. No mechanics in txt; mechanics only in acts.",
      "choices.policy": "Only when a menu is available; 1–5 items; label ≤ 48 chars; include a stable id per item.",
      "language": { "one_language_only": true, "use_meta_locale": true },
      "mechanics_visibility": { "no_mechanics_in_txt": true },
      "safety": {
        "consent_required_for_impactful_actions": true,
        "offer_player_reaction_when_npc_initiates": true
      },
      "token_discipline": {
        "npcs_active_cap": 5,
        "sim_nearby_token_cap": 260,
        "mods_micro_slice_cap_per_namespace": 80,
        "mods_micro_slice_cap_global": 200,
        "episodic_cap": 60,
        "episodic_note_max_chars": 120
      },
      "time": { "bands_cycle": ["Dawn","Mid-Day","Evening","Mid-Night"], "ticks_per_band": 60 },
      "menus": { "min_choices": 1, "max_choices": 5, "label_max_chars": 48 },
      "defaults": {
        "txt_sentences_min": 2,
        "txt_sentences_max": 6,
        "time_ticks_min_step": 1,
        "cooldowns": { "dialogue_candidate_cooldown_turns": 1 }
      }
    }
  }'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (id, version) DO UPDATE SET
  doc = EXCLUDED.doc,
  updated_at = NOW();

-- Update injection map to include ruleset injection
INSERT INTO injection_map (id, doc) 
VALUES (
  'default',
  '{
    "build": {
      "contract": { "from": "core_contracts.active.doc.contract" },
      "core_acts_catalog": { "from": "core_contracts.active.doc.core.acts_catalog" },
      "core_scales": { "from": "core_contracts.active.doc.core.scales" },
      "core_budgets": { "from": "core_contracts.active.doc.core.budgets", "fallback": { "ifMissing": {"input_max_tokens":6000,"output_max_tokens":1200} }},
      "core_ruleset": { "from": "core_rulesets[{session.meta.ruleset_ref}].doc.ruleset" },
      "world_meta": { "from": "worlds[{session.world_ref}].doc" },
      "adventure_meta": { "from": "adventures[{session.adventure_ref}].doc" },
      "game_state_hot": { "from": "game_states[{session.session_id}].hot" },
      "game_state_warm": { "from": "game_states[{session.session_id}].warm" },
      "game_state_cold": { "from": "game_states[{session.session_id}].cold" },
      "player_data": { "from": "player_profiles[{session.player_id}].doc" },
      "npcs_active": { "from": "npcs.active" },
      "input_text": { "from": "input.text" },
      "meta_locale": { "from": "session.locale" },
      "meta_turn_id": { "from": "session.turn_id" },
      "meta_is_first_turn": { "from": "session.is_first_turn" }
    }
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  doc = EXCLUDED.doc,
  updated_at = NOW();




