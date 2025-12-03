/**
 * Compiler Service Tests
 * Phase 4: The Compiler Engine (Backend)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CompilerService, CompilerError } from './compiler.service';
import type { RulesetDefinition, WorldDefinition } from '@shared/types/chimera-authoring';
import { CompiledStorySchema } from '@shared/types/chimera-compiled';

describe('CompilerService', () => {
  let compiler: CompilerService;

  beforeEach(() => {
    compiler = new CompilerService();
  });

  describe('Test A: Exclusion Conflict Detection', () => {
    it('should throw EXCLUSION_CONFLICT when multiple rulesets share the same exclusion_group', async () => {
      const world: WorldDefinition = {
        id: 'world-1',
        name: 'Test World',
        description: 'Test',
        images: [],
        character_schema_extensions: {},
        lore_fragments: [],
      };

      const rulesets: RulesetDefinition[] = [
        {
          id: 'ruleset-a',
          name: 'Ruleset A',
          ui_category: 'foundation',
          exclusion_group: 'physics',
          dependencies: [],
          provides_tags: [],
          state_contributions: {},
          actions: {},
          ai_instructions: {},
        },
        {
          id: 'ruleset-b',
          name: 'Ruleset B',
          ui_category: 'foundation',
          exclusion_group: 'physics', // Same exclusion group!
          dependencies: [],
          provides_tags: [],
          state_contributions: {},
          actions: {},
          ai_instructions: {},
        },
      ];

      await expect(
        compiler.compileStory(
          { worldId: world.id, rulesetIds: ['ruleset-a', 'ruleset-b'] },
          world,
          rulesets
        )
      ).rejects.toThrow(CompilerError);

      try {
        await compiler.compileStory(
          { worldId: world.id, rulesetIds: ['ruleset-a', 'ruleset-b'] },
          world,
          rulesets
        );
        expect.fail('Should have thrown CompilerError');
      } catch (error) {
        expect(error).toBeInstanceOf(CompilerError);
        expect((error as CompilerError).code).toBe('EXCLUSION_CONFLICT');
        expect((error as CompilerError).message).toContain('physics');
      }
    });

    it('should allow rulesets with different exclusion groups', async () => {
      const world: WorldDefinition = {
        id: 'world-1',
        name: 'Test World',
        description: 'Test',
        images: [],
        character_schema_extensions: {},
        lore_fragments: [],
      };

      const rulesets: RulesetDefinition[] = [
        {
          id: 'ruleset-a',
          name: 'Ruleset A',
          ui_category: 'foundation',
          exclusion_group: 'physics',
          dependencies: [],
          provides_tags: [],
          state_contributions: {},
          actions: {},
          ai_instructions: {},
        },
        {
          id: 'ruleset-b',
          name: 'Ruleset B',
          ui_category: 'foundation',
          exclusion_group: 'magic', // Different exclusion group
          dependencies: [],
          provides_tags: [],
          state_contributions: {},
          actions: {},
          ai_instructions: {},
        },
      ];

      const result = await compiler.compileStory(
        { worldId: world.id, rulesetIds: ['ruleset-a', 'ruleset-b'] },
        world,
        rulesets
      );

      expect(result).toBeDefined();
      expect(result.meta.source_ids).toContain('world-1');
    });
  });

  describe('Test B: Schema Merging (Allowlists)', () => {
    it('should merge tier1_allowlist from multiple rulesets', async () => {
      const world: WorldDefinition = {
        id: 'world-1',
        name: 'Test World',
        description: 'Test',
        images: [],
        character_schema_extensions: {},
        lore_fragments: [],
      };

      const rulesets: RulesetDefinition[] = [
        {
          id: 'ruleset-hp',
          name: 'HP Ruleset',
          ui_category: 'foundation',
          exclusion_group: null,
          dependencies: [],
          provides_tags: [],
          state_contributions: {
            tier1_entity: ['stats.hp'],
          },
          actions: {},
          ai_instructions: {},
        },
        {
          id: 'ruleset-mana',
          name: 'Mana Ruleset',
          ui_category: 'expansion',
          exclusion_group: null,
          dependencies: [],
          provides_tags: [],
          state_contributions: {
            tier1_entity: ['stats.mana'],
          },
          actions: {},
          ai_instructions: {},
        },
      ];

      const result = await compiler.compileStory(
        { worldId: world.id, rulesetIds: ['ruleset-hp', 'ruleset-mana'] },
        world,
        rulesets
      );

      expect(result.master_schema.tier1_allowlist).toContain('stats.hp');
      expect(result.master_schema.tier1_allowlist).toContain('stats.mana');
      expect(result.master_schema.tier1_allowlist.length).toBe(2);
    });

    it('should handle tier1_entity as object with definitions', async () => {
      const world: WorldDefinition = {
        id: 'world-1',
        name: 'Test World',
        description: 'Test',
        images: [],
        character_schema_extensions: {},
        lore_fragments: [],
      };

      const rulesets: RulesetDefinition[] = [
        {
          id: 'ruleset-complex',
          name: 'Complex Ruleset',
          ui_category: 'foundation',
          exclusion_group: null,
          dependencies: [],
          provides_tags: [],
          state_contributions: {
            tier1_entity: {
              definitions: {
                hp: { value: 100 },
                stamina: { value: 50 },
              },
            },
          },
          actions: {},
          ai_instructions: {},
        },
      ];

      const result = await compiler.compileStory(
        { worldId: world.id, rulesetIds: ['ruleset-complex'] },
        world,
        rulesets
      );

      expect(result.master_schema.tier1_allowlist).toContain('hp');
      expect(result.master_schema.tier1_allowlist).toContain('stamina');
    });
  });

  describe('Test C: Output Schema Validation', () => {
    it('should produce valid CompiledStory output', async () => {
      const world: WorldDefinition = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test World',
        description: 'Test',
        images: [],
        character_schema_extensions: {},
        lore_fragments: [
          '550e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440002',
        ],
      };

      const rulesets: RulesetDefinition[] = [
        {
          id: 'ruleset-1',
          name: 'Test Ruleset',
          ui_category: 'foundation',
          exclusion_group: null,
          dependencies: [],
          provides_tags: [],
          state_contributions: {
            tier1_entity: ['stats.hp'],
            tier0_narrative: ['memory_stream'],
          },
          actions: {
            attack: 'Perform an attack action',
            defend: 'Perform a defend action',
          },
          ai_instructions: {
            combat_style: 'aggressive',
          },
        },
      ];

      const result = await compiler.compileStory(
        { worldId: world.id, rulesetIds: ['ruleset-1'] },
        world,
        rulesets
      );

      // Validate against Zod schema
      const validated = CompiledStorySchema.parse(result);
      expect(validated).toBeDefined();

      // Check structure
      expect(validated.meta.source_ids).toContain(world.id);
      expect(validated.meta.source_ids).toContain('ruleset-1');
      expect(validated.master_schema.tier1_allowlist).toContain('stats.hp');
      expect(validated.master_schema.tier0_allowlist).toContain('memory_stream');
      expect(validated.master_schema.actions_map).toHaveProperty('attack');
      expect(validated.master_schema.actions_map).toHaveProperty('defend');
      expect(validated.narrative_index).toHaveLength(2);
      expect(validated.initial_state).toHaveProperty('tier1_mechanical');
      expect(validated.initial_state).toHaveProperty('tier0_narrative');
    });
  });

  describe('Dependency Validation', () => {
    it('should throw MISSING_DEPENDENCY when a required dependency is missing', async () => {
      const world: WorldDefinition = {
        id: 'world-1',
        name: 'Test World',
        description: 'Test',
        images: [],
        character_schema_extensions: {},
        lore_fragments: [],
      };

      const rulesets: RulesetDefinition[] = [
        {
          id: 'ruleset-dependent',
          name: 'Dependent Ruleset',
          ui_category: 'expansion',
          exclusion_group: null,
          dependencies: ['ruleset-foundation'], // Requires foundation
          provides_tags: [],
          state_contributions: {},
          actions: {},
          ai_instructions: {},
        },
        // Note: ruleset-foundation is NOT in the selection
      ];

      await expect(
        compiler.compileStory(
          { worldId: world.id, rulesetIds: ['ruleset-dependent'] },
          world,
          rulesets
        )
      ).rejects.toThrow(CompilerError);

      try {
        await compiler.compileStory(
          { worldId: world.id, rulesetIds: ['ruleset-dependent'] },
          world,
          rulesets
        );
        expect.fail('Should have thrown CompilerError');
      } catch (error) {
        expect(error).toBeInstanceOf(CompilerError);
        expect((error as CompilerError).code).toBe('MISSING_DEPENDENCY');
        expect((error as CompilerError).message).toContain('ruleset-foundation');
      }
    });

    it('should allow compilation when all dependencies are satisfied', async () => {
      const world: WorldDefinition = {
        id: 'world-1',
        name: 'Test World',
        description: 'Test',
        images: [],
        character_schema_extensions: {},
        lore_fragments: [],
      };

      const rulesets: RulesetDefinition[] = [
        {
          id: 'ruleset-foundation',
          name: 'Foundation Ruleset',
          ui_category: 'foundation',
          exclusion_group: null,
          dependencies: [],
          provides_tags: [],
          state_contributions: {},
          actions: {},
          ai_instructions: {},
        },
        {
          id: 'ruleset-dependent',
          name: 'Dependent Ruleset',
          ui_category: 'expansion',
          exclusion_group: null,
          dependencies: ['ruleset-foundation'],
          provides_tags: [],
          state_contributions: {},
          actions: {},
          ai_instructions: {},
        },
      ];

      const result = await compiler.compileStory(
        { worldId: world.id, rulesetIds: ['ruleset-foundation', 'ruleset-dependent'] },
        world,
        rulesets
      );

      expect(result).toBeDefined();
      expect(result.meta.source_ids).toContain('ruleset-foundation');
      expect(result.meta.source_ids).toContain('ruleset-dependent');
    });
  });

  describe('Initial State Generation', () => {
    it('should generate initial_state.tier1_mechanical from ruleset definitions', async () => {
      const world: WorldDefinition = {
        id: 'world-1',
        name: 'Test World',
        description: 'Test',
        images: [],
        character_schema_extensions: {},
        lore_fragments: [],
      };

      const rulesets: RulesetDefinition[] = [
        {
          id: 'ruleset-hp',
          name: 'HP Ruleset',
          ui_category: 'foundation',
          exclusion_group: null,
          dependencies: [],
          provides_tags: [],
          state_contributions: {
            tier1_entity: {
              definitions: {
                hp: { value: 100 },
                stamina: { value: 50 },
              },
            },
          },
          actions: {},
          ai_instructions: {},
        },
      ];

      const result = await compiler.compileStory(
        { worldId: world.id, rulesetIds: ['ruleset-hp'] },
        world,
        rulesets
      );

      expect(result.initial_state.tier1_mechanical).toBeDefined();
      const tier1 = result.initial_state.tier1_mechanical as Record<string, unknown>;
      expect(tier1.hp).toBe(100);
      expect(tier1.stamina).toBe(50);
    });

    it('should initialize tier0_narrative with empty arrays', async () => {
      const world: WorldDefinition = {
        id: 'world-1',
        name: 'Test World',
        description: 'Test',
        images: [],
        character_schema_extensions: {},
        lore_fragments: [],
      };

      const rulesets: RulesetDefinition[] = [
        {
          id: 'ruleset-1',
          name: 'Test Ruleset',
          ui_category: 'foundation',
          exclusion_group: null,
          dependencies: [],
          provides_tags: [],
          state_contributions: {},
          actions: {},
          ai_instructions: {},
        },
      ];

      const result = await compiler.compileStory(
        { worldId: world.id, rulesetIds: ['ruleset-1'] },
        world,
        rulesets
      );

      expect(result.initial_state.tier0_narrative).toBeDefined();
      const tier0 = result.initial_state.tier0_narrative as Record<string, unknown>;
      expect(Array.isArray(tier0.memory_stream)).toBe(true);
      expect(Array.isArray(tier0.active_quests)).toBe(true);
      expect((tier0.memory_stream as unknown[]).length).toBe(0);
      expect((tier0.active_quests as unknown[]).length).toBe(0);
    });
  });

  describe('World Extensions Merging', () => {
    it('should merge world character_schema_extensions onto base character', async () => {
      const world: WorldDefinition = {
        id: 'world-1',
        name: 'Test World',
        description: 'Test',
        images: [],
        character_schema_extensions: {
          essence_alignment: {
            label: 'Essence Alignment',
            type: 'dropdown',
            options: ['light', 'dark', 'neutral'],
          },
        },
        lore_fragments: [],
      };

      const rulesets: RulesetDefinition[] = [
        {
          id: 'ruleset-1',
          name: 'Test Ruleset',
          ui_category: 'foundation',
          exclusion_group: null,
          dependencies: [],
          provides_tags: [],
          state_contributions: {},
          actions: {},
          ai_instructions: {},
        },
      ];

      const result = await compiler.compileStory(
        { worldId: world.id, rulesetIds: ['ruleset-1'] },
        world,
        rulesets
      );

      // The character schema merging happens internally, but we can verify
      // the compilation succeeded with world extensions
      expect(result).toBeDefined();
      expect(result.meta.source_ids).toContain('world-1');
    });
  });
});

