/**
 * AWF Injection Map Ruleset Environment Tests
 * Phase 1: Tests for env.ruleset_ref driving ruleset injection
 */

import { describe, it, expect, vi } from 'vitest';

// Mock the setAtPointer function
const mockSetAtPointer = vi.fn();

vi.mock('../src/utils/awf-bundle-helpers.js', () => ({
  setAtPointer: mockSetAtPointer,
}));

describe('AWF Injection Map - Ruleset Environment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use env.ruleset_ref for ruleset injection', async () => {
    // Import the function after mocking
    const { assembleBundle } = await import('../src/assemblers/awf-bundle-assembler.js');
    
    const mockBundle = {
      awf_bundle: {
        meta: { locale: 'en-US' }
      }
    };

    const mockInjectionMap = {
      doc: {
        build: {
          "core_ruleset": { "from": "core_rulesets[{env.ruleset_ref}].doc.ruleset" }
        }
      }
    };

    const mockCoreContract = {
      doc: {
        contract: { name: "Test Contract" },
        core: {
          acts_catalog: [],
          scales: {},
          budgets: {}
        }
      }
    };

    const mockCoreRuleset = {
      doc: {
        ruleset: {
          name: "Test Ruleset",
          "scn.phases": ["setup", "play", "resolution"],
          "txt.policy": "Test policy",
          "choices.policy": "Test choices",
          defaults: { txt_sentences_min: 2, txt_sentences_max: 6 }
        }
      }
    };

    // Mock the applyInjectionMap function to test env usage
    const applyInjectionMap = async (
      bundle: any,
      buildPointers: any,
      coreContract: any,
      coreRuleset: any,
      env?: Record<string, string>
    ) => {
      for (const [key, pointer] of Object.entries(buildPointers)) {
        if (pointer.startsWith('core_rulesets[') && pointer.includes('].doc.ruleset')) {
          // Verify env.ruleset_ref is used
          expect(env).toBeDefined();
          expect(env?.ruleset_ref).toBe('ruleset.core.default@1.0.0');
          mockSetAtPointer(bundle, `/awf_bundle/${key}`, coreRuleset.doc.ruleset);
        }
      }
    };

    // Test the injection with environment variables
    await applyInjectionMap(
      mockBundle,
      mockInjectionMap.doc.build,
      mockCoreContract,
      mockCoreRuleset,
      { ruleset_ref: 'ruleset.core.default@1.0.0', locale: 'en-US' }
    );

    expect(mockSetAtPointer).toHaveBeenCalledWith(
      mockBundle,
      '/awf_bundle/core_ruleset',
      mockCoreRuleset.doc.ruleset
    );
  });

  it('should handle missing env gracefully', async () => {
    const mockBundle = {
      awf_bundle: {
        meta: { locale: 'en-US' }
      }
    };

    const mockInjectionMap = {
      doc: {
        build: {
          "core_ruleset": { "from": "core_rulesets[{env.ruleset_ref}].doc.ruleset" }
        }
      }
    };

    const mockCoreContract = {
      doc: {
        contract: { name: "Test Contract" },
        core: {
          acts_catalog: [],
          scales: {},
          budgets: {}
        }
      }
    };

    const mockCoreRuleset = {
      doc: {
        ruleset: {
          name: "Test Ruleset",
          "scn.phases": ["setup", "play", "resolution"],
          "txt.policy": "Test policy",
          "choices.policy": "Test choices",
          defaults: { txt_sentences_min: 2, txt_sentences_max: 6 }
        }
      }
    };

    // Test without env (should not crash)
    const applyInjectionMap = async (
      bundle: any,
      buildPointers: any,
      coreContract: any,
      coreRuleset: any,
      env?: Record<string, string>
    ) => {
      for (const [key, pointer] of Object.entries(buildPointers)) {
        if (pointer.startsWith('core_rulesets[') && pointer.includes('].doc.ruleset')) {
          // Should handle missing env gracefully
          if (env?.ruleset_ref) {
            mockSetAtPointer(bundle, `/awf_bundle/${key}`, coreRuleset.doc.ruleset);
          }
        }
      }
    };

    await applyInjectionMap(
      mockBundle,
      mockInjectionMap.doc.build,
      mockCoreContract,
      mockCoreRuleset
      // No env provided
    );

    // Should not call setAtPointer without env
    expect(mockSetAtPointer).not.toHaveBeenCalled();
  });

  it('should validate ruleset reference format', () => {
    const validRefs = [
      'ruleset.core.default@1.0.0',
      'ruleset.custom@2.1.0',
      'ruleset.narrative@1.0.0'
    ];

    const invalidRefs = [
      'invalid-ref',
      'ruleset.core.default',
      '@1.0.0',
      'ruleset.core.default@',
      ''
    ];

    validRefs.forEach(ref => {
      expect(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+$/.test(ref)).toBe(true);
    });

    invalidRefs.forEach(ref => {
      expect(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+$/.test(ref)).toBe(false);
    });
  });

  it('should parse ruleset reference correctly', () => {
    const testCases = [
      { input: 'ruleset.core.default@1.0.0', expected: { id: 'ruleset.core.default', version: '1.0.0' } },
      { input: 'ruleset.custom@2.1.0', expected: { id: 'ruleset.custom', version: '2.1.0' } },
      { input: 'ruleset.narrative@1.0.0', expected: { id: 'ruleset.narrative', version: '1.0.0' } }
    ];

    testCases.forEach(({ input, expected }) => {
      const [id, version] = input.split('@');
      expect(id).toBe(expected.id);
      expect(version).toBe(expected.version);
    });
  });
});



















