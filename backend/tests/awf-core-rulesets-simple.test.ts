/**
 * Simple Tests for AWF Core Rulesets
 * Phase 1: Core vs Rulesets Framework Split - Basic functionality tests
 */

import { describe, it, expect } from 'vitest';
import { CoreRulesetV1Schema } from '../src/validators/awf-ruleset.schema.js';
import { CoreContractV2Schema } from '../src/validators/awf-core-contract.schema.js';

describe('AWF Core Rulesets - Basic Functionality', () => {
  const validRuleset = {
    ruleset: {
      name: 'Test Ruleset',
      'scn.phases': ['setup', 'play', 'resolution'],
      'txt.policy': '2–6 sentences, cinematic, second-person.',
      'choices.policy': 'Only when a menu is available; 1–5 items.',
      defaults: {
        txt_sentences_min: 2,
        txt_sentences_max: 6,
        time_ticks_min_step: 1,
        cooldowns: { dialogue_candidate_cooldown_turns: 1 }
      }
    }
  };

  const validCoreContract = {
    contract: {
      name: 'Test Core Contract',
      awf_return: 'Return JSON with scn, txt',
      keys: { required: ['scn', 'txt'], optional: ['choices'] }
    },
    core: {
      acts_catalog: [
        { type: 'TIME_ADVANCE', mode: 'add_number', target: 'time.ticks' }
      ],
      scales: {
        skill: { min: 0, baseline: 50, max: 100 },
        relationship: { min: 0, baseline: 50, max: 100 }
      },
      budgets: { input_max_tokens: 6000, output_max_tokens: 1200 }
    }
  };

  describe('Core Ruleset V1 Schema Validation', () => {
    it('should validate valid ruleset document', () => {
      expect(() => CoreRulesetV1Schema.parse(validRuleset)).not.toThrow();
    });

    it('should reject ruleset without required fields', () => {
      const invalidRuleset = {
        ruleset: {
          name: 'Test Ruleset'
          // Missing required fields
        }
      };

      expect(() => CoreRulesetV1Schema.parse(invalidRuleset)).toThrow();
    });

    it('should reject ruleset with empty scn.phases', () => {
      const invalidRuleset = {
        ...validRuleset,
        ruleset: {
          ...validRuleset.ruleset,
          'scn.phases': []
        }
      };

      expect(() => CoreRulesetV1Schema.parse(invalidRuleset)).toThrow();
    });

    it('should reject ruleset without defaults', () => {
      const invalidRuleset = {
        ruleset: {
          name: 'Test Ruleset',
          'scn.phases': ['setup', 'play', 'resolution'],
          'txt.policy': '2–6 sentences, cinematic, second-person.',
          'choices.policy': 'Only when a menu is available; 1–5 items.'
          // Missing defaults
        }
      };

      expect(() => CoreRulesetV1Schema.parse(invalidRuleset)).toThrow();
    });
  });

  describe('Core Contract V2 Schema Validation', () => {
    it('should validate valid core contract document', () => {
      expect(() => CoreContractV2Schema.parse(validCoreContract)).not.toThrow();
    });

    it('should reject core contract without required fields', () => {
      const invalidContract = {
        contract: {
          name: 'Test Contract'
          // Missing required fields
        }
      };

      expect(() => CoreContractV2Schema.parse(invalidContract)).toThrow();
    });

    it('should reject core contract with empty acts_catalog', () => {
      const invalidContract = {
        ...validCoreContract,
        core: {
          ...validCoreContract.core,
          acts_catalog: []
        }
      };

      expect(() => CoreContractV2Schema.parse(invalidContract)).toThrow();
    });

    it('should reject core contract without core section', () => {
      const invalidContract = {
        contract: validCoreContract.contract
        // Missing core section
      };

      expect(() => CoreContractV2Schema.parse(invalidContract)).toThrow();
    });
  });

  describe('Core vs Ruleset Separation', () => {
    it('should ensure core contracts do not contain narrative fields', () => {
      const contractWithNarrative = {
        ...validCoreContract,
        contract: {
          ...validCoreContract.contract,
          'scn.phases': ['setup', 'play', 'resolution']
        }
      };

      expect(() => CoreContractV2Schema.parse(contractWithNarrative)).toThrow();
    });

    it('should ensure rulesets contain narrative fields', () => {
      const rulesetWithoutNarrative = {
        ruleset: {
          name: 'Test Ruleset',
          defaults: {
            txt_sentences_min: 2,
            txt_sentences_max: 6
          }
          // Missing narrative fields
        }
      };

      expect(() => CoreRulesetV1Schema.parse(rulesetWithoutNarrative)).toThrow();
    });
  });

  describe('Schema Integration', () => {
    it('should validate both schemas independently', () => {
      const coreContract = CoreContractV2Schema.parse(validCoreContract);
      const ruleset = CoreRulesetV1Schema.parse(validRuleset);

      expect(coreContract).toBeDefined();
      expect(ruleset).toBeDefined();
    });

    it('should ensure proper separation of concerns', () => {
      // Core contract should only contain framework concerns
      const coreContract = CoreContractV2Schema.parse(validCoreContract);
      expect(coreContract.contract).toBeDefined();
      expect(coreContract.core).toBeDefined();
      expect(coreContract.core.acts_catalog).toBeDefined();
      expect(coreContract.core.scales).toBeDefined();

      // Ruleset should only contain narrative/pacing concerns
      const ruleset = CoreRulesetV1Schema.parse(validRuleset);
      expect(ruleset.ruleset['scn.phases']).toBeDefined();
      expect(ruleset.ruleset['txt.policy']).toBeDefined();
      expect(ruleset.ruleset['choices.policy']).toBeDefined();
      expect(ruleset.ruleset.defaults).toBeDefined();
    });
  });
});
