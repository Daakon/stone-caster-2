/**
 * Chimera Story Rebuild Service
 * Phase 3: Smart Compiler
 * 
 * Implements the logic for compiling stories from rulesets, entities, and lore
 * into the CompiledStoryJson structure for runtime use.
 */

import { supabaseAdmin } from '../supabase.js';
import type { Request } from 'express';

/**
 * Vectorization function placeholder
 * TODO: Replace with actual vectorization service (e.g., OpenAI embeddings, local model, etc.)
 * 
 * @param text - The text to vectorize
 * @returns A vector (array of numbers) representing the text embedding
 */
function vectorizeText(text: string): number[] {
  // Placeholder: Returns a mock vector
  // In production, this would call an actual embedding service
  // Example: return await openaiEmbeddings.embed(text);
  // For now, return a simple placeholder vector
  return [0.1, 0.2, 0.3]; // Placeholder vector
}

/**
 * CompiledStoryJson structure (from architectural plan)
 */
export interface CompiledStoryJson {
  /**
   * For the ActionResolver & EngineRequestProcessor
   */
  action_context_json: {
    action_rules: Record<string, unknown>;
    elements: Record<string, unknown>;
  };

  /**
   * For MAS 2 (Narrative)
   * Contains all merged AI instructions and the RAG index
   */
  narrative_context_json: {
    /**
     * Merged list of narrative_prompt_rules + narrator_guardrails
     */
    prompt_rules_with_guardrails: string[];
    /**
     * The vector index of all Lore + Entity narrative_keys
     * Array of vectors (number[][]) - each vector represents an embedded text
     */
    rag_index: number[][];
  };

  /**
   * For MAS 1 (Parser)
   */
  parser_context_json: {
    prompt_rules: string[];
    available_actions: string[];
    available_entities: string[];
  };

  /**
   * For Game State Initialization
   */
  final_state_schema: Record<string, unknown>;
}

/**
 * RulesetDefinitionV1 structure (from architectural plan)
 */
interface RulesetDefinitionV1 {
  /**
   * Part 1: How to sort data (for the Compiler)
   */
  key_definitions?: {
    /**
     * Keys for the Engine (e.g., "health", "mana", "skill_lockpicking")
     */
    state_keys?: string[];
    /**
     * Keys for the AI (e.g., "backstory", "personality", "description")
     */
    narrative_keys?: string[];
  };

  /**
   * Part 2: How to build the state (for the Compiler)
   */
  state_schema_contributions?: {
    tier0_tracked_state?: Record<string, unknown>;
    tier1_singular_state?: Record<string, unknown>;
    tier2_relational_state?: Record<string, unknown>;
  };

  /**
   * Part 3: How to run the game (for the Engine)
   */
  action_rules?: Record<string, unknown>;

  /**
   * Part 4: How to talk to the AI (for the Engine)
   */
  prompt_rules?: {
    /**
     * Instructions for MAS 1 (e.g., "Actions available: pick_lock, attack...")
     */
    parser_prompt_rules?: string[];
    /**
     * Instructions for MAS 2 (e.g., "Essence alignment affects behavior...")
     */
    narrative_prompt_rules?: string[];
    /**
     * Hard "DON'T" rules for MAS 2
     * e.g., "NEVER narrate a new action, decision, or dialogue for the player."
     */
    narrator_guardrails?: string[];
  };

  /**
   * Part 5: How to build the UI (for the Client)
   */
  ui_schema?: Record<string, unknown>;
}

interface RulesetTemplate {
  id: string;
  rule_type: 'MAIN_SYSTEM' | 'SUBSYSTEM' | 'MODIFIER';
  main_system_dependency: string | null;
  definition: RulesetDefinitionV1;
  version: number;
}

interface EntityTemplate {
  id: string;
  base_state_json: Record<string, unknown>;
  display_name: string;
  entity_type: string;
}

interface LoreEntry {
  id: string;
  entry_text: string;
  display_name: string;
}

/**
 * Rebuild a story's compiled ruleset
 */
