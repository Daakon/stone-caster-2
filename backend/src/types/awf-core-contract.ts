/**
 * AWF Core Contract Types
 * Strict TypeScript interfaces for the new AWF core contract schema
 */

export interface CoreContract {
  readonly contract: {
    readonly awf_return: string;
    readonly 'scn.phases': readonly string[];
    readonly 'txt.policy': string;
    readonly 'choices.policy': string;
    readonly 'acts.policy': string;
  };
  readonly rules: {
    readonly language: {
      readonly one_language_only: boolean;
      readonly use_meta_locale: boolean;
    };
    readonly scales: {
      readonly skill_min: number;
      readonly skill_max: number;
      readonly relationship_min: number;
      readonly relationship_max: number;
      readonly baseline: number;
    };
    readonly token_discipline: {
      readonly npcs_active_cap: number;
      readonly sim_nearby_token_cap: number;
      readonly mods_micro_slice_cap_per_namespace: number;
      readonly mods_micro_slice_cap_global: number;
      readonly episodic_cap: number;
      readonly episodic_note_max_chars: number;
    };
    readonly time: {
      readonly require_time_advance_each_nonfirst_turn: boolean;
      readonly allow_time_advance_on_first_turn: boolean;
    };
    readonly menus: {
      readonly min_choices: number;
      readonly max_choices: number;
      readonly label_max_chars: number;
    };
    readonly mechanics_visibility: {
      readonly no_mechanics_in_txt: boolean;
    };
    readonly safety: {
      readonly consent_required_for_impactful_actions: boolean;
      readonly offer_player_reaction_when_npc_initiates: boolean;
    };
  };
  readonly acts_catalog: readonly ActCatalogItem[];
  readonly defaults: {
    readonly txt_sentences_min: number;
    readonly txt_sentences_max: number;
    readonly time_ticks_min_step: number;
    readonly time_band_cycle: readonly string[];
    readonly cooldowns: {
      readonly dialogue_candidate_cooldown_turns: number;
    };
  };
}

export interface ActCatalogItem {
  readonly type: string;
  readonly mode: string;
  readonly target: string;
}

export interface CoreContractRecord {
  readonly id: string;
  readonly version: string;
  readonly doc: CoreContract;
  readonly hash: string;
  readonly active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}
