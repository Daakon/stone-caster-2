/**
 * Tests for AWF Core Contract Schema
 * Tests the new strict AWF core contract schema validation
 */

import { describe, it, expect } from 'vitest';
import { CoreContractSchema, validateCoreContract } from '../src/validators/awf-core-contract.schema.js';

describe('AWF Core Contract Schema', () => {
  const validCoreContract = {
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
      { type: "SCENE_SET", mode: "set_value", target: "hot.scene" }
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

  describe('Valid documents', () => {
    it('should accept a valid core contract', () => {
      expect(() => validateCoreContract(validCoreContract)).not.toThrow();
    });

    it('should parse valid core contract with schema', () => {
      const result = CoreContractSchema.parse(validCoreContract);
      expect(result).toEqual(validCoreContract);
    });
  });

  describe('Invalid documents', () => {
    it('should reject documents with missing contract', () => {
      const invalid = { ...validCoreContract };
      delete (invalid as any).contract;
      
      expect(() => validateCoreContract(invalid)).toThrow();
    });

    it('should reject documents with missing rules', () => {
      const invalid = { ...validCoreContract };
      delete (invalid as any).rules;
      
      expect(() => validateCoreContract(invalid)).toThrow();
    });

    it('should reject documents with missing acts_catalog', () => {
      const invalid = { ...validCoreContract };
      delete (invalid as any).acts_catalog;
      
      expect(() => validateCoreContract(invalid)).toThrow();
    });

    it('should reject documents with missing defaults', () => {
      const invalid = { ...validCoreContract };
      delete (invalid as any).defaults;
      
      expect(() => validateCoreContract(invalid)).toThrow();
    });

    it('should reject documents with invalid contract fields', () => {
      const invalid = {
        ...validCoreContract,
        contract: {
          ...validCoreContract.contract,
          awf_return: "" // Empty string should fail
        }
      };
      
      expect(() => validateCoreContract(invalid)).toThrow();
    });

    it('should reject documents with empty acts_catalog', () => {
      const invalid = {
        ...validCoreContract,
        acts_catalog: []
      };
      
      expect(() => validateCoreContract(invalid)).toThrow();
    });

    it('should reject documents with invalid acts_catalog items', () => {
      const invalid = {
        ...validCoreContract,
        acts_catalog: [
          { type: "", mode: "add_number", target: "time.ticks" } // Empty type should fail
        ]
      };
      
      expect(() => validateCoreContract(invalid)).toThrow();
    });

    it('should reject documents with extra unknown fields', () => {
      const invalid = {
        ...validCoreContract,
        legacy_field: "should not be here"
      };
      
      expect(() => validateCoreContract(invalid)).toThrow();
    });

    it('should reject documents with legacy contract fields', () => {
      const invalid = {
        ...validCoreContract,
        contract: {
          ...validCoreContract.contract,
          version: "1.0.0", // Legacy field
          name: "Test Contract", // Legacy field
          description: "Test Description" // Legacy field
        }
      };
      
      expect(() => validateCoreContract(invalid)).toThrow();
    });

    it('should reject documents with legacy acts.allowed field', () => {
      const invalid = {
        ...validCoreContract,
        acts: {
          allowed: ["dialogue", "narrative"] // Legacy field
        }
      };
      
      expect(() => validateCoreContract(invalid)).toThrow();
    });

    it('should reject documents with legacy memory.exemplars field', () => {
      const invalid = {
        ...validCoreContract,
        memory: {
          exemplars: [] // Legacy field
        }
      };
      
      expect(() => validateCoreContract(invalid)).toThrow();
    });
  });

  describe('Strict validation', () => {
    it('should reject unknown keys at all levels', () => {
      const invalid = {
        ...validCoreContract,
        contract: {
          ...validCoreContract.contract,
          unknown_field: "should fail"
        }
      };
      
      expect(() => validateCoreContract(invalid)).toThrow();
    });

    it('should reject unknown keys in rules', () => {
      const invalid = {
        ...validCoreContract,
        rules: {
          ...validCoreContract.rules,
          unknown_rule: "should fail"
        }
      };
      
      expect(() => validateCoreContract(invalid)).toThrow();
    });
  });
});
