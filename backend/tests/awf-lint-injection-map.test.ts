import { describe, it, expect } from 'vitest';
import { AwfLinter } from '../src/authoring/awf-lint.js';

describe('Injection Map Linter Rules', () => {
  const linter = new AwfLinter();

  describe('injection_map_validation', () => {
    it('should pass valid injection map', () => {
      const doc = {
        rules: [
          {
            from: '/world/name',
            to: '/awf_bundle/world/name'
          }
        ]
      };

      const result = linter.lintDocument(doc, 'injection-maps/valid.json');
      expect(result.passed).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should fail injection map without rules', () => {
      const doc = {
        // No rules field
      };

      const result = linter.lintDocument(doc, 'injection-maps/invalid.json');
      expect(result.passed).toBe(false);
      expect(result.errorCount).toBe(1);
      expect(result.issues[0].message).toContain('missing required rules array');
    });

    it('should fail injection map with empty rules array', () => {
      const doc = {
        rules: []
      };

      const result = linter.lintDocument(doc, 'injection-maps/empty.json');
      expect(result.passed).toBe(false);
      expect(result.errorCount).toBe(1);
    });

    it('should fail rule without from field', () => {
      const doc = {
        rules: [
          {
            to: '/awf_bundle/world/name'
          }
        ]
      };

      const result = linter.lintDocument(doc, 'injection-maps/no-from.json');
      expect(result.passed).toBe(false);
      expect(result.errorCount).toBe(1);
      expect(result.issues[0].message).toContain("missing required 'from' field");
    });

    it('should fail rule without to field', () => {
      const doc = {
        rules: [
          {
            from: '/world/name'
          }
        ]
      };

      const result = linter.lintDocument(doc, 'injection-maps/no-to.json');
      expect(result.passed).toBe(false);
      expect(result.errorCount).toBe(1);
      expect(result.issues[0].message).toContain("missing required 'to' field");
    });

    it('should fail rule with invalid to field (not absolute pointer)', () => {
      const doc = {
        rules: [
          {
            from: '/world/name',
            to: 'world/name' // Missing leading slash
          }
        ]
      };

      const result = linter.lintDocument(doc, 'injection-maps/invalid-to.json');
      expect(result.passed).toBe(false);
      expect(result.errorCount).toBe(1);
      expect(result.issues[0].message).toContain('must be absolute JSON pointer');
    });

    it('should fail rule with invalid limit units', () => {
      const doc = {
        rules: [
          {
            from: '/world/name',
            to: '/awf_bundle/world/name',
            limit: { units: 'invalid', max: 100 }
          }
        ]
      };

      const result = linter.lintDocument(doc, 'injection-maps/invalid-limit-units.json');
      expect(result.passed).toBe(false);
      expect(result.errorCount).toBe(1);
      expect(result.issues[0].message).toContain('limit.units must be');
    });

    it('should fail rule with invalid limit max', () => {
      const doc = {
        rules: [
          {
            from: '/world/name',
            to: '/awf_bundle/world/name',
            limit: { units: 'tokens', max: -1 }
          }
        ]
      };

      const result = linter.lintDocument(doc, 'injection-maps/invalid-limit-max.json');
      expect(result.passed).toBe(false);
      expect(result.errorCount).toBe(1);
      expect(result.issues[0].message).toContain('limit.max must be positive number');
    });
  });

  describe('bundle_injection_validation', () => {
    it('should pass valid bundle with all required roots', () => {
      const doc = {
        awf_bundle: {
          meta: { engine_version: '1.0.0' },
          contract: { id: 'contract1' },
          world: { id: 'world1', name: 'Test World' },
          adventure: { id: 'adv1', name: 'Test Adventure' },
          npcs: { active: [], count: 0 },
          player: { id: 'player1', name: 'Test Player' }
        }
      };

      const result = linter.lintDocument(doc, 'bundles/valid.json');
      expect(result.passed).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should warn about missing required bundle roots', () => {
      const doc = {
        awf_bundle: {
          meta: { engine_version: '1.0.0' },
          contract: { id: 'contract1' }
          // Missing world, adventure, npcs, player
        }
      };

      const result = linter.lintDocument(doc, 'bundles/incomplete.json');
      expect(result.passed).toBe(true); // Warnings don't fail the linter
      expect(result.warningCount).toBeGreaterThan(0);
    });
  });
});
