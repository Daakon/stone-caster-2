/**
 * Schema Validation Tests
 * Validates that RulesetDefinition Zod schemas correctly validate mock ruleset data
 * 
 * Note: This test uses Jest as requested. If Jest is not installed, you may need to:
 * - Install Jest: npm install --save-dev jest @types/jest ts-jest
 * - Configure Jest for TypeScript (jest.config.js or package.json)
 * - Or adapt to use Vitest (which is already configured in this project)
 * 
 * Jest globals (describe, it, expect) are available when Jest is properly configured.
 * For ESM projects, you may need: import { describe, it, expect } from '@jest/globals';
 */
import { RulesetDefinitionSchema } from '../types/chimera-authoring';
import type { RulesetDefinition } from '../types/chimera-authoring';

describe('RulesetDefinition Schema Validation', () => {
  describe('rs_d100_core (Foundation ruleset)', () => {
    it('should validate a foundation ruleset with exclusion_group', () => {
      const mockD100Core: RulesetDefinition = {
        id: 'rs_d100_core',
        name: 'D100 Core System',
        ui_category: 'foundation',
        exclusion_group: 'skill_engine',
        dependencies: [],
        provides_tags: ['d100', 'skill_based', 'core'],
        state_contributions: {
          skills: {
            type: 'object',
            properties: {
              combat: { type: 'number', min: 0, max: 100 },
              stealth: { type: 'number', min: 0, max: 100 },
              social: { type: 'number', min: 0, max: 100 },
            },
          },
          hp: {
            type: 'number',
            min: 0,
          },
        },
        actions: {
          skill_check: {
            type: 'action',
            description: 'Perform a skill check using d100',
            parameters: {
              skill: { type: 'string' },
              difficulty: { type: 'number', min: 1, max: 100 },
            },
          },
        },
        ai_instructions: {
          narrative_style: 'realistic',
          difficulty_guidance: 'Use difficulty 50 as average, 75 as hard, 90 as very hard',
        },
      };

      const result = RulesetDefinitionSchema.safeParse(mockD100Core);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('rs_d100_core');
        expect(result.data.ui_category).toBe('foundation');
        expect(result.data.exclusion_group).toBe('skill_engine');
        expect(result.data.dependencies).toEqual([]);
        expect(result.data.provides_tags).toContain('d100');
        expect(result.data.state_contributions).toHaveProperty('skills');
        expect(result.data.state_contributions).toHaveProperty('hp');
        expect(result.data.actions).toHaveProperty('skill_check');
      }
    });
  });

  describe('rs_health_simple (Expansion ruleset)', () => {
    it('should validate an expansion ruleset with actions defined', () => {
      const mockHealthSimple: RulesetDefinition = {
        id: 'rs_health_simple',
        name: 'Simple Health System',
        ui_category: 'expansion',
        exclusion_group: null,
        dependencies: ['rs_d100_core'],
        provides_tags: ['health', 'combat'],
        state_contributions: {
          current_hp: {
            type: 'number',
            min: 0,
          },
          max_hp: {
            type: 'number',
            min: 1,
          },
          status_effects: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
        actions: {
          take_damage: {
            type: 'action',
            description: 'Apply damage to the character',
            parameters: {
              amount: { type: 'number', min: 0 },
              source: { type: 'string', optional: true },
            },
            effects: {
              current_hp: { operation: 'subtract', field: 'amount' },
            },
          },
          heal: {
            type: 'action',
            description: 'Restore health points',
            parameters: {
              amount: { type: 'number', min: 0 },
            },
            effects: {
              current_hp: { operation: 'add', field: 'amount', cap: 'max_hp' },
            },
          },
          apply_status: {
            type: 'action',
            description: 'Apply a status effect',
            parameters: {
              effect: { type: 'string' },
              duration: { type: 'number', min: 1, optional: true },
            },
            effects: {
              status_effects: { operation: 'append', field: 'effect' },
            },
          },
        },
        ai_instructions: {
          damage_narrative: 'Describe injuries realistically but not graphically',
          healing_narrative: 'Describe recovery as gradual and natural',
        },
      };

      const result = RulesetDefinitionSchema.safeParse(mockHealthSimple);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('rs_health_simple');
        expect(result.data.ui_category).toBe('expansion');
        expect(result.data.exclusion_group).toBeNull();
        expect(result.data.dependencies).toContain('rs_d100_core');
        expect(result.data.provides_tags).toContain('health');
        expect(result.data.provides_tags).toContain('combat');
        expect(result.data.state_contributions).toHaveProperty('current_hp');
        expect(result.data.state_contributions).toHaveProperty('max_hp');
        expect(result.data.state_contributions).toHaveProperty('status_effects');
        expect(result.data.actions).toHaveProperty('take_damage');
        expect(result.data.actions).toHaveProperty('heal');
        expect(result.data.actions).toHaveProperty('apply_status');
        expect(Object.keys(result.data.actions).length).toBe(3);
      }
    });
  });

  describe('Schema edge cases', () => {
    it('should reject invalid ui_category', () => {
      const invalid = {
        id: 'rs_test',
        name: 'Test',
        ui_category: 'invalid_category', // Invalid
        exclusion_group: null,
        dependencies: [],
        provides_tags: [],
        state_contributions: {},
        actions: {},
        ai_instructions: {},
      };

      const result = RulesetDefinitionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should accept null exclusion_group', () => {
      const valid = {
        id: 'rs_test',
        name: 'Test',
        ui_category: 'flavor',
        exclusion_group: null,
        dependencies: [],
        provides_tags: [],
        state_contributions: {},
        actions: {},
        ai_instructions: {},
      };

      const result = RulesetDefinitionSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.exclusion_group).toBeNull();
      }
    });

    it('should accept empty arrays for dependencies and provides_tags', () => {
      const valid = {
        id: 'rs_test',
        name: 'Test',
        ui_category: 'foundation',
        exclusion_group: null,
        dependencies: [],
        provides_tags: [],
        state_contributions: {},
        actions: {},
        ai_instructions: {},
      };

      const result = RulesetDefinitionSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should accept complex nested state_contributions', () => {
      const valid = {
        id: 'rs_test',
        name: 'Test',
        ui_category: 'expansion',
        exclusion_group: null,
        dependencies: [],
        provides_tags: [],
        state_contributions: {
          inventory: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                quantity: { type: 'number' },
                metadata: { type: 'object' },
              },
            },
          },
          relationships: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                value: { type: 'number', min: -100, max: 100 },
                history: { type: 'array' },
              },
            },
          },
        },
        actions: {},
        ai_instructions: {},
      };

      const result = RulesetDefinitionSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.state_contributions).toHaveProperty('inventory');
        expect(result.data.state_contributions).toHaveProperty('relationships');
      }
    });
  });
});

