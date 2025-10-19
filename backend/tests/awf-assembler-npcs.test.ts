import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assembleBundle } from '../src/assemblers/awf-bundle-assembler.js';

// Mock the Supabase client and repositories
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => ({ data: null, error: null }))
      }))
    }))
  }))
};

// Mock the repository factory
vi.mock('../src/repositories/awf-repository-factory.js', () => ({
  AWFRepositoryFactory: vi.fn().mockImplementation(() => ({
    getAllRepositories: () => ({
      games: {
        getById: vi.fn().mockResolvedValue({
          id: 'test-game',
          user_id: 'test-user',
          state_snapshot: {
            meta: {
              world_ref: 'world.test@1.0.0',
              adventure_ref: 'adv.test@1.0.0',
              ruleset_ref: 'ruleset.core.default@1.0.0'
            },
            hot: {
              scene: 'test-scene',
              active_npcs: ['npc.kiera@1.0.0', 'npc.thorin@1.0.0']
            },
            warm: {
              relationships: {
                'npc.kiera': { trust: 75 },
                'npc.thorin': { trust: 60 }
              },
              pins: [
                { npc_ref: 'npc.ally@1.0.0' }
              ]
            }
          }
        })
      },
      sessions: {
        getByIdVersion: vi.fn().mockResolvedValue(null)
      },
      coreContracts: {
        getActive: vi.fn().mockResolvedValue({
          id: 'default',
          version: '2.0.0',
          doc: {
            contract: {
              name: 'Test Contract',
              awf_return: 'Return AWF object',
              keys: { required: ['scn', 'txt'], optional: ['choices'] }
            },
            core: {
              acts_catalog: [
                { type: 'TIME_ADVANCE', mode: 'add_number', target: 'time.ticks' }
              ],
              scales: {
                skill: { min: 0, baseline: 50, max: 100 },
                relationship: { min: 0, baseline: 50, max: 100 }
              }
            }
          }
        })
      },
      coreRulesets: {
        getByIdVersion: vi.fn().mockResolvedValue({
          id: 'ruleset.core.default',
          version: '1.0.0',
          doc: {
            ruleset: {
              name: 'Default Ruleset',
              'scn.phases': ['setup', 'play', 'resolution'],
              'txt.policy': '2-6 sentences, cinematic',
              'choices.policy': '1-5 items, ≤48 chars',
              token_discipline: {
                npcs_active_cap: 3
              },
              defaults: {
                txt_sentences_min: 2,
                txt_sentences_max: 6
              }
            }
          }
        })
      },
      worlds: {
        getByIdVersion: vi.fn().mockResolvedValue({
          id: 'world.test',
          version: '1.0.0',
          doc: {
            world: {
              name: 'Test World',
              timeworld: {
                bands: [
                  { name: 'Dawn', ticks: 60 },
                  { name: 'Mid-Day', ticks: 60 },
                  { name: 'Evening', ticks: 60 },
                  { name: 'Mid-Night', ticks: 60 }
                ]
              }
            }
          }
        })
      },
      adventures: {
        getByIdVersion: vi.fn().mockResolvedValue({
          id: 'adv.test',
          version: '1.0.0',
          doc: {
            adventure: {
              name: 'Test Adventure',
              cast: [
                { npc_ref: 'npc.gandalf@1.0.0' }
              ]
            }
          }
        })
      },
      adventureStarts: {
        getByAdventureRef: vi.fn().mockResolvedValue(null)
      },
      injectionMap: {
        getByIdVersion: vi.fn().mockResolvedValue({
          id: 'default',
          version: '1.0.0',
          doc: {
            build: {
              contract: 'core_contracts.active.doc.contract',
              acts_catalog: 'core_contracts.active.doc.core.acts_catalog',
              scales: 'core_contracts.active.doc.core.scales',
              ruleset: 'core_rulesets[{env.ruleset_ref}].doc.ruleset',
              npcs: 'npcs.by_refs[/scenario/fixed_npcs[*].npc_ref]'
            }
          }
        })
      },
      npcs: {
        listByIds: vi.fn().mockResolvedValue([
          {
            id: 'npc.kiera',
            version: '1.0.0',
            doc: {
              npc: {
                display_name: 'Kiera',
                archetype: 'ranger',
                summary: 'Sharp-eyed scout who watches from the treeline.',
                tags: ['ally', 'scout'],
                style: {
                  voice: 'wry, concise, observant',
                  register: 'casual'
                }
              }
            }
          },
          {
            id: 'npc.thorin',
            version: '1.0.0',
            doc: {
              npc: {
                display_name: 'Thorin',
                archetype: 'warrior',
                summary: 'Stalwart defender with a strong sense of honor.',
                tags: ['ally', 'warrior'],
                style: {
                  voice: 'gruff, direct, honorable',
                  register: 'formal'
                }
              }
            }
          },
          {
            id: 'npc.ally',
            version: '1.0.0',
            doc: {
              npc: {
                display_name: 'Ally',
                archetype: 'companion',
                summary: 'A trusted companion.',
                tags: ['ally'],
                style: {
                  voice: 'friendly, supportive',
                  register: 'casual'
                }
              }
            }
          }
        ])
      }
    })
  }))
}));

