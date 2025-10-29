/**
 * Tests for AWF Assembler Ruleset Injection
 * Phase 1: Core vs Rulesets Framework Split - Assembler tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { assembleBundle } from '../src/assemblers/awf-bundle-assembler.js';
import { CoreContractRecord } from '../src/types/awf-core-contract.js';
import { CoreRulesetRecord } from '../src/types/awf-core.js';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => ({
          data: null,
          error: null
        }))
      }))
    }))
  }))
};

// Mock repositories
const mockRepositories = {
  sessions: {
    getByIdVersion: vi.fn()
  },
  gameStates: {
    getByIdVersion: vi.fn()
  },
  coreContracts: {
    getActive: vi.fn()
  },
  coreRulesets: {
    getByIdVersion: vi.fn()
  },
  worlds: {
    getByIdVersion: vi.fn()
  },
  adventures: {
    getByIdVersion: vi.fn()
  },
  adventureStarts: {
    getByAdventureRef: vi.fn()
  },
  injectionMap: {
    getByIdVersion: vi.fn()
  }
};

// Mock repository factory
vi.mock('../src/repositories/awf-repository-factory.js', () => ({
  AWFRepositoryFactory: vi.fn(() => ({
    getAllRepositories: () => mockRepositories
  }))
}));

// Mock bundle helpers
vi.mock('../src/utils/awf-bundle-helpers.js', () => ({
  setAtPointer: vi.fn(),
  estimateTokens: vi.fn(() => 1000),
  generateRngSeed: vi.fn(() => 'test-seed'),
  selectSlices: vi.fn(() => []),
  filterActiveNpcs: vi.fn(() => []),
  calculateBundleMetrics: vi.fn(() => ({
    byteSize: 1000,
    estimatedTokens: 1000,
    npcCount: 0,
    sliceCount: 0,
    buildTime: 100
  })),
  validateBundleStructure: vi.fn(() => [])
}));

// Mock scene slice policy
vi.mock('../src/policies/scene-slice-policy.js', () => ({
  getSlicesForScene: vi.fn(() => []),
  getDefaultWorldSlices: vi.fn(() => []),
  getDefaultAdventureSlices: vi.fn(() => [])
}));

// Mock Supabase client creation
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}));

describe('AWF Assembler Ruleset Injection', () => {
  const mockSession = {
    session_id: 'test-session',
    player_id: 'test-player',
    world_ref: 'test-world',
    adventure_ref: 'test-adventure',
    turn_id: 1,
    is_first_turn: true,
    locale: 'en-US',
    meta: {
      ruleset_ref: 'core.default@1.0.0'
    }
  };

  const mockGameState = {
    session_id: 'test-session',
    hot: { scene: 'test-scene' },
    warm: { episodic: [], pins: [] },
    cold: {}
  };

  const mockCoreContract: CoreContractRecord = {
    id: 'core.default',
    version: '2.0.0',
    doc: {
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
    },
    hash: 'test-hash',
    active: true,
    created_at: '2025-01-29T00:00:00Z',
    updated_at: '2025-01-29T00:00:00Z'
  };

  const mockCoreRuleset: CoreRulesetRecord = {
    id: 'core.default',
    version: '1.0.0',
    doc: {
      ruleset: {
        name: 'Default Narrative & Pacing',
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
    },
    created_at: '2025-01-29T00:00:00Z',
    updated_at: '2025-01-29T00:00:00Z'
  };

  const mockWorld = {
    id: 'test-world',
    version: 'v1',
    doc: {
      id: 'test-world',
      name: 'Test World',
      version: 'v1'
    },
    hash: 'world-hash',
    created_at: '2025-01-29T00:00:00Z',
    updated_at: '2025-01-29T00:00:00Z'
  };

  const mockAdventure = {
    id: 'test-adventure',
    version: 'v1',
    doc: {
      id: 'test-adventure',
      name: 'Test Adventure',
      version: 'v1'
    },
    hash: 'adventure-hash',
    created_at: '2025-01-29T00:00:00Z',
    updated_at: '2025-01-29T00:00:00Z'
  };

  const mockInjectionMap = {
    id: 'default',
    doc: {
      build: {
        contract: 'core_contracts.active.doc.contract',
        acts_catalog: 'core_contracts.active.doc.core.acts_catalog',
        scales: 'core_contracts.active.doc.core.scales',
        budgets: 'core_contracts.active.doc.core.budgets',
        ruleset: 'core_rulesets[{session.meta.ruleset_ref}].doc.ruleset'
      }
    },
    created_at: '2025-01-29T00:00:00Z',
    updated_at: '2025-01-29T00:00:00Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockRepositories.sessions.getByIdVersion.mockResolvedValue(mockSession);
    mockRepositories.gameStates.getByIdVersion.mockResolvedValue(mockGameState);
    mockRepositories.coreContracts.getActive.mockResolvedValue(mockCoreContract);
    mockRepositories.coreRulesets.getByIdVersion.mockResolvedValue(mockCoreRuleset);
    mockRepositories.worlds.getByIdVersion.mockResolvedValue(mockWorld);
    mockRepositories.adventures.getByIdVersion.mockResolvedValue(mockAdventure);
    mockRepositories.adventureStarts.getByAdventureRef.mockResolvedValue(null);
    mockRepositories.injectionMap.getByIdVersion.mockResolvedValue(mockInjectionMap);
  });

  describe('Bundle Assembly with Ruleset Injection', () => {
    it('should inject both core contract and ruleset into bundle', async () => {
      const result = await assembleBundle({
        sessionId: 'test-session',
        inputText: 'Test input'
      });

      expect(result.bundle).toBeDefined();
      expect(result.metrics).toBeDefined();
      
      // Verify that core contract and ruleset were loaded
      expect(mockRepositories.coreContracts.getActive).toHaveBeenCalledWith('default');
      expect(mockRepositories.coreRulesets.getByIdVersion).toHaveBeenCalledWith('core.default', '1.0.0');
    });

    it('should default to ruleset.core.default@1.0.0 when ruleset_ref is missing', async () => {
      const sessionWithoutRuleset = {
        ...mockSession,
        meta: {}
      };
      mockRepositories.sessions.getByIdVersion.mockResolvedValue(sessionWithoutRuleset);

      await assembleBundle({
        sessionId: 'test-session',
        inputText: 'Test input'
      });

      // Should default to ruleset.core.default@1.0.0
      expect(mockRepositories.coreRulesets.getByIdVersion).toHaveBeenCalledWith('ruleset.core.default', '1.0.0');
    });

    it('should throw error when core contract not found', async () => {
      mockRepositories.coreContracts.getActive.mockResolvedValue(null);

      await expect(assembleBundle({
        sessionId: 'test-session',
        inputText: 'Test input'
      })).rejects.toThrow('No active core contract found');
    });

    it('should throw error when ruleset not found', async () => {
      mockRepositories.coreRulesets.getByIdVersion.mockResolvedValue(null);

      await expect(assembleBundle({
        sessionId: 'test-session',
        inputText: 'Test input'
      })).rejects.toThrow('Core ruleset core.default@1.0.0 not found');
    });

    it('should handle ruleset_ref with custom ruleset', async () => {
      const sessionWithCustomRuleset = {
        ...mockSession,
        meta: {
          ruleset_ref: 'custom.ruleset@2.0.0'
        }
      };
      mockRepositories.sessions.getByIdVersion.mockResolvedValue(sessionWithCustomRuleset);

      await assembleBundle({
        sessionId: 'test-session',
        inputText: 'Test input'
      });

      // Should use custom ruleset
      expect(mockRepositories.coreRulesets.getByIdVersion).toHaveBeenCalledWith('custom.ruleset', '2.0.0');
    });
  });

  describe('Injection Map Application', () => {
    it('should apply injection map with both core and ruleset pointers', async () => {
      const { setAtPointer } = await import('../src/utils/awf-bundle-helpers.js');
      
      await assembleBundle({
        sessionId: 'test-session',
        inputText: 'Test input'
      });

      // Verify that injection map was applied with both core and ruleset
      expect(setAtPointer).toHaveBeenCalledWith(
        expect.any(Object),
        '/awf_bundle/contract',
        mockCoreContract.doc.contract
      );
      expect(setAtPointer).toHaveBeenCalledWith(
        expect.any(Object),
        '/awf_bundle/acts_catalog',
        mockCoreContract.doc.core.acts_catalog
      );
      expect(setAtPointer).toHaveBeenCalledWith(
        expect.any(Object),
        '/awf_bundle/scales',
        mockCoreContract.doc.core.scales
      );
      expect(setAtPointer).toHaveBeenCalledWith(
        expect.any(Object),
        '/awf_bundle/budgets',
        mockCoreContract.doc.core.budgets
      );
      expect(setAtPointer).toHaveBeenCalledWith(
        expect.any(Object),
        '/awf_bundle/ruleset',
        mockCoreRuleset.doc.ruleset
      );
    });
  });
});







