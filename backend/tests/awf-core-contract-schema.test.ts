/**
 * Tests for AWF Core Contract Schema
 * Tests the new strict AWF core contract schema validation
 */

import { describe, it, expect } from 'vitest';
import { CoreContractV2Schema } from '../src/validators/awf-core-contract.schema.js';
import { CoreRulesetV1Schema } from '../src/validators/awf-ruleset.schema.js';

describe('AWF Core Contract Schema V2', () => {
  const validCoreContractV2 = {
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
        { type: "TIME_ADVANCE", mode: "add_number", target: "time.ticks" },
        { type: "SCENE_SET", mode: "set_value", target: "hot.scene" }
      ],
      scales: {
        skill: { min: 0, baseline: 50, max: 100 },
        relationship: { min: 0, baseline: 50, max: 100 }
      },
      budgets: { input_max_tokens: 6000, output_max_tokens: 1200 }
    }
  };

  const validCoreRulesetV1 = {
    ruleset: {
      name: "Default Narrative & Pacing",
      "scn.phases": ["setup","play","resolution"],
      "txt.policy": "2–6 sentences, cinematic, second-person. No mechanics in txt; mechanics/deltas belong only in acts.",
      "choices.policy": "Only when a menu is available; 1–5 items; label ≤ 48 chars; include a stable id per item.",
      language: { one_language_only: true, use_meta_locale: true },
      mechanics_visibility: { no_mechanics_in_txt: true },
      safety: {
        consent_required_for_impactful_actions: true,
        offer_player_reaction_when_npc_initiates: true
      },
      token_discipline: {
        npcs_active_cap: 5,
        sim_nearby_token_cap: 260,
        mods_micro_slice_cap_per_namespace: 80,
        mods_micro_slice_cap_global: 200,
        episodic_cap: 60,
        episodic_note_max_chars: 120
      },
      time: { bands_cycle: ["Dawn","Mid-Day","Evening","Mid-Night"], ticks_per_band: 60 },
      menus: { min_choices: 1, max_choices: 5, label_max_chars: 48 },
      defaults: {
        txt_sentences_min: 2,
        txt_sentences_max: 6,
        time_ticks_min_step: 1,
        cooldowns: { dialogue_candidate_cooldown_turns: 1 }
      }
    }
  };

  describe('Valid Core Contract V2 documents', () => {
    it('should accept a valid core contract V2', () => {
      expect(() => CoreContractV2Schema.parse(validCoreContractV2)).not.toThrow();
    });

    it('should accept a valid core ruleset V1', () => {
      expect(() => CoreRulesetV1Schema.parse(validCoreRulesetV1)).not.toThrow();
    });

    it('should parse valid core contract V2 with schema', () => {
      const result = CoreContractV2Schema.parse(validCoreContractV2);
      expect(result).toEqual(validCoreContractV2);
    });

    it('should parse valid core ruleset V1 with schema', () => {
      const result = CoreRulesetV1Schema.parse(validCoreRulesetV1);
      expect(result).toEqual(validCoreRulesetV1);
    });
  });

  describe('Invalid Core Contract V2 documents', () => {
    it('should reject documents with missing contract', () => {
      const invalid = { ...validCoreContractV2 };
      delete (invalid as any).contract;
      expect(() => CoreContractV2Schema.parse(invalid)).toThrow();
    });

    it('should reject documents with missing core', () => {
      const invalid = { ...validCoreContractV2 };
      delete (invalid as any).core;
      expect(() => CoreContractV2Schema.parse(invalid)).toThrow();
    });

    it('should reject documents with empty acts_catalog', () => {
      const invalid = { ...validCoreContractV2 };
      invalid.core.acts_catalog = [];
      expect(() => CoreContractV2Schema.parse(invalid)).toThrow();
    });

    it('should reject documents with missing required contract fields', () => {
      const invalid = { ...validCoreContractV2 };
      delete (invalid as any).contract.name;
      expect(() => CoreContractV2Schema.parse(invalid)).toThrow();
    });
  });

  describe('Invalid Core Ruleset V1 documents', () => {
    it('should reject documents with missing ruleset', () => {
      const invalid = { ...validCoreRulesetV1 };
      delete (invalid as any).ruleset;
      expect(() => CoreRulesetV1Schema.parse(invalid)).toThrow();
    });

    it('should reject documents with missing scn.phases', () => {
      const invalid = { ...validCoreRulesetV1 };
      delete (invalid as any).ruleset['scn.phases'];
      expect(() => CoreRulesetV1Schema.parse(invalid)).toThrow();
    });

    it('should reject documents with empty scn.phases', () => {
      const invalid = { ...validCoreRulesetV1 };
      invalid.ruleset['scn.phases'] = [];
      expect(() => CoreRulesetV1Schema.parse(invalid)).toThrow();
    });

    it('should reject documents with missing txt.policy', () => {
      const invalid = { ...validCoreRulesetV1 };
      delete (invalid as any).ruleset['txt.policy'];
      expect(() => CoreRulesetV1Schema.parse(invalid)).toThrow();
    });

    it('should reject documents with missing choices.policy', () => {
      const invalid = { ...validCoreRulesetV1 };
      delete (invalid as any).ruleset['choices.policy'];
      expect(() => CoreRulesetV1Schema.parse(invalid)).toThrow();
    });

    it('should reject documents with missing defaults', () => {
      const invalid = { ...validCoreRulesetV1 };
      delete (invalid as any).ruleset.defaults;
      expect(() => CoreRulesetV1Schema.parse(invalid)).toThrow();
    });
  });

  describe('Core Contract V2 should not contain narrative fields', () => {
    it('should reject core contracts with scn.phases', () => {
      const invalid = {
        ...validCoreContractV2,
        contract: {
          ...validCoreContractV2.contract,
          'scn.phases': ['setup', 'play', 'resolution']
        }
      };
      expect(() => CoreContractV2Schema.parse(invalid)).toThrow();
    });

    it('should reject core contracts with txt.policy', () => {
      const invalid = {
        ...validCoreContractV2,
        contract: {
          ...validCoreContractV2.contract,
          'txt.policy': 'narrative policy'
        }
      };
      expect(() => CoreContractV2Schema.parse(invalid)).toThrow();
    });

    it('should reject core contracts with choices.policy', () => {
      const invalid = {
        ...validCoreContractV2,
        contract: {
          ...validCoreContractV2.contract,
          'choices.policy': 'choice policy'
        }
      };
      expect(() => CoreContractV2Schema.parse(invalid)).toThrow();
    });

    it('should reject core contracts with defaults', () => {
      const invalid = {
        ...validCoreContractV2,
        defaults: {
          txt_sentences_min: 2,
          txt_sentences_max: 6
        }
      };
      expect(() => CoreContractV2Schema.parse(invalid)).toThrow();
    });

  });
});