// Mock other dependencies
vi.mock('../src/utils/awf-bundle-helpers.js', () => ({
  setAtPointer: vi.fn(),
  estimateTokens: vi.fn(() => 100),
  generateRngSeed: vi.fn(() => 'test-seed'),
  selectSlices: vi.fn(() => []),
  filterActiveNpcs: vi.fn((npcs) => npcs),
  calculateBundleMetrics: vi.fn(() => ({
    totalTokens: 100,
    buildTime: 50,
    sliceCount: 0,
    npcCount: 0
  })),
  validateBundleStructure: vi.fn(() => [])
}));

vi.mock('../src/policies/scene-slice-policy.js', () => ({
  getSlicesForScene: vi.fn(() => []),
  getDefaultWorldSlices: vi.fn(() => []),
  getDefaultAdventureSlices: vi.fn(() => [])
}));

vi.mock('../src/utils/awf-ruleset-resolver.js', () => ({
  resolveRulesetRef: vi.fn(() => ({
    ruleset_ref: 'ruleset.core.default@1.0.0',
    locale: 'en-US'
  })),
  parseRulesetRef: vi.fn(() => ({
    id: 'ruleset.core.default',
    version: '1.0.0'
  }))
}));

// Mock player data loading
vi.mock('../src/assemblers/awf-bundle-assembler.js', async () => {
  const actual = await vi.importActual('../src/assemblers/awf-bundle-assembler.js');
  return {
    ...actual,
    loadPlayerData: vi.fn().mockResolvedValue({
      id: 'test-user',
      name: 'Test Player'
    })
  };
});