export async function rebuildStory(storyId: string, userId: string): Promise<{
  story_id: string;
  compiled_json: CompiledStoryJson;
  source_manifest: Array<{ id: string; version: number }>;
  last_compiled_at: string;
}> {
  // Step 1: Fetch the story and verify ownership
  const { data: story, error: storyError } = await supabaseAdmin
    .from('chimera_stories')
    .select('id, owner_user_id, world_id')
    .eq('id', storyId)
    .single();

  if (storyError) {
    if (storyError.code === 'PGRST116') {
      throw new Error('Story not found');
    }
    throw new Error(`Failed to fetch story: ${storyError.message}`);
  }

  if (story.owner_user_id !== userId) {
    throw new Error('You do not have permission to rebuild this story');
  }

  // Step 2: Fetch all linked ruleset templates
  const { data: storyLinks, error: storyLinksError } = await supabaseAdmin
    .from('chimera_story_links')
    .select('ruleset_template_id')
    .eq('story_id', storyId);

  if (storyLinksError) {
    throw new Error(`Failed to fetch story links: ${storyLinksError.message}`);
  }

  const storyRulesetIds = (storyLinks || []).map((link) => link.ruleset_template_id);

  // Step 3: Fetch world ruleset_template_ids if story has a world
  let worldRulesetIds: string[] = [];
  if (story.world_id) {
    const { data: worldLinks, error: worldLinksError } = await supabaseAdmin
      .from('chimera_world_ruleset_link')
      .select('ruleset_template_id')
      .eq('world_id', story.world_id);

    if (worldLinksError) {
      throw new Error(`Failed to fetch world links: ${worldLinksError.message}`);
    }

    worldRulesetIds = (worldLinks || []).map((link) => link.ruleset_template_id);
  }

  // Step 4: Fetch content pack links and resolve dependencies
  const { data: packLinks, error: packLinksError } = await supabaseAdmin
    .from('chimera_story_content_pack_links')
    .select('pack_id')
    .eq('story_id', storyId);

  if (packLinksError) {
    throw new Error(`Failed to fetch pack links: ${packLinksError.message}`);
  }

  const packIds = (packLinks || []).map((link) => link.pack_id);
  const allPackIds = new Set<string>(packIds);

  // Resolve all pack dependencies recursively
  if (allPackIds.size > 0) {
    const packsToProcess = Array.from(allPackIds);
    const processedPacks = new Set<string>();

    while (packsToProcess.length > 0) {
      const currentPackId = packsToProcess.pop()!;
      if (processedPacks.has(currentPackId)) continue;
      processedPacks.add(currentPackId);

      const { data: dependencies, error: depsError } = await supabaseAdmin
        .from('chimera_pack_dependencies')
        .select('depends_on_pack_id')
        .eq('pack_id', currentPackId);

      if (!depsError && dependencies) {
        for (const dep of dependencies) {
          if (!allPackIds.has(dep.depends_on_pack_id)) {
            allPackIds.add(dep.depends_on_pack_id);
            packsToProcess.push(dep.depends_on_pack_id);
          }
        }
      }
    }
  }

  // Step 5: Fetch ruleset_template_ids from all content packs
  let packRulesetIds: string[] = [];
  if (allPackIds.size > 0) {
    const { data: packRulesetLinks, error: packRulesetLinksError } = await supabaseAdmin
      .from('chimera_content_pack_ruleset_links')
      .select('ruleset_template_id')
      .in('pack_id', Array.from(allPackIds));

    if (packRulesetLinksError) {
      throw new Error(`Failed to fetch pack ruleset links: ${packRulesetLinksError.message}`);
    }

    packRulesetIds = (packRulesetLinks || []).map((link) => link.ruleset_template_id);
  }

  // Step 6: Get all unique ruleset_template_ids
  const allRulesetIds = Array.from(new Set([...storyRulesetIds, ...worldRulesetIds, ...packRulesetIds]));

  if (allRulesetIds.length === 0) {
    throw new Error('No ruleset templates linked to this story or its world');
  }

  // Step 7: Fetch all ruleset templates with their definitions
  const { data: rulesetTemplates, error: templatesError } = await supabaseAdmin
    .from('chimera_ruleset_templates')
    .select('id, rule_type, main_system_dependency, definition, version')
    .in('id', allRulesetIds);

  if (templatesError) {
    throw new Error(`Failed to fetch ruleset templates: ${templatesError.message}`);
  }

  if (!rulesetTemplates || rulesetTemplates.length === 0) {
    throw new Error('No valid ruleset templates found');
  }

  // Step 8: Build the load order and validate MAIN_SYSTEM
  const mainSystem = rulesetTemplates.find((t) => t.rule_type === 'MAIN_SYSTEM');
  if (!mainSystem) {
    throw new Error('Story must have a MAIN_SYSTEM ruleset template');
  }

  const mainSystemId = mainSystem.id;
  const subsystems = rulesetTemplates.filter(
    (t) => t.rule_type === 'SUBSYSTEM' && t.main_system_dependency === mainSystemId
  );
  const worldModifiers = rulesetTemplates.filter(
    (t) => t.rule_type === 'MODIFIER' && worldRulesetIds.includes(t.id)
  );
  const packModifiers = rulesetTemplates.filter(
    (t) => t.rule_type === 'MODIFIER' && packRulesetIds.includes(t.id)
  );

  // Build load order: MAIN_SYSTEM -> SUBSYSTEM -> MODIFIER
  const loadOrder: RulesetTemplate[] = [
    mainSystem,
    ...subsystems,
    ...worldModifiers,
    ...packModifiers,
  ];

  // Step 9: Merge Forces (Rulesets)
  const finalSchema = mergeRulesets(loadOrder);

  // Step 10: Fetch linked entities
  const { data: entityLinks, error: entityLinksError } = await supabaseAdmin
    .from('chimera_story_entity_links')
    .select('entity_template_id')
    .eq('story_id', storyId);

  if (entityLinksError) {
    throw new Error(`Failed to fetch entity links: ${entityLinksError.message}`);
  }

  const entityIds = (entityLinks || []).map((link) => link.entity_template_id);
  let entities: EntityTemplate[] = [];

  if (entityIds.length > 0) {
    const { data: entityTemplates, error: entitiesError } = await supabaseAdmin
      .from('chimera_entity_templates')
      .select('id, base_state_json, display_name, entity_type')
      .in('id', entityIds);

    if (entitiesError) {
      throw new Error(`Failed to fetch entities: ${entitiesError.message}`);
    }

    entities = (entityTemplates || []) as EntityTemplate[];
  }

  // Step 11: Fetch linked lore entries
  const { data: loreEntries, error: loreError } = await supabaseAdmin
    .from('chimera_lore_entries')
    .select('id, entry_text, display_name')
    .eq('story_id', storyId);

  if (loreError) {
    throw new Error(`Failed to fetch lore entries: ${loreError.message}`);
  }

  const lore = (loreEntries || []) as LoreEntry[];

  // Step 12: Compile Entities ("Smart Sort")
  const compiledEntities = compileEntities(entities, finalSchema);

  // Step 13: Compile Lore
  const compiledLore = compileLore(lore);

  // Step 14: Build CompiledStoryJson
  const compiledJson: CompiledStoryJson = {
    action_context_json: {
      action_rules: finalSchema.action_rules || {},
      elements: compiledEntities.actionElements,
    },
    narrative_context_json: {
      prompt_rules_with_guardrails: finalSchema.narrativePromptRules,
      rag_index: [...compiledLore, ...compiledEntities.narrativeElements],
    },
    parser_context_json: {
      prompt_rules: finalSchema.parserPromptRules,
      available_actions: Object.keys(finalSchema.action_rules || {}),
      available_entities: entities.map((e) => e.id),
    },
    final_state_schema: finalSchema.stateSchema,
  };

  // Step 15: Build source manifest
  const sourceManifest = loadOrder.map((item) => ({
    id: item.id,
    version: item.version,
  }));

  // Step 16: Save to chimera_story_compiled_ruleset (upsert)
  const lastCompiledAt = new Date().toISOString();
  const { data: compiledData, error: saveError } = await supabaseAdmin
    .from('chimera_story_compiled_ruleset')
    .upsert(
      {
        story_id: storyId,
        compiled_json: compiledJson,
        source_manifest: sourceManifest,
        last_compiled_at: lastCompiledAt,
      },
      {
        onConflict: 'story_id',
      }
    )
    .select()
    .single();

  if (saveError) {
    throw new Error(`Failed to save compiled ruleset: ${saveError.message}`);
  }

  return {
    story_id: storyId,
    compiled_json: compiledJson,
    source_manifest: sourceManifest,
    last_compiled_at: compiledData.last_compiled_at,
  };
}

