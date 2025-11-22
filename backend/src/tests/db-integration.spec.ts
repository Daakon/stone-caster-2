/**
 * Database Integration Tests
 * Tests the repository layer for Chimera database operations
 * 
 * Note: These tests mock the Supabase client. For full integration tests,
 * configure a local Supabase instance and remove the mocks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RulesetsRepository } from '../db/repos/rulesets.repo.js';
import type { RulesetDefinition } from '@shared/types/chimera-authoring';

// Mock Supabase client
const createMockSupabaseClient = () => {
  const mockInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: { id: 'test-id-123' },
        error: null,
      }),
    }),
  });

  const mockSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: { definition: null },
        error: null,
      }),
      in: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    }),
    in: vi.fn().mockResolvedValue({
      data: [],
      error: null,
    }),
  });

  return {
    from: vi.fn((table: string) => {
      if (table === 'chimera_ruleset_templates') {
        return {
          insert: mockInsert,
          select: mockSelect,
        };
      }
      return {
        insert: mockInsert,
        select: mockSelect,
      };
    }),
  } as unknown as SupabaseClient<any>;
};

describe('RulesetsRepository Integration', () => {
  let repository: RulesetsRepository;
  let mockSupabase: SupabaseClient<any>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    repository = new RulesetsRepository(mockSupabase);
  });

  describe('create', () => {
    it('should correctly parse RulesetDefinition and extract ui_category to DB column', async () => {
      const mockRuleset: RulesetDefinition = {
        id: 'rs_d100_core',
        name: 'D100 Core System',
        ui_category: 'foundation',
        exclusion_group: 'skill_engine',
        dependencies: [],
        provides_tags: ['d100', 'skill_based'],
        state_contributions: {
          skills: { type: 'object' },
        },
        actions: {
          skill_check: { type: 'action' },
        },
        ai_instructions: {},
      };

      // Mock the insert to capture what was passed
      let capturedInsert: any = null;
      const mockInsert = vi.fn().mockImplementation((data) => {
        capturedInsert = data;
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'test-id-123' },
              error: null,
            }),
          }),
        };
      });

      (mockSupabase.from as any) = vi.fn(() => ({
        insert: mockInsert,
      }));

      const id = await repository.create(mockRuleset);

      // Verify the insert was called
      expect(mockInsert).toHaveBeenCalled();

      // Verify ui_category was extracted and passed as a column
      expect(capturedInsert).toBeDefined();
      expect(capturedInsert.ui_category).toBe('foundation');
      expect(capturedInsert.exclusion_group).toBe('skill_engine');
      expect(capturedInsert.dependencies).toEqual([]);
      expect(capturedInsert.definition).toBeDefined();
      expect(capturedInsert.key).toBe('rs_d100_core');

      // Verify the full definition is stored
      const storedDefinition = capturedInsert.definition as RulesetDefinition;
      expect(storedDefinition.id).toBe('rs_d100_core');
      expect(storedDefinition.ui_category).toBe('foundation');

      expect(id).toBe('test-id-123');
    });

    it('should handle null exclusion_group', async () => {
      const mockRuleset: RulesetDefinition = {
        id: 'rs_health_simple',
        name: 'Simple Health System',
        ui_category: 'expansion',
        exclusion_group: null,
        dependencies: ['rs_d100_core'],
        provides_tags: ['health'],
        state_contributions: {},
        actions: {},
        ai_instructions: {},
      };

      let capturedInsert: any = null;
      const mockInsert = vi.fn().mockImplementation((data) => {
        capturedInsert = data;
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'test-id-456' },
              error: null,
            }),
          }),
        };
      });

      (mockSupabase.from as any) = vi.fn(() => ({
        insert: mockInsert,
      }));

      await repository.create(mockRuleset);

      expect(capturedInsert.exclusion_group).toBeNull();
      expect(capturedInsert.ui_category).toBe('expansion');
      expect(capturedInsert.dependencies).toEqual(['rs_d100_core']);
    });

    it('should validate RulesetDefinition before inserting', async () => {
      const invalidRuleset = {
        id: 'rs_invalid',
        // Missing required fields
      } as any;

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'test-id' },
            error: null,
          }),
        }),
      });

      (mockSupabase.from as any) = vi.fn(() => ({
        insert: mockInsert,
      }));

      // Should throw validation error
      await expect(repository.create(invalidRuleset)).rejects.toThrow();
    });
  });

  describe('findByCategory', () => {
    it('should query by ui_category column', async () => {
      const mockRulesets = [
        {
          definition: {
            id: 'rs_d100_core',
            name: 'D100 Core',
            ui_category: 'foundation',
            exclusion_group: null,
            dependencies: [],
            provides_tags: [],
            state_contributions: {},
            actions: {},
            ai_instructions: {},
          },
        },
        {
          definition: {
            id: 'rs_another',
            name: 'Another Foundation',
            ui_category: 'foundation',
            exclusion_group: null,
            dependencies: [],
            provides_tags: [],
            state_contributions: {},
            actions: {},
            ai_instructions: {},
          },
        },
      ];

      const mockEq = vi.fn().mockResolvedValue({
        data: mockRulesets,
        error: null,
      });

      (mockSupabase.from as any) = vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: mockEq,
        }),
      }));

      const results = await repository.findByCategory('foundation');

      expect(mockEq).toHaveBeenCalledWith('ui_category', 'foundation');
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('rs_d100_core');
      expect(results[1].id).toBe('rs_another');
    });
  });

  describe('findByIds', () => {
    it('should query by key column using IN clause', async () => {
      const mockRulesets = [
        {
          definition: {
            id: 'rs_d100_core',
            name: 'D100 Core',
            ui_category: 'foundation',
            exclusion_group: null,
            dependencies: [],
            provides_tags: [],
            state_contributions: {},
            actions: {},
            ai_instructions: {},
          },
        },
      ];

      const mockIn = vi.fn().mockResolvedValue({
        data: mockRulesets,
        error: null,
      });

      (mockSupabase.from as any) = vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          in: mockIn,
        }),
      }));

      const results = await repository.findByIds(['rs_d100_core', 'rs_health_simple']);

      expect(mockIn).toHaveBeenCalledWith('key', ['rs_d100_core', 'rs_health_simple']);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('rs_d100_core');
    });

    it('should return empty array for empty input', async () => {
      const results = await repository.findByIds([]);
      expect(results).toEqual([]);
    });
  });
});

