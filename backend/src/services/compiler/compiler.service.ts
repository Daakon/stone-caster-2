/**
 * Compiler Service
 * Phase 4: The Compiler Engine (Backend)
 * 
 * Implements the 4-Step Process:
 * 1. Base Load & Injection: Load base character, merge world extensions
 * 2. Resolution (Validation): Check dependencies and exclusions
 * 3. Master Schema Construction: Build allowlists and actions_map
 * 4. Initial State Factory: Generate initial game state
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { RulesetDefinition, WorldDefinition } from '@shared/types/chimera-authoring';
import type { CompiledStory } from '@shared/types/chimera-compiled';
import { CompiledStorySchema } from '@shared/types/chimera-compiled';

export interface CompileStoryRequest {
  worldId: string;
  rulesetIds: string[];
}

export class CompilerError extends Error {
  constructor(
    public readonly code: 'MISSING_DEPENDENCY' | 'EXCLUSION_CONFLICT' | 'WORLD_NOT_FOUND' | 'RULESET_NOT_FOUND' | 'INVALID_STATE',
    message: string
  ) {
    super(message);
    this.name = 'CompilerError';
  }
}

export class CompilerService {
  /**
   * Compile a story from world and ruleset selections
   * Follows the 4-step deterministic process
   */
  async compileStory(
    request: CompileStoryRequest,
    world: WorldDefinition,
    rulesets: RulesetDefinition[]
  ): Promise<CompiledStory> {
    // Step 1: Base Load & Injection
    const baseCharacter = this.loadBaseCharacter();
    const characterSchema = this.mergeWorldExtensions(baseCharacter, world);

    // Step 2: Resolution (Validation)
    this.validateDependencies(rulesets, request.rulesetIds);
    this.validateExclusions(rulesets);

    // Step 3: Master Schema Construction
    const masterSchema = this.buildMasterSchema(rulesets);

    // Step 4: Initial State Factory
    const initialState = this.generateInitialState(rulesets, masterSchema.tier1_allowlist);

    // Build narrative index from world lore fragments
    const narrativeIndex = (world.lore_fragments || []).map((id) => ({
      id,
      tags: [], // Tags would come from lore fragment data if available
    }));

    // Construct CompiledStory
    const compiledStory: CompiledStory = {
      meta: {
        source_ids: [world.id, ...request.rulesetIds],
      },
      master_schema: {
        tier1_allowlist: Array.from(masterSchema.tier1_allowlist),
        tier0_allowlist: Array.from(masterSchema.tier0_allowlist),
        actions_map: masterSchema.actions_map,
      },
      narrative_index: narrativeIndex,
      initial_state: initialState,
    };

    // Validate against schema
    const validated = CompiledStorySchema.parse(compiledStory);
    return validated;
  }

  /**
   * Step 1: Load base character and merge world extensions
   */
  private loadBaseCharacter(): Record<string, unknown> {
    try {
      // Try to load from content/system/base_character.json
      const basePath = join(process.cwd(), 'content', 'system', 'base_character.json');
      const content = readFileSync(basePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      // Fallback to default structure if file doesn't exist
      return {
        core_identity: {
          name: { label: 'Name', type: 'text' },
          pronouns: { label: 'Pronouns', type: 'text', default: 'they/them' },
          role: { label: 'Role / Occupation', type: 'text' },
          age: { label: 'Age', type: 'number' },
        },
        narrative_profile: {
          appearance: { label: 'Appearance', type: 'textarea' },
          backstory: { label: 'Origin & Backstory', type: 'textarea' },
          personality_traits: { label: 'Personality Traits', type: 'tags_input' },
          drive: { label: 'Primary Goal / Ideal', type: 'text' },
          flaw: { label: 'Major Flaw / Weakness', type: 'text' },
        },
      };
    }
  }

  /**
   * Merge world character_schema_extensions onto base character
   */
  private mergeWorldExtensions(
    baseCharacter: Record<string, unknown>,
    world: WorldDefinition
  ): Record<string, unknown> {
    return {
      ...baseCharacter,
      ...world.character_schema_extensions,
    };
  }

  /**
   * Step 2: Validate dependencies
   * Throws MISSING_DEPENDENCY if any ruleset depends on a missing ruleset
   */
  private validateDependencies(rulesets: RulesetDefinition[], selectedIds: string[]): void {
    const selectedSet = new Set(selectedIds);
    const rulesetMap = new Map(rulesets.map((r) => [r.id, r]));

    for (const ruleset of rulesets) {
      for (const depId of ruleset.dependencies || []) {
        if (!selectedSet.has(depId)) {
          const depRuleset = rulesetMap.get(depId);
          const depName = depRuleset?.name || depId;
          throw new CompilerError(
            'MISSING_DEPENDENCY',
            `Ruleset "${ruleset.name}" (${ruleset.id}) depends on "${depName}" (${depId}) which is not in the selection`
          );
        }
      }
    }
  }

  /**
   * Step 2: Validate exclusions
   * Throws EXCLUSION_CONFLICT if multiple rulesets share the same exclusion_group
   */
  private validateExclusions(rulesets: RulesetDefinition[]): void {
    const exclusionGroups = new Map<string, RulesetDefinition[]>();

    for (const ruleset of rulesets) {
      if (ruleset.exclusion_group) {
        const group = ruleset.exclusion_group;
        if (!exclusionGroups.has(group)) {
          exclusionGroups.set(group, []);
        }
        exclusionGroups.get(group)!.push(ruleset);
      }
    }

    for (const [group, conflictingRulesets] of exclusionGroups.entries()) {
      if (conflictingRulesets.length > 1) {
        const names = conflictingRulesets.map((r) => `"${r.name}" (${r.id})`).join(', ');
        throw new CompilerError(
          'EXCLUSION_CONFLICT',
          `Exclusion conflict in group "${group}": Multiple rulesets selected: ${names}`
        );
      }
    }
  }

  /**
   * Step 3: Build master schema from all rulesets
   */
  private buildMasterSchema(rulesets: RulesetDefinition[]): {
    tier1_allowlist: Set<string>;
    tier0_allowlist: Set<string>;
    actions_map: Record<string, string>;
    ai_instructions: Record<string, unknown>;
  } {
    const tier1_allowlist = new Set<string>();
    const tier0_allowlist = new Set<string>();
    const actions_map: Record<string, string> = {};
    const ai_instructions: Record<string, unknown> = {};

    for (const ruleset of rulesets) {
      // Extract tier1_entity keys from state_contributions
      const contributions = ruleset.state_contributions || {};
      
      // Handle tier1_entity - can be array of strings or object with definitions
      if (contributions.tier1_entity) {
        if (Array.isArray(contributions.tier1_entity)) {
          // Array of string keys
          for (const key of contributions.tier1_entity) {
            if (typeof key === 'string') {
              tier1_allowlist.add(key);
            }
          }
        } else if (typeof contributions.tier1_entity === 'object') {
          // Object with definitions - extract keys
          const tier1Obj = contributions.tier1_entity as Record<string, unknown>;
          if (tier1Obj.definitions && typeof tier1Obj.definitions === 'object') {
            const definitions = tier1Obj.definitions as Record<string, unknown>;
            for (const key of Object.keys(definitions)) {
              tier1_allowlist.add(key);
            }
          }
        }
      }

      // Handle tier0_narrative - can be array of strings or object
      if (contributions.tier0_narrative) {
        if (Array.isArray(contributions.tier0_narrative)) {
          for (const key of contributions.tier0_narrative) {
            if (typeof key === 'string') {
              tier0_allowlist.add(key);
            }
          }
        } else if (typeof contributions.tier0_narrative === 'object') {
          const tier0Obj = contributions.tier0_narrative as Record<string, unknown>;
          if (tier0Obj.definitions && typeof tier0Obj.definitions === 'object') {
            const definitions = tier0Obj.definitions as Record<string, unknown>;
            for (const key of Object.keys(definitions)) {
              tier0_allowlist.add(key);
            }
          }
        }
      }

      // Merge actions
      if (ruleset.actions) {
        for (const [actionSlug, actionDef] of Object.entries(ruleset.actions)) {
          // Convert action definition to string if needed
          if (typeof actionDef === 'string') {
            actions_map[actionSlug] = actionDef;
          } else {
            actions_map[actionSlug] = JSON.stringify(actionDef);
          }
        }
      }

      // Aggregate AI instructions
      if (ruleset.ai_instructions) {
        Object.assign(ai_instructions, ruleset.ai_instructions);
      }
    }

    return {
      tier1_allowlist,
      tier0_allowlist,
      actions_map,
      ai_instructions,
    };
  }

  /**
   * Step 4: Generate initial state from rulesets
   */
  private generateInitialState(
    rulesets: RulesetDefinition[],
    tier1Allowlist: Set<string>
  ): Record<string, unknown> {
    const initialState: Record<string, unknown> = {
      tier1_mechanical: {},
      tier0_narrative: {
        memory_stream: [],
        active_quests: [],
      },
    };

    // Generate tier1_mechanical from allowlist
    for (const key of tier1Allowlist) {
      // Find the ruleset that contributes this key
      const contributingRuleset = rulesets.find((r) => {
        const contributions = r.state_contributions || {};
        if (contributions.tier1_entity) {
          if (Array.isArray(contributions.tier1_entity)) {
            return contributions.tier1_entity.includes(key);
          } else if (typeof contributions.tier1_entity === 'object') {
            const tier1Obj = contributions.tier1_entity as Record<string, unknown>;
            if (tier1Obj.definitions && typeof tier1Obj.definitions === 'object') {
              const definitions = tier1Obj.definitions as Record<string, unknown>;
              return key in definitions;
            }
          }
        }
        return false;
      });

      if (contributingRuleset) {
        const contributions = contributingRuleset.state_contributions || {};
        if (contributions.tier1_entity && typeof contributions.tier1_entity === 'object' && !Array.isArray(contributions.tier1_entity)) {
          const tier1Obj = contributions.tier1_entity as Record<string, unknown>;
          if (tier1Obj.definitions && typeof tier1Obj.definitions === 'object') {
            const definitions = tier1Obj.definitions as Record<string, unknown>;
            const def = definitions[key];
            if (def && typeof def === 'object' && 'value' in def) {
              (initialState.tier1_mechanical as Record<string, unknown>)[key] = (def as { value: unknown }).value;
            } else {
              // Default to 0 or empty string if no value specified
              (initialState.tier1_mechanical as Record<string, unknown>)[key] = typeof key === 'string' && key.includes('hp') ? 100 : 0;
            }
          } else {
            // Fallback default
            (initialState.tier1_mechanical as Record<string, unknown>)[key] = 0;
          }
        } else {
          // Fallback default
          (initialState.tier1_mechanical as Record<string, unknown>)[key] = 0;
        }
      } else {
        // Fallback default
        (initialState.tier1_mechanical as Record<string, unknown>)[key] = 0;
      }
    }

    return initialState;
  }
}