/**
 * Deep merge two objects, with target taking precedence for conflicts
 */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
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
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      } else {
        // Overwrite with source value (later rulesets override earlier ones)
        result[key] = sourceValue;
      }
    }
  }
  
  return result;
}

/**
 * Merge rulesets in priority order
 */
function mergeRulesets(rulesets: RulesetTemplate[]): {
  stateKeys: Set<string>;
  narrativeKeys: Set<string>;
  action_rules: Record<string, unknown>;
  parserPromptRules: string[];
  narrativePromptRules: string[];
  stateSchema: Record<string, unknown>;
} {
  const stateKeys = new Set<string>();
  const narrativeKeys = new Set<string>();
  const actionRules: Record<string, unknown> = {};
  const parserPromptRules: string[] = [];
  const narrativePromptRules: string[] = [];
  const narratorGuardrails: string[] = [];
  const stateSchema: Record<string, unknown> = {
    tier0_tracked_state: {},
    tier1_singular_state: {},
    tier2_relational_state: {},
  };

  // Merge in load order (later rulesets override earlier ones)
  for (const ruleset of rulesets) {
    // Parse definition - handle both object and string cases
    let def: RulesetDefinitionV1 | null = null;
    
    if (!ruleset.definition) {
      console.warn(`[Rebuild] Ruleset ${ruleset.id} has no definition, skipping`);
      continue;
    }
    
    if (typeof ruleset.definition === 'string') {
      try {
        def = JSON.parse(ruleset.definition) as RulesetDefinitionV1;
      } catch (error) {
        console.error(`[Rebuild] Failed to parse definition for ruleset ${ruleset.id}:`, error);
        continue;
      }
    } else if (typeof ruleset.definition === 'object' && ruleset.definition !== null) {
      def = ruleset.definition as RulesetDefinitionV1;
    } else {
      console.warn(`[Rebuild] Ruleset ${ruleset.id} has invalid definition type: ${typeof ruleset.definition}`);
      continue;
    }

    if (!def) {
      continue;
    }

    // Merge key_definitions
    if (def.key_definitions) {
      if (Array.isArray(def.key_definitions.state_keys)) {
        for (const key of def.key_definitions.state_keys) {
          stateKeys.add(key);
        }
      }
      if (Array.isArray(def.key_definitions.narrative_keys)) {
        for (const key of def.key_definitions.narrative_keys) {
          narrativeKeys.add(key);
        }
      }
    }

    // Merge action_rules (deep merge)
    if (def.action_rules && typeof def.action_rules === 'object' && !Array.isArray(def.action_rules)) {
      const merged = deepMerge(actionRules, def.action_rules as Record<string, unknown>);
      // Replace actionRules with merged result
      Object.keys(actionRules).forEach(key => delete actionRules[key]);
      Object.assign(actionRules, merged);
    }

    // Concatenate prompt_rules
    if (def.prompt_rules && typeof def.prompt_rules === 'object') {
      if (Array.isArray(def.prompt_rules.parser_prompt_rules)) {
        parserPromptRules.push(...def.prompt_rules.parser_prompt_rules);
      }
      if (Array.isArray(def.prompt_rules.narrative_prompt_rules)) {
        narrativePromptRules.push(...def.prompt_rules.narrative_prompt_rules);
      }
      if (Array.isArray(def.prompt_rules.narrator_guardrails)) {
        narratorGuardrails.push(...def.prompt_rules.narrator_guardrails);
      }
    }

    // Merge state_schema_contributions (deep merge)
    if (def.state_schema_contributions && typeof def.state_schema_contributions === 'object') {
      const contributions = def.state_schema_contributions;
      
      if (contributions.tier0_tracked_state && typeof contributions.tier0_tracked_state === 'object' && !Array.isArray(contributions.tier0_tracked_state)) {
        stateSchema.tier0_tracked_state = deepMerge(
          stateSchema.tier0_tracked_state as Record<string, unknown>,
          contributions.tier0_tracked_state as Record<string, unknown>
        );
      }
      if (contributions.tier1_singular_state && typeof contributions.tier1_singular_state === 'object' && !Array.isArray(contributions.tier1_singular_state)) {
        stateSchema.tier1_singular_state = deepMerge(
          stateSchema.tier1_singular_state as Record<string, unknown>,
          contributions.tier1_singular_state as Record<string, unknown>
        );
      }
      if (contributions.tier2_relational_state && typeof contributions.tier2_relational_state === 'object' && !Array.isArray(contributions.tier2_relational_state)) {
        stateSchema.tier2_relational_state = deepMerge(
          stateSchema.tier2_relational_state as Record<string, unknown>,
          contributions.tier2_relational_state as Record<string, unknown>
        );
      }
    }
  }

  // Combine narrative_prompt_rules + narrator_guardrails
  const combinedNarrativeRules = [...narrativePromptRules, ...narratorGuardrails];

  return {
    stateKeys,
    narrativeKeys,
    action_rules: actionRules,
    parserPromptRules,
    narrativePromptRules: combinedNarrativeRules,
    stateSchema,
  };
}

