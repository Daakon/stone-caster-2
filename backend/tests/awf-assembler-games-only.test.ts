/**
 * AWF Assembler Games-Only State Tests
 * Phase 1: Tests for assembler reading from games.state_snapshot.meta
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assembleBundle } from '../src/assemblers/awf-bundle-assembler.js';
import { AWFRepositoryFactory } from '../src/repositories/awf-repository-factory.js';

// Mock Supabase client and repositories
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  single: vi.fn(() => mockSupabase),
  order: vi.fn(() => mockSupabase),
};

const mockGame = {
  id: 'test-game-id',
  user_id: 'test-user-id',
  cookie_group_id: null,
  turn_count: 1,
  state_snapshot: {
    meta: {
      world_ref: 'world.mystika@1.0.0',
      adventure_ref: 'adv.whispercross@1.0.0',
      scenario_ref: 'scenario.inn_last_ember@1.0.0',
      ruleset_ref: 'ruleset.core.default@1.0.0',
      locale: 'en-US'
    },
    hot: { scene: 'start' },
    warm: { episodic: [], pins: [] },
    cold: {}
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockSession = {
  session_id: 'test-game-id',
  game_id: 'test-game-id',
  ruleset_ref: 'ruleset.session@2.0.0', // Override
  locale: 'es-ES', // Override
  turn_id: 1,
  is_first_turn: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockCoreContract = {
  id: 'core.default',
  version: '2.0.0',
  doc: {
    contract: {
      name: "StoneCaster Core Contract",
      awf_return: "Return exactly one JSON object named AWF with keys scn, txt, and optional choices, optional acts, optional val.",
      keys: { required: ["scn","txt"], optional: ["choices","acts","val"] },
      language: { one_language_only: true },
      time: { first_turn_time_advance_allowed: false, require_time_advance_on_nonfirst_turn: true, ticks_min_step: 1 },
      menus: { min: 1, max: 5, label_max_chars: 48 },
      validation: { policy: "No extra top-level keys; avoid nulls; compact values." }
    },
    core: {
      acts_catalog: [
        { type: "TIME_ADVANCE", mode: "add_number", target: "time.ticks" },
        { type: "SCENE_SET", mode: "set_value", target: "hot.scene" }
      ],
      scales: {
        skill: { min: 0, baseline: 50, max: 100 },
        relationship: { min: 0, baseline: 50, max: 100 }
      },
      budgets: { input_max_tokens: 6000, output_max_tokens: 1200 }
    }
  },
  hash: 'core-contract-hash',
  active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockCoreRuleset = {
  id: 'ruleset.core.default',
  version: '1.0.0',
  doc: {
    ruleset: {
      name: "Default Narrative & Pacing",
      "scn.phases": ["setup","play","resolution"],
      "txt.policy": "2–6 sentences, cinematic, second-person. No mechanics in txt; mechanics only in acts.",
      "choices.policy": "Only when a menu is available; 1–5 items; label ≤ 48 chars; include a stable id per item.",
      language: { one_language_only: true, use_meta_locale: true },
      mechanics_visibility: { no_mechanics_in_txt: true },
      safety: {
        consent_required_for_impactful_actions: true,
        offer_player_reaction_when_npc_initiates: true
      },
      token_discipline: {
        npcs_active_cap: 5,
        sim_nearby_token_cap: 260,
        mods_micro_slice_cap_per_namespace: 80,
        mods_micro_slice_cap_global: 200,
        episodic_cap: 60,
        episodic_note_max_chars: 120
      },
      time: { bands_cycle: ["Dawn","Mid-Day","Evening","Mid-Night"], ticks_per_band: 60 },
      menus: { min_choices: 1, max_choices: 5, label_max_chars: 48 },
      defaults: {
        txt_sentences_min: 2,
        txt_sentences_max: 6,
        time_ticks_min_step: 1,
        cooldowns: { dialogue_candidate_cooldown_turns: 1 }
      }
    }
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockWorld = {
  id: 'world.mystika',
  version: '1.0.0',
  doc: { id: 'world.mystika', name: 'Mystika', version: '1.0.0', slices: {} },
  hash: 'world-hash',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockAdventure = {
  id: 'adv.whispercross',
  version: '1.0.0',
  doc: { id: 'adv.whispercross', name: 'Whispercross', version: '1.0.0', slices: {} },
  hash: 'adventure-hash',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockInjectionMap = {
  id: 'default',
  doc: {
    build: {
      "contract": { "from": "core_contracts.active.doc.contract" },
      "core_acts_catalog": { "from": "core_contracts.active.doc.core.acts_catalog" },
      "core_scales": { "from": "core_contracts.active.doc.core.scales" },
      "core_budgets": { "from": "core_contracts.active.doc.core.budgets", "fallback": { "ifMissing": {"input_max_tokens":6000,"output_max_tokens":1200} }},
      "core_ruleset": { "from": "core_rulesets[{env.ruleset_ref}].doc.ruleset" }
    }
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockPlayer = {
  id: 'test-user-id',
  name: 'Test Player',
  traits: {},
  skills: {},
  inventory: [],
  metadata: {},
};

const mockNpcs = [];

vi.mock('../src/repositories/awf-repository-factory.js', () => ({
  AWFRepositoryFactory: vi.fn(() => ({
    getAllRepositories: vi.fn(() => ({
      games: {
        getById: vi.fn(async (gameId: string) => {
          if (gameId === mockGame.id) {
            return mockGame;
          }
          return null;
        }),
      },
      sessions: {
        getByIdVersion: vi.fn(async (sessionId: string) => {
          if (sessionId === mockSession.session_id) {
            return mockSession;
          }
          return null;
        }),
      },
      coreContracts: {
        getActive: vi.fn(async (id: string) => {
          if (id === 'default') {
            return mockCoreContract;
          }
          return null;
        }),
      },
      coreRulesets: {
        getByIdVersion: vi.fn(async (id: string, version: string) => {
          if (id === 'ruleset.core.default' && version === '1.0.0') {
            return mockCoreRuleset;
          }
          return null;
        }),
      },
      worlds: {
        getByIdVersion: vi.fn(async (id: string, version: string) => {
          if (id === 'world.mystika' && version === '1.0.0') {
            return mockWorld;
          }
          return null;
        }),
      },
      adventures: {
        getByIdVersion: vi.fn(async (id: string, version: string) => {
          if (id === 'adv.whispercross' && version === '1.0.0') {
            return mockAdventure;
          }
          return null;
        }),
      },
      adventureStarts: {
        getByAdventureRef: vi.fn(async () => null),
      },
      injectionMap: {
        getByIdVersion: vi.fn(async (id: string) => {
          if (id === 'default') {
            return mockInjectionMap;
          }
          return null;
        }),
      },
    })),
  }))
}));

vi.mock('../src/utils/awf-bundle-helpers.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    validateBundleStructure: vi.fn(() => []), // Mock validation to always pass
    setAtPointer: vi.fn((bundle, path, value) => {
      // Simplified setAtPointer for testing
      const parts = path.split('/').filter(Boolean);
      let current: any = bundle;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
    }),
  };
});

vi.mock('../src/utils/awf-player-data.js', () => ({
  loadPlayerData: vi.fn(async () => mockPlayer),
}));

vi.mock('../src/utils/awf-npc-data.js', () => ({
  loadNpcData: vi.fn(async () => mockNpcs),
}));

describe('AWF Assembler - Games-Only State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should build bundle using game.state_snapshot.meta', async () => {
    const { bundle } = await assembleBundle({
      sessionId: mockGame.id,
      inputText: 'Hello world',
    });

    expect(bundle.awf_bundle).toHaveProperty('meta');
    expect(bundle.awf_bundle.meta.world).toBe('world.mystika@1.0.0');
    expect(bundle.awf_bundle.meta.adventure).toBe('adv.whispercross@1.0.0');
    expect(bundle.awf_bundle.meta.locale).toBe('en-US');
    expect(bundle.awf_bundle.meta.turn_id).toBe(1);
    expect(bundle.awf_bundle.meta.is_first_turn).toBe(true);
  });

  it('should use session overrides when present', async () => {
    const { bundle } = await assembleBundle({
      sessionId: mockGame.id,
      inputText: 'Hello world',
    });

    // Should use session overrides for ruleset and locale
    expect(bundle.awf_bundle.meta.locale).toBe('es-ES'); // From session override
    expect(bundle.awf_bundle).toHaveProperty('core_ruleset');
    expect(bundle.awf_bundle.core_ruleset).toEqual(mockCoreRuleset.doc.ruleset);
  });

  it('should inject core contract parts correctly', async () => {
    const { bundle } = await assembleBundle({
      sessionId: mockGame.id,
      inputText: 'Hello world',
    });

    expect(bundle.awf_bundle).toHaveProperty('contract');
    expect(bundle.awf_bundle.contract).toEqual(mockCoreContract.doc.contract);
    expect(bundle.awf_bundle).toHaveProperty('core_acts_catalog');
    expect(bundle.awf_bundle.core_acts_catalog).toEqual(mockCoreContract.doc.core.acts_catalog);
    expect(bundle.awf_bundle).toHaveProperty('core_scales');
    expect(bundle.awf_bundle.core_scales).toEqual(mockCoreContract.doc.core.scales);
    expect(bundle.awf_bundle).toHaveProperty('core_budgets');
    expect(bundle.awf_bundle.core_budgets).toEqual(mockCoreContract.doc.core.budgets);
  });

  it('should use game state for hot/warm/cold data', async () => {
    const { bundle } = await assembleBundle({
      sessionId: mockGame.id,
      inputText: 'Hello world',
    });

    expect(bundle.awf_bundle).toHaveProperty('game_state');
    expect(bundle.awf_bundle.game_state.hot).toEqual(mockGame.state_snapshot.hot);
    expect(bundle.awf_bundle.game_state.warm).toEqual(mockGame.state_snapshot.warm);
    expect(bundle.awf_bundle.game_state.cold).toEqual(mockGame.state_snapshot.cold);
  });

  it('should handle missing session gracefully', async () => {
    // Mock no session found
    AWFRepositoryFactory().getAllRepositories().sessions.getByIdVersion.mockResolvedValue(null);

    const { bundle } = await assembleBundle({
      sessionId: mockGame.id,
      inputText: 'Hello world',
    });

    // Should fall back to game meta
    expect(bundle.awf_bundle.meta.locale).toBe('en-US'); // From game meta
    expect(bundle.awf_bundle).toHaveProperty('core_ruleset');
  });

  it('should throw error if game not found', async () => {
    AWFRepositoryFactory().getAllRepositories().games.getById.mockResolvedValue(null);

    await expect(assembleBundle({
      sessionId: 'nonexistent-game',
      inputText: 'Hello world',
    })).rejects.toThrow('Game nonexistent-game not found');
  });

  it('should throw error if world_ref missing from game meta', async () => {
    const gameWithoutMeta = {
      ...mockGame,
      state_snapshot: {}
    };
    AWFRepositoryFactory().getAllRepositories().games.getById.mockResolvedValue(gameWithoutMeta);

    await expect(assembleBundle({
      sessionId: mockGame.id,
      inputText: 'Hello world',
    })).rejects.toThrow('No world_ref found in game.state_snapshot.meta');
  });
});

















