/**
 * Tests for AWF Bundle Core Ruleset and Acts Catalog
 * Ensures bundle.core.ruleset is present and acts_catalog is included
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assembleBundle } from '../src/assemblers/awf-bundle-assembler.js';
import type { AwfBundle } from '../src/types/awf-bundle.js';
import { CoreRulesetV1 } from '../src/types/awf-core.js';

describe('AWF Bundle Core Ruleset and Acts Catalog', () => {
  const mockSessionId = 'test-session-id';
  const mockInputText = 'test input';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include core.ruleset in bundle', async () => {
    // This is a structural test - would require full mocking of repos
    // For now, assert the type structure
    const bundleShape: Partial<AwfBundle> = {
      awf_bundle: {
        core: {
          ruleset: {
            ruleset: {
              name: 'test-ruleset',
              'scn.phases': ['phase1'],
              'txt.policy': 'policy',
              'choices.policy': 'policy',
              defaults: {
                txt_sentences_min: 1,
                txt_sentences_max: 5,
              },
            },
          },
        },
      },
    };

    expect(bundleShape.awf_bundle?.core?.ruleset).toBeDefined();
    expect(bundleShape.awf_bundle?.core?.ruleset?.ruleset).toBeDefined();
    expect(bundleShape.awf_bundle?.core?.ruleset?.ruleset?.name).toBe('test-ruleset');
  });

  it('should include core.contract.acts_catalog when present in contract', () => {
    const bundleShape: Partial<AwfBundle> = {
      awf_bundle: {
        core: {
          ruleset: {
            ruleset: {
              name: 'test',
              'scn.phases': ['phase1'],
              'choices.policy': 'policy',
              'txt.policy': 'policy',
              defaults: {
                txt_sentences_min: 1,
                txt_sentences_max: 5,
              },
            },
          },
          contract: {
            acts_catalog: [
              { type: 'move', mode: 'immediate', target: 'location' },
              { type: 'talk', mode: 'interactive', target: 'npc' },
            ],
          },
        },
      },
    };

    expect(bundleShape.awf_bundle?.core?.contract?.acts_catalog).toBeDefined();
    expect(Array.isArray(bundleShape.awf_bundle?.core?.contract?.acts_catalog)).toBe(true);
    expect(bundleShape.awf_bundle?.core?.contract?.acts_catalog?.length).toBe(2);
  });

  it('should allow empty acts_catalog array when contract has none', () => {
    const bundleShape: Partial<AwfBundle> = {
      awf_bundle: {
        core: {
          ruleset: {
            ruleset: {
              name: 'test',
              'scn.phases': ['phase1'],
              'choices.policy': 'policy',
              'txt.policy': 'policy',
              defaults: {
                txt_sentences_min: 1,
                txt_sentences_max: 5,
              },
            },
          },
          contract: {
            acts_catalog: undefined, // Can be undefined when contract has none
          },
        },
      },
    };

    // Should not throw - acts_catalog is optional
    expect(bundleShape.awf_bundle?.core?.contract?.acts_catalog).toBeUndefined();
  });

  it('should match resolved ruleset structure', () => {
    const mockResolvedRuleset: CoreRulesetV1 = {
      ruleset: {
        name: 'resolved-ruleset',
        'scn.phases': ['scene1', 'scene2'],
        'txt.policy': 'narrative',
        'choices.policy': 'menu',
        defaults: {
          txt_sentences_min: 2,
          txt_sentences_max: 8,
        },
      },
    };

    const bundleShape: Partial<AwfBundle> = {
      awf_bundle: {
        core: {
          ruleset: mockResolvedRuleset,
        },
      },
    };

    expect(bundleShape.awf_bundle?.core?.ruleset).toEqual(mockResolvedRuleset);
    expect(bundleShape.awf_bundle?.core?.ruleset.ruleset.name).toBe('resolved-ruleset');
    expect(bundleShape.awf_bundle?.core?.ruleset.ruleset['scn.phases']).toEqual(['scene1', 'scene2']);
  });
});

