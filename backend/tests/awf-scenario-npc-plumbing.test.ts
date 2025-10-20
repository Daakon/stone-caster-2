/**
 * AWF Scenario NPC Plumbing Tests
 * Tests for scenario fixed_npcs integration with NPC collector
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { collectNpcRefs } from '../src/assemblers/npc-collector.js';

describe('Scenario NPC Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('collectNpcRefs with scenario', () => {
    it('should collect NPCs from scenario fixed_npcs', () => {
      const input = {
        game: {
          hot: {},
          warm: {}
        },
        scenario: {
          fixed_npcs: [
            { npc_ref: 'npc.kiera@1.0.0' },
            { npc_ref: 'npc.tavern_keeper@1.0.0' }
          ]
        },
        adventure: {
          cast: [
            { npc_ref: 'npc.adventure_npc@1.0.0' }
          ]
        },
        ruleset: {
          token_discipline: {
            npcs_active_cap: 5
          }
        }
      };

      const result = collectNpcRefs(input);
      
      expect(result).toContain('npc.kiera@1.0.0');
      expect(result).toContain('npc.tavern_keeper@1.0.0');
      expect(result).toContain('npc.adventure_npc@1.0.0');
      expect(result).toHaveLength(3);
    });

    it('should prioritize scenario NPCs over adventure NPCs', () => {
      const input = {
        game: {
          hot: {},
          warm: {}
        },
        scenario: {
          fixed_npcs: [
            { npc_ref: 'npc.scenario_npc@1.0.0' }
          ]
        },
        adventure: {
          cast: [
            { npc_ref: 'npc.adventure_npc@1.0.0' }
          ]
        },
        ruleset: {
          token_discipline: {
            npcs_active_cap: 10
          }
        }
      };

      const result = collectNpcRefs(input);
      
      expect(result).toContain('npc.scenario_npc@1.0.0');
      expect(result).toContain('npc.adventure_npc@1.0.0');
    });

    it('should deduplicate NPCs from multiple sources', () => {
      const input = {
        game: {
          hot: {
            active_npcs: ['npc.shared@1.0.0']
          },
          warm: {
            relationships: {
              'npc.shared@1.0.0': {}
            }
          }
        },
        scenario: {
          fixed_npcs: [
            { npc_ref: 'npc.shared@1.0.0' },
            { npc_ref: 'npc.scenario_only@1.0.0' }
          ]
        },
        adventure: {
          cast: [
            { npc_ref: 'npc.shared@1.0.0' }
          ]
        },
        ruleset: {
          token_discipline: {
            npcs_active_cap: 10
          }
        }
      };

      const result = collectNpcRefs(input);
      
      // Should only appear once despite being in multiple sources
      const sharedCount = result.filter(ref => ref === 'npc.shared@1.0.0').length;
      expect(sharedCount).toBe(1);
      
      expect(result).toContain('npc.scenario_only@1.0.0');
      expect(result).toHaveLength(2);
    });

    it('should apply cap from ruleset', () => {
      const input = {
        game: {
          hot: {},
          warm: {}
        },
        scenario: {
          fixed_npcs: Array(10).fill({ npc_ref: 'npc.test@1.0.0' }).map((item, index) => ({
            npc_ref: `npc.test${index}@1.0.0`
          }))
        },
        adventure: {},
        ruleset: {
          token_discipline: {
            npcs_active_cap: 3
          }
        }
      };

      const result = collectNpcRefs(input);
      
      expect(result).toHaveLength(3);
    });

    it('should use default cap of 5 when ruleset cap not specified', () => {
      const input = {
        game: {
          hot: {},
          warm: {}
        },
        scenario: {
          fixed_npcs: Array(10).fill({ npc_ref: 'npc.test@1.0.0' }).map((item, index) => ({
            npc_ref: `npc.test${index}@1.0.0`
          }))
        },
        adventure: {},
        ruleset: {}
      };

      const result = collectNpcRefs(input);
      
      expect(result).toHaveLength(5);
    });

    it('should handle scenario without fixed_npcs', () => {
      const input = {
        game: {
          hot: {
            active_npcs: ['npc.game_npc@1.0.0']
          },
          warm: {}
        },
        scenario: {},
        adventure: {
          cast: [
            { npc_ref: 'npc.adventure_npc@1.0.0' }
          ]
        },
        ruleset: {
          token_discipline: {
            npcs_active_cap: 10
          }
        }
      };

      const result = collectNpcRefs(input);
      
      expect(result).toContain('npc.game_npc@1.0.0');
      expect(result).toContain('npc.adventure_npc@1.0.0');
      expect(result).toHaveLength(2);
    });

    it('should handle null scenario', () => {
      const input = {
        game: {
          hot: {},
          warm: {}
        },
        scenario: null,
        adventure: {
          cast: [
            { npc_ref: 'npc.adventure_npc@1.0.0' }
          ]
        },
        ruleset: {
          token_discipline: {
            npcs_active_cap: 10
          }
        }
      };

      const result = collectNpcRefs(input);
      
      expect(result).toContain('npc.adventure_npc@1.0.0');
      expect(result).toHaveLength(1);
    });

    it('should handle scenario with malformed fixed_npcs', () => {
      const input = {
        game: {
          hot: {},
          warm: {}
        },
        scenario: {
          fixed_npcs: [
            { npc_ref: 'npc.valid@1.0.0' },
            { npc_ref: '' }, // Invalid: empty ref
            null, // Invalid: null item
            { npc_ref: 'npc.another_valid@1.0.0' }
          ]
        },
        adventure: {},
        ruleset: {
          token_discipline: {
            npcs_active_cap: 10
          }
        }
      };

      const result = collectNpcRefs(input);
      
      expect(result).toContain('npc.valid@1.0.0');
      expect(result).toContain('npc.another_valid@1.0.0');
      expect(result).toHaveLength(2);
    });
  });
});
