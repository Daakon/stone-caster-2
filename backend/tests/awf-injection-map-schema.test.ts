import { describe, it, expect } from 'vitest';
import { InjectionRuleV1Schema, InjectionMapDocV1Schema } from '../src/validators/awf-injection-map.schema.js';

describe('Injection Map Schema Validation', () => {
  describe('InjectionRuleV1Schema', () => {
    it('should validate a basic rule', () => {
      const rule = {
        from: '/world/name',
        to: '/awf_bundle/world/name'
      };
      
      const result = InjectionRuleV1Schema.parse(rule);
      expect(result).toEqual(rule);
    });

    it('should validate a rule with skipIfEmpty', () => {
      const rule = {
        from: '/scenario/name',
        to: '/awf_bundle/scenario/name',
        skipIfEmpty: true
      };
      
      const result = InjectionRuleV1Schema.parse(rule);
      expect(result).toEqual(rule);
    });

    it('should validate a rule with fallback', () => {
      const rule = {
        from: '/adventure/name',
        to: '/awf_bundle/adventure/name',
        fallback: { ifMissing: 'Unknown Adventure' }
      };
      
      const result = InjectionRuleV1Schema.parse(rule);
      expect(result).toEqual(rule);
    });

    it('should validate a rule with token limit', () => {
      const rule = {
        from: '/world/description',
        to: '/awf_bundle/world/description',
        limit: { units: 'tokens', max: 1000 }
      };
      
      const result = InjectionRuleV1Schema.parse(rule);
      expect(result).toEqual(rule);
    });

    it('should validate a rule with count limit', () => {
      const rule = {
        from: '/npcs/active',
        to: '/awf_bundle/npcs/active',
        limit: { units: 'count', max: 10 }
      };
      
      const result = InjectionRuleV1Schema.parse(rule);
      expect(result).toEqual(rule);
    });

    it('should validate a complete rule', () => {
      const rule = {
        from: '/world/name',
        to: '/awf_bundle/world/name',
        skipIfEmpty: true,
        fallback: { ifMissing: 'Unknown World' },
        limit: { units: 'tokens', max: 50 }
      };
      
      const result = InjectionRuleV1Schema.parse(rule);
      expect(result).toEqual(rule);
    });

    it('should reject rule without from field', () => {
      const rule = {
        to: '/awf_bundle/world/name'
      };
      
      expect(() => InjectionRuleV1Schema.parse(rule)).toThrow();
    });

    it('should reject rule without to field', () => {
      const rule = {
        from: '/world/name'
      };
      
      expect(() => InjectionRuleV1Schema.parse(rule)).toThrow();
    });

    it('should reject rule with invalid to field (not absolute pointer)', () => {
      const rule = {
        from: '/world/name',
        to: 'awf_bundle/world/name' // Missing leading slash
      };
      
      expect(() => InjectionRuleV1Schema.parse(rule)).toThrow();
    });

    it('should reject rule with invalid limit units', () => {
      const rule = {
        from: '/world/name',
        to: '/awf_bundle/world/name',
        limit: { units: 'invalid', max: 100 }
      };
      
      expect(() => InjectionRuleV1Schema.parse(rule)).toThrow();
    });

    it('should reject rule with invalid limit max', () => {
      const rule = {
        from: '/world/name',
        to: '/awf_bundle/world/name',
        limit: { units: 'tokens', max: -1 }
      };
      
      expect(() => InjectionRuleV1Schema.parse(rule)).toThrow();
    });

    it('should reject rule with limit max too high', () => {
      const rule = {
        from: '/world/name',
        to: '/awf_bundle/world/name',
        limit: { units: 'tokens', max: 100001 }
      };
      
      expect(() => InjectionRuleV1Schema.parse(rule)).toThrow();
    });
  });

  describe('InjectionMapDocV1Schema', () => {
    it('should validate a basic injection map', () => {
      const map = {
        rules: [
          {
            from: '/world/name',
            to: '/awf_bundle/world/name'
          }
        ]
      };
      
      const result = InjectionMapDocV1Schema.parse(map);
      expect(result).toEqual(map);
    });

    it('should validate an injection map with notes', () => {
      const map = {
        rules: [
          {
            from: '/world/name',
            to: '/awf_bundle/world/name'
          }
        ],
        notes: 'Default injection map for basic world data'
      };
      
      const result = InjectionMapDocV1Schema.parse(map);
      expect(result).toEqual(map);
    });

    it('should validate an injection map with multiple rules', () => {
      const map = {
        rules: [
          {
            from: '/world/name',
            to: '/awf_bundle/world/name'
          },
          {
            from: '/adventure/name',
            to: '/awf_bundle/adventure/name'
          },
          {
            from: '/npcs/active',
            to: '/awf_bundle/npcs/active',
            limit: { units: 'count', max: 10 }
          }
        ],
        notes: 'Comprehensive injection map'
      };
      
      const result = InjectionMapDocV1Schema.parse(map);
      expect(result).toEqual(map);
    });

    it('should reject injection map without rules', () => {
      const map = {
        notes: 'No rules'
      };
      
      expect(() => InjectionMapDocV1Schema.parse(map)).toThrow();
    });

    it('should reject injection map with empty rules array', () => {
      const map = {
        rules: []
      };
      
      expect(() => InjectionMapDocV1Schema.parse(map)).toThrow();
    });

    it('should reject injection map with invalid rules', () => {
      const map = {
        rules: [
          {
            from: '/world/name'
            // Missing 'to' field
          }
        ]
      };
      
      expect(() => InjectionMapDocV1Schema.parse(map)).toThrow();
    });

    it('should reject injection map with notes too long', () => {
      const map = {
        rules: [
          {
            from: '/world/name',
            to: '/awf_bundle/world/name'
          }
        ],
        notes: 'x'.repeat(2001) // Too long
      };
      
      expect(() => InjectionMapDocV1Schema.parse(map)).toThrow();
    });
  });
});
