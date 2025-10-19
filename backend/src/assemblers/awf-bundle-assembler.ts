/**
 * AWF Bundle Assembler
 * Phase 3: Bundle Assembler - Main bundle assembly logic
 */

import { createClient } from '@supabase/supabase-js';
import { AWFRepositoryFactory } from '../repositories/awf-repository-factory.js';
import { 
  AwfBundle, 
  AwfBundleParams, 
  AwfBundleResult, 
  AwfBundleMetrics,
  AwfBundleValidationError 
} from '../types/awf-bundle.js';
import { AwfBundleSchema } from '../validators/awf-bundle-validators.js';
import { 
  setAtPointer, 
  estimateTokens, 
  generateRngSeed, 
  selectSlices, 
  filterActiveNpcs,
  calculateBundleMetrics,
  validateBundleStructure
} from '../utils/awf-bundle-helpers.js';
import { resolveRulesetRef, parseRulesetRef } from '../utils/awf-ruleset-resolver.js';
import { 
  getSlicesForScene, 
  getDefaultWorldSlices, 
  getDefaultAdventureSlices 
} from '../policies/scene-slice-policy.js';
import { WorldDocFlex } from '../types/awf-world.js';
import { collectNpcRefs } from './npc-collector.js';
import { compactNpcDoc } from './npc-compactor.js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Extract custom world sections (all unknown top-level keys)
 */
function getCustomWorldSections(worldDoc: WorldDocFlex): Record<string, unknown> {
  const knownKeys = new Set([
    'id', 'name', 'version', 'timeworld', 'bands', 'weather_states', 
    'weather_transition_bias', 'lexicon', 'identity_language', 'magic', 
    'essence_behavior', 'species_rules', 'factions_world', 'lore_index', 
    'tone', 'locations', 'slices'
  ]);
  
  const custom: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(worldDoc)) {
    if (!knownKeys.has(key)) {
      custom[key] = value;
    }
  }
  return custom;
}

/**
 * Assemble an AWF bundle for a given session and input
 * @param params - Bundle assembly parameters
 * @returns Assembled bundle with metrics
 */
