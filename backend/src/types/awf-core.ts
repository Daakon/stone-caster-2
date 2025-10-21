/**
 * AWF Core Types - Separated Core Contracts and Rulesets
 * Core Contract = framework/invariants only
 * Ruleset = narrative/pacing/style policies
 */

export interface CoreContractV2 {
  contract: {
    name: string;
    awf_return: string; // exact output rule
    keys: { required: string[]; optional: string[] };
    language?: { one_language_only?: boolean };
    acts?: { policy?: string };         // framework note only
    time?: {                            // invariants only
      first_turn_time_advance_allowed: boolean;
      require_time_advance_on_nonfirst_turn: boolean;
      ticks_min_step: number;
    };
    menus?: { min: number; max: number; label_max_chars: number };
    validation?: { policy?: string };
  };
  core: {
    acts_catalog: Array<{ type: string; mode: string; target: string }>;
    scales: {
      skill: { min: number; baseline: number; max: number };
      relationship: { min: number; baseline: number; max: number };
    };
    budgets?: { input_max_tokens?: number; output_max_tokens?: number };
  };
}

export interface CoreRulesetV1 {
  ruleset: {
    name: string;

    // narrative & pacing — these were previously in "core"
    "scn.phases": string[];                     // non-empty
    "txt.policy": string;                       // required
    "choices.policy": string;                   // required

    language?: { one_language_only?: boolean; use_meta_locale?: boolean };
    token_discipline?: {
      npcs_active_cap?: number;
      sim_nearby_token_cap?: number;
      mods_micro_slice_cap_per_namespace?: number;
      mods_micro_slice_cap_global?: number;
      episodic_cap?: number;
      episodic_note_max_chars?: number;
    };
    time?: { bands_cycle?: string[]; ticks_per_band?: number };
    menus?: { min_choices?: number; max_choices?: number; label_max_chars?: number };
    mechanics_visibility?: { no_mechanics_in_txt?: boolean };
    safety?: {
      consent_required_for_impactful_actions?: boolean;
      offer_player_reaction_when_npc_initiates?: boolean;
    };

    // defaults block (required to satisfy current app expectations)
    defaults: {
      txt_sentences_min: number;
      txt_sentences_max: number;
      time_ticks_min_step?: number;
      cooldowns?: Record<string, number>;
    };
  };
}

// Database record type for core rulesets
export interface CoreRulesetRecord {
  id: string;
  version: string;
  doc: CoreRulesetV1;
  created_at: string;
  updated_at: string;
}
