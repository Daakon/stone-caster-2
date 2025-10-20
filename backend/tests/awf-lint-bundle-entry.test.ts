import { describe, it, expect, beforeEach } from 'vitest';
import { AwfLinter } from '../src/authoring/awf-lint.js';

describe('Bundle Entry Validation', () => {
  let linter: AwfLinter;

  beforeEach(() => {
    // Create a custom linter with only bundle_entry_validation enabled
    linter = new AwfLinter({
      rules: {
        schema_validation: { enabled: false },
        tone_policy: { enabled: false },
        acts_budget: { enabled: false },
        first_turn_rules: { enabled: false },
        slice_coverage: { enabled: false },
        stable_ids: { enabled: false },
        time_bands: { enabled: false },
        npc_validation: { enabled: false },
        bundle_npc_validation: { enabled: false },
        scenario_validation: { enabled: false },
        bundle_scenario_validation: { enabled: false },
        world_validation: { enabled: false },
        adventure_validation: { enabled: false },
        bundle_world_adv_validation: { enabled: false },
        injection_map_validation: { enabled: false },
        bundle_injection_validation: { enabled: false },
        bundle_entry_validation: { enabled: true, severity: 'warning' }
      }
    });
  });

  it('should pass when scenario is present and public', () => {
    const doc = {
      awf_bundle: {
        meta: {
          scenario_ref: 'scenario.inn_last_ember@1.0.0',
          world_ref: 'world.mystika@1.0.0',
          adventure_ref: 'adventure.inn_tales@1.0.0'
        },
        scenario: {
          id: 'scenario.inn_last_ember',
          version: '1.0.0',
          is_public: true,
          scenario: {
            display_name: 'The Last Ember Inn',
            synopsis: 'A cozy inn where adventures begin'
          }
        },
        world: { name: 'Mystika' },
        adventure: { name: 'Inn Tales' },
        npcs: [],
        player: {}
      }
    };

    const issues = linter.lintDocument(doc, 'bundles/test.json');
    expect(issues.passed).toBe(true);
    expect(issues.issues.length).toBe(0);
  });

  it('should warn when scenario is missing from bundle', () => {
    const doc = {
      awf_bundle: {
        meta: {
          scenario_ref: 'scenario.inn_last_ember@1.0.0',
          world_ref: 'world.mystika@1.0.0'
        },
        world: { name: 'Mystika' },
        adventure: { name: 'Inn Tales' },
        npcs: [],
        player: {}
      }
    };

    const issues = linter.lintDocument(doc, 'bundles/test.json');
    expect(issues.passed).toBe(true); // warnings don't make it fail
    expect(issues.issues.length).toBe(1);
    expect(issues.issues[0].rule).toBe('bundle_entry_validation');
    expect(issues.issues[0].message).toContain('scenario field is missing');
  });

  it('should warn when scenario is private', () => {
    const doc = {
      awf_bundle: {
        meta: {
          scenario_ref: 'scenario.private@1.0.0',
          world_ref: 'world.mystika@1.0.0'
        },
        scenario: {
          id: 'scenario.private',
          version: '1.0.0',
          is_public: false,
          scenario: {
            display_name: 'Private Scenario',
            synopsis: 'A private scenario'
          }
        },
        world: { name: 'Mystika' },
        adventure: { name: 'Inn Tales' },
        npcs: [],
        player: {}
      }
    };

    const issues = linter.lintDocument(doc, 'bundles/test.json');
    expect(issues.passed).toBe(true); // warnings don't make it fail
    expect(issues.issues.length).toBe(1);
    expect(issues.issues[0].rule).toBe('bundle_entry_validation');
    expect(issues.issues[0].message).toContain('is marked as private');
  });

  it('should pass when no scenario_ref in meta', () => {
    const doc = {
      awf_bundle: {
        meta: {
          world_ref: 'world.mystika@1.0.0'
        },
        world: { name: 'Mystika' },
        adventure: { name: 'Inn Tales' },
        npcs: [],
        player: {}
      }
    };

    const issues = linter.lintDocument(doc, 'bundles/test.json');
    expect(issues.passed).toBe(true);
    expect(issues.issues.length).toBe(0);
  });

  it('should skip validation for non-bundle documents', () => {
    const doc = {
      world: {
        name: 'Mystika',
        description: 'A magical world'
      }
    };

    const issues = linter.lintDocument(doc, 'worlds/mystika.json');
    expect(issues.passed).toBe(true);
    expect(issues.issues.length).toBe(0);
  });

  it('should pass when scenario is public (is_public: true)', () => {
    const doc = {
      awf_bundle: {
        meta: {
          scenario_ref: 'scenario.inn_last_ember@1.0.0',
          world_ref: 'world.mystika@1.0.0'
        },
        scenario: {
          id: 'scenario.inn_last_ember',
          version: '1.0.0',
          is_public: true,
          scenario: {
            display_name: 'The Last Ember Inn',
            synopsis: 'A cozy inn where adventures begin'
          }
        },
        world: { name: 'Mystika' },
        adventure: { name: 'Inn Tales' },
        npcs: [],
        player: {}
      }
    };

    const issues = linter.lintDocument(doc, 'bundles/test.json');
    expect(issues.passed).toBe(true);
    expect(issues.issues.length).toBe(0);
  });

  it('should pass when scenario is public (is_public: undefined)', () => {
    const doc = {
      awf_bundle: {
        meta: {
          scenario_ref: 'scenario.inn_last_ember@1.0.0',
          world_ref: 'world.mystika@1.0.0'
        },
        scenario: {
          id: 'scenario.inn_last_ember',
          version: '1.0.0',
          scenario: {
            display_name: 'The Last Ember Inn',
            synopsis: 'A cozy inn where adventures begin'
          }
        },
        world: { name: 'Mystika' },
        adventure: { name: 'Inn Tales' },
        npcs: [],
        player: {}
      }
    };

    const issues = linter.lintDocument(doc, 'bundles/test.json');
    expect(issues.passed).toBe(true);
    expect(issues.issues.length).toBe(0);
  });
});