export async function assembleBundle(params: AwfBundleParams): Promise<AwfBundleResult> {
  const startTime = Date.now();
  
  try {
    console.log(`[AWF] Starting bundle assembly for session ${params.sessionId}`);
    
    // Initialize repositories
    const repoFactory = new AWFRepositoryFactory({ supabase });
    const repos = repoFactory.getAllRepositories();
    
    // Load game data (primary source of truth)
    const game = await repos.gameStates.getByIdVersion(params.sessionId);
    if (!game) {
      throw new Error(`Game ${params.sessionId} not found`);
    }
    
    // Load optional session data (for overrides only)
    const session = await repos.sessions.getByIdVersion(params.sessionId).catch(() => null);
    
    // Resolve ruleset and locale from game meta with optional session overrides
    const { ruleset_ref, locale } = resolveRulesetRef({ 
      game: { state_snapshot: (game as any).state_snapshot }, 
      session: session
    });
    
    // Parse ruleset reference
    const { id: rulesetId, version: rulesetVersion } = parseRulesetRef(ruleset_ref);
    
    // Load core contract (active)
    const coreContract = await repos.coreContracts.getActive('default');
    if (!coreContract) {
      throw new Error('No active core contract found');
    }
    
    // Load core ruleset
    const coreRuleset = await repos.coreRulesets.getByIdVersion(rulesetId, rulesetVersion);
    if (!coreRuleset) {
      throw new Error(`Core ruleset ${ruleset_ref} not found`);
    }
    
    // Load world from game meta
    const worldRef = (game as any).state_snapshot?.meta?.world_ref;
    if (!worldRef) {
      throw new Error('No world_ref found in game.state_snapshot.meta');
    }
    const [worldId, worldVersion] = worldRef.split('@');
    const world = await repos.worlds.getByIdVersion(worldId, worldVersion);
    if (!world) {
      throw new Error(`World ${worldRef} not found`);
    }
    
    // Load adventure from game meta
    const adventureRef = (game as any).state_snapshot?.meta?.adventure_ref;
    if (!adventureRef) {
      throw new Error('No adventure_ref found in game.state_snapshot.meta');
    }
    const [adventureId, adventureVersion] = adventureRef.split('@');
    const adventure = await repos.adventures.getByIdVersion(adventureId, adventureVersion);
    if (!adventure) {
      throw new Error(`Adventure ${adventureRef} not found`);
    }
    
    // Load adventure start (optional)
    const adventureStart = await repos.adventureStarts.getByAdventureRef(adventureRef);
    
    // Load injection map
    const injectionMap = await repos.injectionMap.getByIdVersion('default');
    if (!injectionMap) {
      throw new Error('Default injection map not found');
    }
    
    // Load player data (from existing character system)
    const playerId = (game as any).user_id || (game as any).cookie_group_id;
    if (!playerId) {
      throw new Error('No player_id found in game');
    }
    const player = await loadPlayerData(playerId);
    
    // Load NPCs using new collection system
    const npcs = await loadNpcData(repos, (game as any).state_snapshot, adventure, coreRuleset, locale);
    
    // Determine current scene for slice selection
    const currentScene = (game as any).state_snapshot?.hot?.scene as string | undefined;
    
    // Select slices based on scene or defaults
    const worldSlices = selectSlices(
      currentScene,
      {}, // Scene slice policy will be applied in selectSlices
      getDefaultWorldSlices()
    );
    
    const adventureSlices = selectSlices(
      currentScene,
      {},
      getDefaultAdventureSlices()
    );
    
    // Create the bundle structure
    const bundle: AwfBundle = {
      awf_bundle: {
        meta: {
          engine_version: '1.0.0',
          world: worldRef,
          adventure: adventureRef,
          turn_id: (game as any).turn_count || 1,
          is_first_turn: (game as any).turn_count === 0,
          locale: locale,
          timestamp: new Date().toISOString(),
        },
        contract: {
          id: coreContract.id,
          version: coreContract.version,
          hash: coreContract.hash,
          doc: coreContract.doc as unknown as Record<string, unknown>,
        },
        world: {
          id: world.doc.id,
          name: world.doc.name,
          version: world.doc.version,
          // Include timeworld if present
          ...(world.doc.timeworld && { timeworld: world.doc.timeworld }),
          // Prefer top-level bands, weather_states, weather_transition_bias; fall back to timeworld
          ...(world.doc.bands && { bands: world.doc.bands }),
          ...(world.doc.weather_states && { weather_states: world.doc.weather_states }),
          ...(world.doc.weather_transition_bias && { weather_transition_bias: world.doc.weather_transition_bias }),
          // Include known sections if present
          ...(world.doc.lexicon && { lexicon: world.doc.lexicon }),
          ...(world.doc.identity_language && { identity_language: world.doc.identity_language }),
          ...(world.doc.magic && { magic: world.doc.magic }),
          ...(world.doc.essence_behavior && { essence_behavior: world.doc.essence_behavior }),
          ...(world.doc.species_rules && { species_rules: world.doc.species_rules }),
          ...(world.doc.factions_world && { factions_world: world.doc.factions_world }),
          ...(world.doc.lore_index && { lore_index: world.doc.lore_index }),
          ...(world.doc.tone && { tone: world.doc.tone }),
          ...(world.doc.locations && { locations: world.doc.locations }),
          // Include custom sections (all remaining unknown top-level keys)
          custom: getCustomWorldSections(world.doc),
          slice: worldSlices,
        },
        adventure: {
          ref: adventure.id,
          hash: adventure.hash,
          slice: adventureSlices,
          start_hint: ((game as any).turn_count === 0) && adventureStart ? {
            scene: adventureStart.doc.start.scene,
            description: adventureStart.doc.start.description || '',
            initial_state: adventureStart.doc.start.initial_state,
          } : undefined,
        },
        npcs: {
          active: npcs, // This is now the compact NPC format
          count: npcs.length,
        },
        player: {
          id: player.id,
          name: player.name,
          traits: player.traits,
          skills: player.skills,
          inventory: player.inventory,
          metadata: player.metadata,
        },
        game_state: {
          hot: (game as any).state_snapshot?.hot || {},
          warm: (game as any).state_snapshot?.warm || {},
          cold: (game as any).state_snapshot?.cold || {},
        },
        rng: {
          seed: generateRngSeed(params.sessionId, (game as any).turn_count || 1),
          policy: 'deterministic',
        },
        input: {
          text: params.inputText,
          timestamp: new Date().toISOString(),
        },
      },
    };
    
    // Apply injection map build pointers with environment variables
    const env = {
      ruleset_ref: ruleset_ref,
      locale: locale,
    };
    await applyInjectionMap(bundle, injectionMap.doc.build, coreContract, coreRuleset, npcs, env);
    
    // Validate the bundle
    const validationErrors = validateBundleStructure(bundle as unknown as Record<string, unknown>);
    if (validationErrors.length > 0) {
      throw new Error(`Bundle validation failed: ${validationErrors.map(e => e.message).join(', ')}`);
    }
    
    // Calculate metrics
    const buildTime = Date.now() - startTime;
    const metrics = calculateBundleMetrics(bundle as unknown as Record<string, unknown>, buildTime);
    
    // Log assembly metrics
    console.log(`[AWF] Bundle assembly completed:`, {
      sessionId: params.sessionId,
      turnId: session?.turn_id || 1,
      isFirstTurn: session?.is_first_turn || false,
      byteSize: metrics.byteSize,
      estimatedTokens: metrics.estimatedTokens,
      npcCount: metrics.npcCount,
      sliceCount: metrics.sliceCount,
      buildTime: metrics.buildTime,
    });
    
    return {
      bundle,
      metrics,
    };
    
  } catch (error) {
    console.error(`[AWF] Bundle assembly failed for session ${params.sessionId}:`, error);
    throw error;
  }
}