/**
 * Compile entities by checking keys against the schema
 * Recursively processes nested objects to find keys that match state_keys or narrative_keys
 */
function compileEntities(
  entities: EntityTemplate[],
  schema: {
    stateKeys: Set<string>;
    narrativeKeys: Set<string>;
  }
): {
  actionElements: Record<string, unknown>;
  narrativeElements: number[][];
} {
  const actionElements: Record<string, unknown> = {};
  const narrativeElements: number[][] = [];

  /**
   * Recursively extract values from an object based on key matching
   */
  function extractValues(
    obj: unknown,
    path: string[] = [],
    stateValues: Record<string, unknown>,
    narrativeValues: string[]
  ): void {
    if (obj === null || obj === undefined) {
      return;
    }

    if (typeof obj === 'object' && !Array.isArray(obj)) {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = [...path, key];
        const fullKey = currentPath.join('.');

        // Check if this key (or any parent key) matches our schema
        if (schema.stateKeys.has(key) || schema.stateKeys.has(fullKey)) {
          // Add to state values
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // Nested object - merge it
            Object.assign(stateValues, { [key]: value });
          } else {
            stateValues[key] = value;
          }
        } else if (schema.narrativeKeys.has(key) || schema.narrativeKeys.has(fullKey)) {
          // Add to narrative values (will be vectorized later)
          if (typeof value === 'string') {
            narrativeValues.push(value);
          } else if (value !== null && value !== undefined) {
            narrativeValues.push(JSON.stringify(value));
          }
        } else {
          // Recursively check nested objects
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            extractValues(value, currentPath, stateValues, narrativeValues);
          }
        }
      }
    }
  }

  for (const entity of entities) {
    const entityData = entity.base_state_json;
    const entityStateValues: Record<string, unknown> = {};
    const entityNarrativeValues: string[] = [];

    // Extract values from the entity's data blob
    extractValues(entityData, [], entityStateValues, entityNarrativeValues);

    // Add state values to action elements
    if (Object.keys(entityStateValues).length > 0) {
      actionElements[entity.id] = {
        ...entityStateValues,
        _meta: {
          display_name: entity.display_name,
          entity_type: entity.entity_type,
        },
      };
    }

    // Vectorize narrative values and add to narrative elements
    for (const narrativeText of entityNarrativeValues) {
      const vector = vectorizeText(narrativeText);
      narrativeElements.push(vector);
    }
  }

  return {
    actionElements,
    narrativeElements,
  };
}

/**
 * Compile lore entries
 * Vectorizes each entry_text and returns an array of vectors
 */
function compileLore(loreEntries: LoreEntry[]): number[][] {
  // Vectorize all entry_text and return as array of vectors
  return loreEntries.map((entry) => vectorizeText(entry.entry_text));
}

