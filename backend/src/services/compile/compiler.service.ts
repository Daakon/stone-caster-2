// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Compiler Service
 * Implements the 4-step compilation process for creating CompiledStory records
 */

import type { RulesetDefinition, WorldDefinition, EntityTemplate, BaseCharacter } from '@shared/types/chimera-authoring';
import { RulesetsRepository } from '../../db/repos/rulesets.repo.js';
import { WorldsRepository } from '../../db/repos/worlds.repo.js';
import { EntitiesRepository } from '../../db/repos/entities.repo.js';
import { CompiledStoriesRepository } from '../../db/repos/compiled-stories.repo.js';

export interface CompileSelection {
  worldId: string;
  rulesetIds: string[];
  entityIds: string[];
}

export interface CompiledStory {
  character_schema: Record<string, unknown>;
  tier1_allowlist: Set<string>;
  tier0_allowlist: Set<string>;
  actions_map: Record<string, unknown>;
  entities: Array<{ id: string; kind: string; raw_data: Record<string, unknown> }>;
  narrative_index: string[]; // Lore fragment IDs
}

export class CompilerService {
  constructor(
    private rulesetsRepo: RulesetsRepository,
    private worldsRepo: WorldsRepository,
    private entitiesRepo: EntitiesRepository,
    private compiledStoriesRepo: CompiledStoriesRepository
  ) {}

  /**
   * Compile a story from a selection of world, rulesets, and entities
   * Implements the 4-step process:
   * 1. Base Load: Load BaseCharacter, merge World.character_schema_extensions
   * 2. Resolution: Validate dependencies and exclusions
   * 3. Master Schema: Build allowlists and actions_map
   * 4. Entity Filter: Filter entity.raw_data keys based on allowlists
   * 5. Save & Return: Create CompiledStory record
   */
  async compile(selection: CompileSelection): Promise<string> {
    // Step 1: Base Load
    const baseCharacter = this.loadBaseCharacter();
    const world = await this.worldsRepo.findById(selection.worldId);
    if (!world) {
      throw new Error(`World not found: ${selection.worldId}`);
    }

    // Start with base character
    let characterSchema = { ...baseCharacter };

    // Merge world.character_schema_extensions (shallow merge for now)
    characterSchema = {
      ...characterSchema,
      ...world.character_schema_extensions,
    };

    // Step 2: Resolution (Validation)
    const rulesets = await this.rulesetsRepo.findByIds(selection.rulesetIds);
    if (rulesets.length !== selection.rulesetIds.length) {
      const foundIds = new Set(rulesets.map((r) => r.id));
      const missingIds = selection.rulesetIds.filter((id) => !foundIds.has(id));
      throw new Error(`Rulesets not found: ${missingIds.join(', ')}`);
    }

    // Merge ruleset character_schema_extensions (deep merge)
    for (const ruleset of rulesets) {
      if (ruleset.character_schema_extensions) {
        characterSchema = this.deepMerge(
          characterSchema,
          ruleset.character_schema_extensions
        );
      }
    }

    // Validate dependencies
    const selectedIds = new Set(selection.rulesetIds);
    for (const ruleset of rulesets) {
      for (const depId of ruleset.dependencies) {
        if (!selectedIds.has(depId)) {
          throw new Error(
            `Ruleset "${ruleset.name}" depends on "${depId}" which is not in the selection`
          );
        }
      }
    }

    // Validate exclusions
    const exclusionGroups = new Map<string, string>(); // group -> rulesetId
    for (const ruleset of rulesets) {
      if (ruleset.exclusion_group) {
        const existing = exclusionGroups.get(ruleset.exclusion_group);
        if (existing) {
          const existingRuleset = rulesets.find((r) => r.id === existing);
          throw new Error(
            `Exclusion conflict: Rulesets "${ruleset.name}" and "${existingRuleset?.name}" share exclusion group "${ruleset.exclusion_group}"`
          );
        }
        exclusionGroups.set(ruleset.exclusion_group, ruleset.id);
      }
    }

    // Step 3: Master Schema
    const tier1_allowlist = new Set<string>();
    const tier0_allowlist = new Set<string>();
    const actions_map: Record<string, unknown> = {};

    for (const ruleset of rulesets) {
      const contributions = ruleset.state_contributions || {};

      // Merge tier1_entity keys
      if (contributions.tier1_entity && Array.isArray(contributions.tier1_entity)) {
        for (const key of contributions.tier1_entity) {
          if (typeof key === 'string') {
            tier1_allowlist.add(key);
          }
        }
      }

      // Merge tier0_narrative keys
      if (contributions.tier0_narrative && Array.isArray(contributions.tier0_narrative)) {
        for (const key of contributions.tier0_narrative) {
          if (typeof key === 'string') {
            tier0_allowlist.add(key);
          }
        }
      }

      // Merge actions
      if (ruleset.actions) {
        Object.assign(actions_map, ruleset.actions);
      }
    }

    // Step 4: Entity Filter
    const entities = await this.entitiesRepo.findByIds(selection.entityIds);
    if (entities.length !== selection.entityIds.length) {
      // Note: entities use 'key' as their id in the template, but we're querying by UUID
      // We need to map back to the original UUIDs
      const foundKeys = new Set(entities.map((e) => e.id));
      // For now, we'll just check if we got the expected count
      // In a production system, you might want to store the mapping
      if (entities.length < selection.entityIds.length) {
        throw new Error(`Some entities were not found. Expected ${selection.entityIds.length}, found ${entities.length}`);
      }
    }

    const filteredEntities = entities.map((entity) => {
      const filteredData: Record<string, unknown> = {};
      const rawData = entity.raw_data || {};

      for (const key of Object.keys(rawData)) {
        // Keep if key is in tier1_allowlist OR tier0_allowlist
        if (tier1_allowlist.has(key) || tier0_allowlist.has(key)) {
          filteredData[key] = rawData[key];
        }
        // Drop if key is unknown (not in either allowlist)
      }

      return {
        id: entity.id,
        kind: entity.kind,
        raw_data: filteredData,
      };
    });

    // Step 5: Save & Return
    const compiledStory: CompiledStory = {
      character_schema: characterSchema,
      tier1_allowlist: tier1_allowlist,
      tier0_allowlist: tier0_allowlist,
      actions_map,
      entities: filteredEntities,
      narrative_index: world.lore_fragments || [],
    };

    // Generate a story key (could be based on selection hash or user-provided)
    const storyKey = this.generateStoryKey(selection);

    const compiledStoryId = await this.compiledStoriesRepo.create(storyKey, compiledStory);

    return compiledStoryId;
  }