/**
 * Load player data from existing character system
 * @param playerId - Player ID
 * @returns Player data
 */
async function loadPlayerData(playerId: string | null): Promise<{
  id: string;
  name: string;
  traits: Record<string, unknown>;
  skills: Record<string, unknown>;
  inventory: unknown[];
  metadata?: Record<string, unknown>;
}> {
  if (!playerId) {
    // Return default player data if no player ID
    return {
      id: 'default',
      name: 'Player',
      traits: {},
      skills: {},
      inventory: [],
      metadata: {},
    };
  }
  
  try {
    const { data: character, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', playerId)
      .single();
    
    if (error || !character) {
      console.warn(`[AWF] Character ${playerId} not found, using default player data`);
      return {
        id: playerId,
        name: 'Player',
        traits: {},
        skills: {},
        inventory: [],
        metadata: {},
      };
    }
    
    return {
      id: character.id,
      name: character.name || 'Player',
      traits: character.traits || {},
      skills: character.skills || {},
      inventory: character.inventory || [],
      metadata: character.metadata || {},
    };
  } catch (error) {
    console.error(`[AWF] Error loading player data:`, error);
    return {
      id: playerId,
      name: 'Player',
      traits: {},
      skills: {},
      inventory: [],
      metadata: {},
    };
  }
}

/**
 * Load NPC data from adventure and game state
 * @param adventure - Adventure data
 * @param gameState - Game state data
 * @returns Array of NPCs
 */
async function loadNpcData(
  repos: any,
  gameState: any,
  adventure: any,
  coreRuleset: any,
  locale?: string
): Promise<Array<{
  id: string | null;
  ver: string | null;
  name: string;
  archetype: string | null;
  summary: string;
  style: {
    voice: string | null;
    register: string | null;
  };
  tags: string[];
}>> {
  // Collect NPC refs from multiple sources
  const npcRefs = collectNpcRefs({
    game: gameState,
    adventure: adventure?.doc,
    ruleset: coreRuleset?.doc
  });

  if (npcRefs.length === 0) {
    return [];
  }

  // Parse refs into id@version format
  const npcIds = npcRefs.map(ref => {
    const [id, version] = ref.split('@');
    return { id, version: version || undefined };
  });

  // Fetch NPC documents
  const npcDocs = await repos.npcs.listByIds(npcIds);

  // Compact NPCs for token efficiency
  const compactNpcs = npcDocs.map((doc: any) => {
    const compacted = compactNpcDoc(doc.doc, locale);
    return {
      ...compacted,
      id: doc.id,
      ver: doc.version
    };
  });

  return compactNpcs;
}

/**
 * Apply injection map build pointers to the bundle
 * @param bundle - Bundle to modify
 * @param buildPointers - Build pointers from injection map
 * @param coreContract - Core contract data for injection
 * @param coreRuleset - Core ruleset data for injection
 */
async function applyInjectionMap(
  bundle: AwfBundle,
  buildPointers: Record<string, string>,
  coreContract: any,
  coreRuleset: any,
  npcs: any[],
  env?: Record<string, string>
): Promise<void> {
  for (const [key, pointer] of Object.entries(buildPointers)) {
    try {
      // Handle core contract specific injections
      if (pointer === 'core_contracts.active.doc.contract') {
        setAtPointer(bundle as unknown as Record<string, unknown>, `/awf_bundle/${key}`, coreContract.doc.contract);
      } else if (pointer === 'core_contracts.active.doc.core.acts_catalog') {
        setAtPointer(bundle as unknown as Record<string, unknown>, `/awf_bundle/${key}`, coreContract.doc.core.acts_catalog);
      } else if (pointer === 'core_contracts.active.doc.core.scales') {
        setAtPointer(bundle as unknown as Record<string, unknown>, `/awf_bundle/${key}`, coreContract.doc.core.scales);
      } else if (pointer === 'core_contracts.active.doc.core.budgets') {
        setAtPointer(bundle as unknown as Record<string, unknown>, `/awf_bundle/${key}`, coreContract.doc.core.budgets);
      } else if (pointer.startsWith('core_rulesets[') && pointer.includes('].doc.ruleset')) {
        // Handle ruleset injection: core_rulesets[{env.ruleset_ref}].doc.ruleset
        setAtPointer(bundle as unknown as Record<string, unknown>, `/awf_bundle/${key}`, coreRuleset.doc.ruleset);
      } else if (pointer === 'npcs.by_refs[/scenario/fixed_npcs[*].npc_ref]' || key === 'npcs') {
        // Handle NPC injection: inject compacted NPCs
        setAtPointer(bundle as unknown as Record<string, unknown>, `/awf_bundle/${key}`, npcs);
      } else {
        // For other pointers, use the pointer as a direct path
        setAtPointer(bundle as unknown as Record<string, unknown>, `/awf_bundle/${key}`, pointer);
      }
    } catch (error) {
      console.warn(`[AWF] Failed to apply injection map pointer ${key}: ${pointer}`, error);
    }
  }
}
