/**
 * AWF Scenario Assembler Tests
 * Tests for scenario loading and compaction in the assembler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { compactScenario, loadScenario } from '../src/assemblers/load-scenario.js';

// Mock repositories
const mockRepos = {
  scenarios: {
    getByIdVersion: vi.fn()
  }
};

describe('Scenario Loading and Compaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('compactScenario', () => {
    it('should compact scenario with all fields', () => {
      const doc = {
        __ref: 'scenario.test@1.0.0',
        scenario: {
          display_name: 'Test Scenario',
          synopsis: 'A test scenario for validation.',
          start_scene: 'test.scene',
          fixed_npcs: [
            { npc_ref: 'npc.test1@1.0.0' },
            { npc_ref: 'npc.test2@1.0.0' }
          ]
        }
      };

      const result = compactScenario(doc);
      
      expect(result).toEqual({
        ref: 'scenario.test@1.0.0',
        name: 'Test Scenario',
        synopsis: 'A test scenario for validation.',
        start_scene: 'test.scene',
        fixed_npcs: [
          { npc_ref: 'npc.test1@1.0.0' },
          { npc_ref: 'npc.test2@1.0.0' }
        ]
      });
    });

    it('should apply locale overlay when provided', () => {
      const doc = {
        __ref: 'scenario.test@1.0.0',
        scenario: {
          display_name: 'Test Scenario',
          synopsis: 'A test scenario.',
          start_scene: 'test.scene',
          i18n: {
            es: {
              display_name: 'Escenario de Prueba',
              synopsis: 'Un escenario de prueba.',
              start_scene: 'test.escena'
            }
          }
        }
      };

      const result = compactScenario(doc, 'es');
      
      expect(result).toEqual({
        ref: 'scenario.test@1.0.0',
        name: 'Escenario de Prueba',
        synopsis: 'Un escenario de prueba.',
        start_scene: 'test.escena',
        fixed_npcs: []
      });
    });

    it('should handle missing optional fields', () => {
      const doc = {
        scenario: {
          display_name: 'Minimal Scenario',
          start_scene: 'test.scene'
        }
      };

      const result = compactScenario(doc);
      
      expect(result).toEqual({
        ref: undefined,
        name: 'Minimal Scenario',
        synopsis: '',
        start_scene: 'test.scene',
        fixed_npcs: []
      });
    });

    it('should cap fixed_npcs to 8 items', () => {
      const doc = {
        scenario: {
          display_name: 'Test Scenario',
          start_scene: 'test.scene',
          fixed_npcs: Array(10).fill({ npc_ref: 'npc.test@1.0.0' })
        }
      };

      const result = compactScenario(doc);
      
      expect(result.fixed_npcs).toHaveLength(8);
    });

    it('should truncate synopsis to 160 characters', () => {
      const doc = {
        scenario: {
          display_name: 'Test Scenario',
          synopsis: 'A'.repeat(200),
          start_scene: 'test.scene'
        }
      };

      const result = compactScenario(doc);
      
      expect(result.synopsis).toHaveLength(160);
      expect(result.synopsis).toBe('A'.repeat(160));
    });
  });

  describe('loadScenario', () => {
    it('should load and compact scenario successfully', async () => {
      const scenarioRef = 'scenario.test@1.0.0';
      const mockScenario = {
        id: 'scenario.test',
        version: '1.0.0',
        doc: {
          world_ref: 'world.test@1.0.0',
          scenario: {
            display_name: 'Test Scenario',
            synopsis: 'A test scenario.',
            start_scene: 'test.scene',
            fixed_npcs: [{ npc_ref: 'npc.test@1.0.0' }]
          }
        }
      };

      mockRepos.scenarios.getByIdVersion.mockResolvedValue(mockScenario);

      const result = await loadScenario(mockRepos, scenarioRef, 'en');

      expect(mockRepos.scenarios.getByIdVersion).toHaveBeenCalledWith('scenario.test', '1.0.0');
      expect(result).toEqual({
        ref: scenarioRef,
        name: 'Test Scenario',
        synopsis: 'A test scenario.',
        start_scene: 'test.scene',
        fixed_npcs: [{ npc_ref: 'npc.test@1.0.0' }]
      });
    });

    it('should return null for invalid scenario reference', async () => {
      const result = await loadScenario(mockRepos, 'invalid-ref', 'en');
      
      expect(result).toBeNull();
    });

    it('should return null when scenario not found', async () => {
      mockRepos.scenarios.getByIdVersion.mockResolvedValue(null);

      const result = await loadScenario(mockRepos, 'scenario.missing@1.0.0', 'en');
      
      expect(result).toBeNull();
    });

    it('should handle repository errors gracefully', async () => {
      mockRepos.scenarios.getByIdVersion.mockRejectedValue(new Error('Database error'));

      const result = await loadScenario(mockRepos, 'scenario.error@1.0.0', 'en');
      
      expect(result).toBeNull();
    });

    it('should handle empty scenario reference', async () => {
      const result = await loadScenario(mockRepos, '', 'en');
      
      expect(result).toBeNull();
    });
  });
});