describe('AWF Assembler NPC Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should collect and inject NPCs with cap applied', async () => {
    const params = {
      sessionId: 'test-game',
      inputText: 'Test input'
    };

    const result = await assembleBundle(params);

    expect(result.bundle).toBeDefined();
    
    // Verify NPCs were collected and capped
    const bundle = result.bundle as any;
    expect(bundle.npcs).toBeDefined();
    expect(Array.isArray(bundle.npcs)).toBe(true);
    
    // Should be capped to 3 (from ruleset token_discipline.npcs_active_cap)
    expect(bundle.npcs.length).toBeLessThanOrEqual(3);
  });

  it('should handle empty NPC collection gracefully', async () => {
    // Mock empty game state
    const mockRepos = {
      games: {
        getById: vi.fn().mockResolvedValue({
          id: 'test-game',
          user_id: 'test-user',
          state_snapshot: {
            meta: {
              world_ref: 'world.test@1.0.0',
              adventure_ref: 'adv.test@1.0.0',
              ruleset_ref: 'ruleset.core.default@1.0.0'
            },
            hot: {},
            warm: {}
          }
        })
      },
      // ... other mocks
    };

    const params = {
      sessionId: 'test-game',
      inputText: 'Test input'
    };

    const result = await assembleBundle(params);

    expect(result.bundle).toBeDefined();
    
    const bundle = result.bundle as any;
    expect(bundle.npcs).toBeDefined();
    expect(Array.isArray(bundle.npcs)).toBe(true);
    expect(bundle.npcs.length).toBe(0);
  });

  it('should apply locale overlay when available', async () => {
    // Mock NPC with i18n data
    const mockRepos = {
      games: {
        getById: vi.fn().mockResolvedValue({
          id: 'test-game',
          user_id: 'test-user',
          state_snapshot: {
            meta: {
              world_ref: 'world.test@1.0.0',
              adventure_ref: 'adv.test@1.0.0',
              ruleset_ref: 'ruleset.core.default@1.0.0'
            },
            hot: {
              active_npcs: ['npc.kiera@1.0.0']
            },
            warm: {}
          }
        })
      },
      // ... other mocks
      npcs: {
        listByIds: vi.fn().mockResolvedValue([
          {
            id: 'npc.kiera',
            version: '1.0.0',
            doc: {
              npc: {
                display_name: 'Kiera',
                summary: 'Sharp-eyed scout.',
                i18n: {
                  'es-ES': {
                    display_name: 'Kiera',
                    summary: 'Exploradora de vista aguda.'
                  }
                }
              }
            }
          }
        ])
      }
    };

    const params = {
      sessionId: 'test-game',
      inputText: 'Test input'
    };

    const result = await assembleBundle(params);

    expect(result.bundle).toBeDefined();
    
    const bundle = result.bundle as any;
    expect(bundle.npcs).toBeDefined();
    expect(bundle.npcs.length).toBeGreaterThan(0);
    
    // Should use Spanish summary
    const npc = bundle.npcs[0];
    expect(npc.summary).toBe('Exploradora de vista aguda.');
  });

  it('should handle NPC collection errors gracefully', async () => {
    // Mock NPC repository to throw error
    const mockRepos = {
      games: {
        getById: vi.fn().mockResolvedValue({
          id: 'test-game',
          user_id: 'test-user',
          state_snapshot: {
            meta: {
              world_ref: 'world.test@1.0.0',
              adventure_ref: 'adv.test@1.0.0',
              ruleset_ref: 'ruleset.core.default@1.0.0'
            },
            hot: {
              active_npcs: ['npc.kiera@1.0.0']
            },
            warm: {}
          }
        })
      },
      // ... other mocks
      npcs: {
        listByIds: vi.fn().mockRejectedValue(new Error('Database error'))
      }
    };

    const params = {
      sessionId: 'test-game',
      inputText: 'Test input'
    };

    const result = await assembleBundle(params);

    // Should still succeed but with empty NPCs
    expect(result.bundle).toBeDefined();
    
    const bundle = result.bundle as any;
    expect(bundle.npcs).toBeDefined();
    expect(Array.isArray(bundle.npcs)).toBe(true);
    expect(bundle.npcs.length).toBe(0);
  });

  it('should respect ruleset NPC cap', async () => {
    // Mock ruleset with low cap
    const mockRepos = {
      games: {
        getById: vi.fn().mockResolvedValue({
          id: 'test-game',
          user_id: 'test-user',
          state_snapshot: {
            meta: {
              world_ref: 'world.test@1.0.0',
              adventure_ref: 'adv.test@1.0.0',
              ruleset_ref: 'ruleset.core.default@1.0.0'
            },
            hot: {
              active_npcs: ['npc.1@1.0.0', 'npc.2@1.0.0', 'npc.3@1.0.0', 'npc.4@1.0.0', 'npc.5@1.0.0']
            },
            warm: {}
          }
        })
      },
      // ... other mocks
      coreRulesets: {
        getByIdVersion: vi.fn().mockResolvedValue({
          id: 'ruleset.core.default',
          version: '1.0.0',
          doc: {
            ruleset: {
              name: 'Default Ruleset',
              'scn.phases': ['setup', 'play', 'resolution'],
              'txt.policy': '2-6 sentences, cinematic',
              'choices.policy': '1-5 items, ≤48 chars',
              token_discipline: {
                npcs_active_cap: 2 // Very low cap
              },
              defaults: {
                txt_sentences_min: 2,
                txt_sentences_max: 6
              }
            }
          }
        })
      },
      npcs: {
        listByIds: vi.fn().mockResolvedValue([
          { id: 'npc.1', version: '1.0.0', doc: { npc: { display_name: 'NPC 1', summary: 'First NPC' } } },
          { id: 'npc.2', version: '1.0.0', doc: { npc: { display_name: 'NPC 2', summary: 'Second NPC' } } }
        ])
      }
    };

    const params = {
      sessionId: 'test-game',
      inputText: 'Test input'
    };

    const result = await assembleBundle(params);

    expect(result.bundle).toBeDefined();
    
    const bundle = result.bundle as any;
    expect(bundle.npcs).toBeDefined();
    expect(Array.isArray(bundle.npcs)).toBe(true);
    expect(bundle.npcs.length).toBeLessThanOrEqual(2);
  });
});
