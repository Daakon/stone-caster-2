import { describe, it, expect } from 'vitest';
import { collectNpcRefs } from '../src/assemblers/npc-collector.js';

describe('AWF NPC Collector', () => {
  describe('collectNpcRefs', () => {
    it('should collect NPC refs from scenario fixed_npcs', () => {
      const input = {
        game: {},
        scenario: {
          fixed_npcs: [
            { npc_ref: 'npc.kiera@1.0.0' },
            { npc_ref: 'npc.thorin@1.0.0' }
          ]
        },
        adventure: {},
        ruleset: {}
      };

      const result = collectNpcRefs(input);
      expect(result).toEqual(['npc.kiera@1.0.0', 'npc.thorin@1.0.0']);
    });

    it('should collect NPC refs from adventure cast', () => {
      const input = {
        game: {},
        scenario: {},
        adventure: {
          cast: [
            { npc_ref: 'npc.gandalf@1.0.0' },
            { npc_ref: 'npc.aragorn@1.0.0' }
          ]
        },
        ruleset: {}
      };

      const result = collectNpcRefs(input);
      expect(result).toEqual(['npc.gandalf@1.0.0', 'npc.aragorn@1.0.0']);
    });

    it('should collect NPC refs from game warm relationships', () => {
      const input = {
        game: {
          warm: {
            relationships: {
              'npc.kiera': { trust: 75 },
              'npc.thorin': { trust: 60 }
            }
          }
        },
        scenario: {},
        adventure: {},
        ruleset: {}
      };

      const result = collectNpcRefs(input);
      expect(result).toEqual(['npc.kiera', 'npc.thorin']);
    });

    it('should collect NPC refs from game warm pins', () => {
      const input = {
        game: {
          warm: {
            pins: [
              { npc_ref: 'npc.ally@1.0.0' },
              { npc_ref: 'npc.mentor@1.0.0' }
            ]
          }
        },
        scenario: {},
        adventure: {},
        ruleset: {}
      };

      const result = collectNpcRefs(input);
      expect(result).toEqual(['npc.ally@1.0.0', 'npc.mentor@1.0.0']);
    });

    it('should collect NPC refs from game hot active_npcs', () => {
      const input = {
        game: {
          hot: {
            active_npcs: ['npc.current1', 'npc.current2']
          }
        },
        scenario: {},
        adventure: {},
        ruleset: {}
      };

      const result = collectNpcRefs(input);
      expect(result).toEqual(['npc.current1', 'npc.current2']);
    });

    it('should deduplicate NPC refs from multiple sources', () => {
      const input = {
        game: {
          warm: {
            relationships: {
              'npc.kiera': { trust: 75 }
            }
          },
          hot: {
            active_npcs: ['npc.kiera']
          }
        },
        scenario: {
          fixed_npcs: [
            { npc_ref: 'npc.kiera@1.0.0' }
          ]
        },
        adventure: {
          cast: [
            { npc_ref: 'npc.kiera@1.0.0' }
          ]
        },
        ruleset: {}
      };

      const result = collectNpcRefs(input);
      expect(result).toEqual(['npc.kiera@1.0.0']); // Should be deduplicated
    });

    it('should apply cap from ruleset token_discipline', () => {
      const input = {
        game: {
          warm: {
            relationships: {
              'npc.1': {},
              'npc.2': {},
              'npc.3': {},
              'npc.4': {},
              'npc.5': {},
              'npc.6': {}
            }
          }
        },
        scenario: {},
        adventure: {},
        ruleset: {
          token_discipline: {
            npcs_active_cap: 3
          }
        }
      };

      const result = collectNpcRefs(input);
      expect(result).toHaveLength(3);
      expect(result).toEqual(['npc.1', 'npc.2', 'npc.3']);
    });

    it('should use default cap of 5 when ruleset cap not specified', () => {
      const input = {
        game: {
          warm: {
            relationships: {
              'npc.1': {},
              'npc.2': {},
              'npc.3': {},
              'npc.4': {},
              'npc.5': {},
              'npc.6': {}
            }
          }
        },
        scenario: {},
        adventure: {},
        ruleset: {}
      };

      const result = collectNpcRefs(input);
      expect(result).toHaveLength(5);
      expect(result).toEqual(['npc.1', 'npc.2', 'npc.3', 'npc.4', 'npc.5']);
    });

    it('should handle empty input gracefully', () => {
      const input = {
        game: {},
        scenario: {},
        adventure: {},
        ruleset: {}
      };

      const result = collectNpcRefs(input);
      expect(result).toEqual([]);
    });

    it('should handle missing nested objects gracefully', () => {
      const input = {
        game: {
          warm: null,
          hot: null
        },
        scenario: null,
        adventure: null,
        ruleset: null
      };

      const result = collectNpcRefs(input);
      expect(result).toEqual([]);
    });

    it('should filter out null/undefined npc_refs', () => {
      const input = {
        game: {},
        scenario: {
          fixed_npcs: [
            { npc_ref: 'npc.valid@1.0.0' },
            { npc_ref: null },
            { npc_ref: undefined },
            { npc_ref: '' }
          ]
        },
        adventure: {},
        ruleset: {}
      };

      const result = collectNpcRefs(input);
      expect(result).toEqual(['npc.valid@1.0.0']);
    });

    it('should handle mixed ref formats (with and without version)', () => {
      const input = {
        game: {
          warm: {
            relationships: {
              'npc.no_version': {}
            }
          }
        },
        scenario: {
          fixed_npcs: [
            { npc_ref: 'npc.with_version@1.0.0' }
          ]
        },
        adventure: {},
        ruleset: {}
      };

      const result = collectNpcRefs(input);
      expect(result).toEqual(['npc.no_version', 'npc.with_version@1.0.0']);
    });
  });
});
