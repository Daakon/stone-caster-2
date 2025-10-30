-- Phase 1: Core vs Rulesets Framework Split - Update Injection Map
-- Migration: 20250129_awf_injection_map_env_ruleset.sql
-- Update injection map to use env.ruleset_ref for ruleset resolution

-- Update injection map to use environment-driven ruleset pointer
INSERT INTO injection_map (id, doc) 
VALUES (
  'default',
  '{
    "build": {
      "contract": { "from": "core_contracts.active.doc.contract" },
      "core_acts_catalog": { "from": "core_contracts.active.doc.core.acts_catalog" },
      "core_scales": { "from": "core_contracts.active.doc.core.scales" },
      "core_budgets": { "from": "core_contracts.active.doc.core.budgets", "fallback": { "ifMissing": {"input_max_tokens":6000,"output_max_tokens":1200} }},
      "core_ruleset": { 
        "from": "core_rulesets[{env.ruleset_ref}].doc.ruleset",
        "fallback": { 
          "ifMissing": { 
            "name": "Default Narrative & Pacing",
            "scn.phases": ["setup","play","resolution"],
            "txt.policy": "2–6 sentences, cinematic, second-person. No mechanics in txt.",
            "choices.policy": "1–5 concise options; label ≤ 48 chars.",
            "defaults": {"txt_sentences_min":2,"txt_sentences_max":6}
          } 
        }
      },
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

-- Add comment
COMMENT ON TABLE injection_map IS 'Injection map for AWF bundle assembly - updated to use env.ruleset_ref for ruleset resolution';