  /**
   * Load BaseCharacter JSON
   * For now, returns a default structure. In production, this should load from a file or database.
   */
  private loadBaseCharacter(): BaseCharacter {
    // Default BaseCharacter structure
    // In production, this should be loaded from content/system/base_character.json
    return {
      id: '00000000-0000-0000-0000-000000000000', // System UUID
      name: '',
      identity: {},
      stats: {},
      inventory: [],
    };
  }

  /**
   * Generate a unique story key from the selection
   */
  private generateStoryKey(selection: CompileSelection): string {
    // Simple hash-based key generation
    // In production, you might want a more sophisticated approach
    const parts = [
      selection.worldId.substring(0, 8),
      ...selection.rulesetIds.map((id) => id.substring(0, 8)).sort(),
      ...selection.entityIds.map((id) => id.substring(0, 8)).sort(),
    ];
    return `story-${parts.join('-')}`;
  }

  /**
   * Deep merge two objects, with source taking precedence for conflicts
   * Recursively merges nested objects, but overwrites arrays and primitives
   */
  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>
  ): Record<string, unknown> {
    const result = { ...target };

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key];
        const targetValue = result[key];

        if (
          typeof sourceValue === 'object' &&
          sourceValue !== null &&
          !Array.isArray(sourceValue) &&
          typeof targetValue === 'object' &&
          targetValue !== null &&
          !Array.isArray(targetValue)
        ) {
          // Recursively merge nested objects
          result[key] = this.deepMerge(
            targetValue as Record<string, unknown>,
            sourceValue as Record<string, unknown>
          );
        } else {
          // Overwrite with source value (ruleset extensions override world/base)
          result[key] = sourceValue;
        }
      }
    }

    return result;
  }
}

