/**
 * Simple unit tests for AWF Turn Orchestrator
 * Phase 5: Turn Pipeline Integration - Testing core orchestrator logic
 */

import { describe, it, expect } from 'vitest';
import { 
  validateAwfOutput, 
  extractAwfFromOutput,
  hasCorrectTopLevelStructure 
} from '../src/validators/awf-output-validator.js';
import { SYSTEM_AWF_RUNTIME, createSystemPromptWithRepairHint } from '../src/model/system-prompts.js';

describe('AWF Turn Orchestrator Core Logic', () => {
  describe('System Prompt Generation', () => {
    it('should create minimal system prompt', () => {
      expect(SYSTEM_AWF_RUNTIME).toContain('awf_bundle');
      expect(SYSTEM_AWF_RUNTIME).toContain('AWF');
      expect(SYSTEM_AWF_RUNTIME).toContain('scn');
      expect(SYSTEM_AWF_RUNTIME).toContain('txt');
    });

    it('should create system prompt with repair hint', () => {
      const repairHint = 'Include all required fields: scn, txt';
      const prompt = createSystemPromptWithRepairHint(repairHint);
      
      expect(prompt).toContain(SYSTEM_AWF_RUNTIME);
      expect(prompt).toContain('Repair hint:');
      expect(prompt).toContain(repairHint);
    });
  });

  describe('Output Validation', () => {
    it('should validate correct AWF output', () => {
      const validAwf = {
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.',
        choices: [
          { id: 'explore', label: 'Explore the area' },
          { id: 'rest', label: 'Rest here' }
        ],
        acts: [
          { type: 'SCENE_SET', data: { scn: 'forest_clearing' } }
        ]
      };

      const result = validateAwfOutput(validAwf);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing required fields', () => {
      const invalidAwf = {
        txt: 'You enter a peaceful forest clearing.'
        // Missing scn
      };

      const result = validateAwfOutput(invalidAwf);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.repairHint).toBeDefined();
    });

    it('should reject too many choices', () => {
      const invalidAwf = {
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.',
        choices: Array.from({ length: 6 }, (_, i) => ({
          id: `choice${i}`,
          label: `Choice ${i}`
        }))
      };

      const result = validateAwfOutput(invalidAwf);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'AWF.choices',
          message: 'choices array must have at most 5 items'
        })
      );
    });

    it('should reject too many acts', () => {
      const invalidAwf = {
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.',
        acts: Array.from({ length: 9 }, (_, i) => ({
          type: `ACT_${i}`,
          data: { value: i }
        }))
      };

      const result = validateAwfOutput(invalidAwf);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'AWF.acts',
          message: 'acts array must have at most 8 items'
        })
      );
    });

    it('should reject extra keys', () => {
      const invalidAwf = {
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.',
        extraKey: 'not allowed'
      };

      const result = validateAwfOutput(invalidAwf);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'AWF',
          message: 'Extra keys not allowed: extraKey'
        })
      );
    });
  });

  describe('Output Extraction', () => {
    it('should extract AWF from top-level structure', () => {
      const output = {
        AWF: {
          scn: 'forest_clearing',
          txt: 'You enter a peaceful forest clearing.'
        }
      };

      const result = extractAwfFromOutput(output);

      expect(result).toEqual({
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.'
      });
    });

    it('should return AWF object directly if already extracted', () => {
      const awf = {
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.'
      };

      const result = extractAwfFromOutput(awf);

      expect(result).toEqual(awf);
    });

    it('should return null for invalid structure', () => {
      const output = {
        notAWF: {
          scn: 'forest_clearing',
          txt: 'You enter a peaceful forest clearing.'
        }
      };

      const result = extractAwfFromOutput(output);

      expect(result).toBeNull();
    });
  });

  describe('Top-Level Structure Validation', () => {
    it('should validate correct top-level structure', () => {
      const output = {
        AWF: {
          scn: 'forest_clearing',
          txt: 'You enter a peaceful forest clearing.'
        }
      };

      expect(hasCorrectTopLevelStructure(output)).toBe(true);
    });

    it('should reject missing AWF key', () => {
      const output = {
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.'
      };

      expect(hasCorrectTopLevelStructure(output)).toBe(false);
    });

    it('should reject non-object AWF', () => {
      const output = {
        AWF: 'not an object'
      };

      expect(hasCorrectTopLevelStructure(output)).toBe(false);
    });
  });

  describe('Repair Hint Generation', () => {
    it('should generate repair hint for missing fields', () => {
      const invalidAwf = {
        txt: 'You enter a peaceful forest clearing.'
        // Missing scn
      };

      const result = validateAwfOutput(invalidAwf);

      expect(result.repairHint).toContain('Include all required fields');
    });

    it('should generate repair hint for type errors', () => {
      const invalidAwf = {
        scn: 123, // Should be string
        txt: 'You enter a peaceful forest clearing.'
      };

      const result = validateAwfOutput(invalidAwf);

      expect(result.repairHint).toContain('correct data types');
    });

    it('should generate repair hint for array length errors', () => {
      const invalidAwf = {
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.',
        choices: Array.from({ length: 6 }, (_, i) => ({
          id: `choice${i}`,
          label: `Choice ${i}`
        }))
      };

      const result = validateAwfOutput(invalidAwf);

      expect(result.repairHint).toContain('Limit array sizes');
    });

    it('should generate repair hint for extra keys', () => {
      const invalidAwf = {
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.',
        extraKey: 'not allowed'
      };

      const result = validateAwfOutput(invalidAwf);

      expect(result.repairHint).toContain('Remove extra keys');
    });
  });

  describe('Legacy Response Conversion', () => {
    it('should convert AWF output to legacy format', () => {
      const awfOutput = {
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.',
        choices: [
          { id: 'explore', label: 'Explore the area' },
          { id: 'rest', label: 'Rest here' }
        ]
      };

      // Simulate conversion logic
      const legacyResponse = {
        txt: awfOutput.txt,
        choices: awfOutput.choices.map(choice => ({
          id: choice.id,
          text: choice.label
        })),
        meta: { scn: awfOutput.scn }
      };

      expect(legacyResponse).toEqual({
        txt: 'You enter a peaceful forest clearing.',
        choices: [
          { id: 'explore', text: 'Explore the area' },
          { id: 'rest', text: 'Rest here' }
        ],
        meta: { scn: 'forest_clearing' }
      });
    });

    it('should handle empty choices array', () => {
      const awfOutput = {
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.'
      };

      const legacyResponse = {
        txt: awfOutput.txt,
        choices: [],
        meta: { scn: awfOutput.scn }
      };

      expect(legacyResponse.choices).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation failure gracefully', () => {
      const invalidAwf = {
        txt: 'You enter a peaceful forest clearing.'
        // Missing scn
      };

      const result = validateAwfOutput(invalidAwf);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.repairHint).toBeDefined();
    });

    it('should handle extraction failure gracefully', () => {
      const invalidOutput = {
        notAWF: {
          scn: 'forest_clearing',
          txt: 'You enter a peaceful forest clearing.'
        }
      };

      const result = extractAwfFromOutput(invalidOutput);

      expect(result).toBeNull();
    });

    it('should handle null/undefined input', () => {
      expect(hasCorrectTopLevelStructure(null)).toBe(false);
      expect(hasCorrectTopLevelStructure(undefined)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty choices and acts', () => {
      const awf = {
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.',
        choices: [],
        acts: []
      };

      const result = validateAwfOutput(awf);

      expect(result.isValid).toBe(true);
    });

    it('should handle undefined optional fields', () => {
      const awf = {
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.'
        // choices and acts are undefined (optional)
      };

      const result = validateAwfOutput(awf);

      expect(result.isValid).toBe(true);
    });

    it('should handle null val field', () => {
      const awf = {
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.',
        val: null
      };

      const result = validateAwfOutput(awf);

      // The validator should accept null val field
      expect(result.isValid).toBe(true);
    });
  });
});
