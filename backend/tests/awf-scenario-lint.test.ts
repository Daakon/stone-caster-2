/**
 * AWF Scenario Lint Tests
 * Tests for scenario validation in the linter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AwfLinter } from '../src/authoring/awf-lint.js';

describe('Scenario Lint Validation', () => {
  let linter: AwfLinter;

  beforeEach(() => {
    linter = new AwfLinter();
  });

  describe('scenario_validation rule', () => {
    it('should pass valid scenario document', () => {
      const doc = {
        world_ref: 'world.test@1.0.0',
        scenario: {
          display_name: 'Test Scenario',
          synopsis: 'A test scenario.',
          start_scene: 'test.scene',
          fixed_npcs: [
            { npc_ref: 'npc.test@1.0.0' }
          ],
          tags: ['test', 'scenario']
        }
      };

      const result = linter.lintDocument(doc, 'scenarios/test.json');
      
      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBe(0);
    });

    it('should fail on missing display_name', () => {
      const doc = {
        world_ref: 'world.test@1.0.0',
        scenario: {
          start_scene: 'test.scene'
        }
      };

      const result = linter.lintDocument(doc, 'scenarios/test.json');
      
      expect(result.errorCount).toBe(1);
      expect(result.issues[0].message).toContain('missing required display_name');
    });

    it('should fail on missing start_scene', () => {
      const doc = {
        world_ref: 'world.test@1.0.0',
        scenario: {
          display_name: 'Test Scenario'
        }
      };

      const result = linter.lintDocument(doc, 'scenarios/test.json');
      
      expect(result.errorCount).toBe(1);
      expect(result.issues[0].message).toContain('missing required start_scene');
    });

    it('should fail on display_name too long', () => {
      const doc = {
        world_ref: 'world.test@1.0.0',
        scenario: {
          display_name: 'A'.repeat(65),
          start_scene: 'test.scene'
        }
      };

      const result = linter.lintDocument(doc, 'scenarios/test.json');
      
      expect(result.errorCount).toBe(1);
      expect(result.issues[0].message).toContain('exceeds 64 characters');
    });

    it('should fail on synopsis too long', () => {
      const doc = {
        world_ref: 'world.test@1.0.0',
        scenario: {
          display_name: 'Test Scenario',
          synopsis: 'A'.repeat(161),
          start_scene: 'test.scene'
        }
      };

      const result = linter.lintDocument(doc, 'scenarios/test.json');
      
      expect(result.errorCount).toBe(1);
      expect(result.issues[0].message).toContain('exceeds 160 characters');
    });

    it('should fail on too many fixed_npcs', () => {
      const doc = {
        world_ref: 'world.test@1.0.0',
        scenario: {
          display_name: 'Test Scenario',
          start_scene: 'test.scene',
          fixed_npcs: Array(13).fill({ npc_ref: 'npc.test@1.0.0' })
        }
      };

      const result = linter.lintDocument(doc, 'scenarios/test.json');
      
      expect(result.errorCount).toBe(1);
      expect(result.issues[0].message).toContain('exceeds limit of 12');
    });

    it('should fail on too many starting_party', () => {
      const doc = {
        world_ref: 'world.test@1.0.0',
        scenario: {
          display_name: 'Test Scenario',
          start_scene: 'test.scene',
          starting_party: Array(7).fill({ npc_ref: 'npc.test@1.0.0' })
        }
      };

      const result = linter.lintDocument(doc, 'scenarios/test.json');
      
      expect(result.errorCount).toBe(1);
      expect(result.issues[0].message).toContain('exceeds limit of 6');
    });

    it('should skip validation for non-scenario documents', () => {
      const doc = {
        world_ref: 'world.test@1.0.0',
        adventure: {
          name: 'Test Adventure'
        }
      };

      const result = linter.lintDocument(doc, 'adventures/test.json');
      
      expect(result.errorCount).toBe(0);
    });
  });

  describe('bundle_scenario_validation rule', () => {
    it('should pass valid bundle scenario', () => {
      const doc = {
        awf_bundle: {
          scenario: {
            ref: 'scenario.test@1.0.0',
            name: 'Test Scenario',
            start_scene: 'test.scene',
            fixed_npcs: [
              { npc_ref: 'npc.test@1.0.0' }
            ]
          }
        }
      };

      const result = linter.lintDocument(doc, 'bundles/test.json');
      
      expect(result.errorCount).toBe(0);
    });

    it('should fail on missing scenario name', () => {
      const doc = {
        awf_bundle: {
          scenario: {
            start_scene: 'test.scene'
          }
        }
      };

      const result = linter.lintDocument(doc, 'bundles/test.json');
      
      expect(result.errorCount).toBe(1);
      expect(result.issues[0].message).toContain('missing name');
    });

    it('should fail on missing start_scene', () => {
      const doc = {
        awf_bundle: {
          scenario: {
            name: 'Test Scenario'
          }
        }
      };

      const result = linter.lintDocument(doc, 'bundles/test.json');
      
      expect(result.errorCount).toBe(1);
      expect(result.issues[0].message).toContain('missing start_scene');
    });

    it('should warn on too many fixed_npcs', () => {
      const doc = {
        awf_bundle: {
          scenario: {
            name: 'Test Scenario',
            start_scene: 'test.scene',
            fixed_npcs: Array(10).fill({ npc_ref: 'npc.test@1.0.0' })
          }
        }
      };

      const result = linter.lintDocument(doc, 'bundles/test.json');
      
      expect(result.warningCount).toBe(1);
      expect(result.issues[0].message).toContain('exceeds cap of 8');
    });

    it('should skip validation for non-bundle documents', () => {
      const doc = {
        scenario: {
          name: 'Test Scenario',
          start_scene: 'test.scene'
        }
      };

      const result = linter.lintDocument(doc, 'scenarios/test.json');
      
      expect(result.warningCount).toBe(0);
    });

    it('should skip validation when no scenario in bundle', () => {
      const doc = {
        awf_bundle: {
          world: {
            name: 'Test World'
          }
        }
      };

      const result = linter.lintDocument(doc, 'bundles/test.json');
      
      expect(result.warningCount).toBe(0);
    });
  });
});
