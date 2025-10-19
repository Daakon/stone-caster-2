/**
 * Unit tests for AWF Output Validator
 * Phase 5: Turn Pipeline Integration - Testing output validation logic
 */

import { describe, it, expect } from 'vitest';
import { 
  validateAwfOutput, 
  hasCorrectTopLevelStructure, 
  extractAwfFromOutput 
} from '../src/validators/awf-output-validator.js';

describe('AWF Output Validator', () => {
  describe('validateAwfOutput', () => {
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
      expect(result.repairHint).toBeUndefined();
    });

    it('should validate minimal AWF output', () => {
      const minimalAwf = {
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.'
      };

      const result = validateAwfOutput(minimalAwf);

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
      expect(result.errors).toContainEqual({
        field: 'AWF.scn',
        message: 'scn field is required and must be a string',
        expected: 'string',
        actual: 'undefined'
      });
    });

    it('should reject wrong data types', () => {
      const invalidAwf = {
        scn: 123, // Should be string
        txt: 'You enter a peaceful forest clearing.'
      };

      const result = validateAwfOutput(invalidAwf);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'AWF.scn',
        message: 'scn field is required and must be a string',
        expected: 'string',
        actual: 'number'
      });
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
      expect(result.errors).toContainEqual({
        field: 'AWF.choices',
        message: 'choices array must have at most 5 items',
        expected: '<= 5',
        actual: 6
      });
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
      expect(result.errors).toContainEqual({
        field: 'AWF.acts',
        message: 'acts array must have at most 8 items',
        expected: '<= 8',
        actual: 9
      });
    });

    it('should validate choice structure', () => {
      const invalidAwf = {
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.',
        choices: [
          { id: 'explore', label: 'Explore the area' },
          { id: 'rest' } // Missing label
        ]
      };

      const result = validateAwfOutput(invalidAwf);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'AWF.choices[1].label',
        message: 'Choice label is required and must be a string',
        expected: 'string',
        actual: 'undefined'
      });
    });

    it('should validate act structure', () => {
      const invalidAwf = {
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.',
        acts: [
          { type: 'SCENE_SET' }, // Missing data
          { data: { scn: 'forest' } } // Missing type
        ]
      };

      const result = validateAwfOutput(invalidAwf);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'AWF.acts[0].data',
        message: 'Act data is required and must be an object',
        expected: 'object',
        actual: 'undefined'
      });
      expect(result.errors).toContainEqual({
        field: 'AWF.acts[1].type',
        message: 'Act type is required and must be a string',
        expected: 'string',
        actual: 'undefined'
      });
    });

    it('should reject extra keys', () => {
      const invalidAwf = {
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.',
        extraKey: 'not allowed',
        anotherKey: 123
      };

      const result = validateAwfOutput(invalidAwf);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'AWF',
        message: 'Extra keys not allowed: extraKey, anotherKey',
        expected: 'only scn, txt, choices, acts, val',
        actual: 'also extraKey, anotherKey'
      });
    });

    it('should validate val field type', () => {
      const invalidAwf = {
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.',
        val: 123 // Should be string
      };

      const result = validateAwfOutput(invalidAwf);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'AWF.val',
        message: 'val must be a string if provided',
        expected: 'string',
        actual: 'number'
      });
    });

    it('should generate repair hint for validation failures', () => {
      const invalidAwf = {
        txt: 'You enter a peaceful forest clearing.'
        // Missing scn
      };

      const result = validateAwfOutput(invalidAwf);

      expect(result.isValid).toBe(false);
      expect(result.repairHint).toBeDefined();
      expect(result.repairHint).toContain('Include all required fields');
    });
  });

  describe('hasCorrectTopLevelStructure', () => {
    it('should return true for correct top-level structure', () => {
      const output = {
        AWF: {
          scn: 'forest_clearing',
          txt: 'You enter a peaceful forest clearing.'
        }
      };

      expect(hasCorrectTopLevelStructure(output)).toBe(true);
    });

    it('should return false for missing AWF key', () => {
      const output = {
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.'
      };

      expect(hasCorrectTopLevelStructure(output)).toBe(false);
    });

    it('should return false for non-object AWF', () => {
      const output = {
        AWF: 'not an object'
      };

      expect(hasCorrectTopLevelStructure(output)).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(hasCorrectTopLevelStructure(null)).toBe(false);
      expect(hasCorrectTopLevelStructure(undefined)).toBe(false);
    });
  });

  describe('extractAwfFromOutput', () => {
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

    it('should return null for missing required fields', () => {
      const output = {
        AWF: {
          txt: 'You enter a peaceful forest clearing.'
          // Missing scn
        }
      };

      const result = extractAwfFromOutput(output);

      expect(result).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty choices array', () => {
      const awf = {
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.',
        choices: []
      };

      const result = validateAwfOutput(awf);

      expect(result.isValid).toBe(true);
    });

    it('should handle empty acts array', () => {
      const awf = {
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.',
        acts: []
      };

      const result = validateAwfOutput(awf);

      expect(result.isValid).toBe(true);
    });

    it('should handle undefined choices and acts', () => {
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

      expect(result.isValid).toBe(true);
    });

    it('should handle undefined val field', () => {
      const awf = {
        scn: 'forest_clearing',
        txt: 'You enter a peaceful forest clearing.'
        // val is undefined (optional)
      };

      const result = validateAwfOutput(awf);

      expect(result.isValid).toBe(true);
    });
  });
});


