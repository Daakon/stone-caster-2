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
import { 
  getSlicesForScene, 
  getDefaultWorldSlices, 
  getDefaultAdventureSlices 
} from '../policies/scene-slice-policy.js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

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
    
    // Load session data
    const session = await repos.sessions.getByIdVersion(params.sessionId);
    if (!session) {
      throw new Error(`Session ${params.sessionId} not found`);
    }
    
    // Load game state
    const gameState = await repos.gameStates.getByIdVersion(params.sessionId);
    if (!gameState) {
      throw new Error(`Game state for session ${params.sessionId} not found`);
    }
    
    // Load core contract (active)
    const coreContract = await repos.coreContracts.getActive('default');
    if (!coreContract) {
      throw new Error('No active core contract found');
    }
    
    // Load world
    const world = await repos.worlds.getByIdVersion(session.world_ref, 'v1');
    if (!world) {
      throw new Error(`World ${session.world_ref} not found`);
    }
    
    // Load adventure
    const adventure = await repos.adventures.getByIdVersion(session.adventure_ref, 'v1');
    if (!adventure) {
      throw new Error(`Adventure ${session.adventure_ref} not found`);
    }
    
    // Load adventure start (optional)
    const adventureStart = await repos.adventureStarts.getByAdventureRef(session.adventure_ref);
    
    // Load injection map
    const injectionMap = await repos.injectionMap.getByIdVersion('default');
    if (!injectionMap) {
      throw new Error('Default injection map not found');
    }
    
    // Load player data (from existing character system)
    const player = await loadPlayerData(session.player_id);
    
    // Load NPCs (from adventure or game state)
    const npcs = await loadNpcData(adventure, gameState);
    
    // Determine current scene for slice selection
    const currentScene = gameState.hot.scene as string | undefined;
    
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
          world: session.world_ref,
          adventure: session.adventure_ref,
          turn_id: session.turn_id,
          is_first_turn: session.is_first_turn,
          locale: session.locale || 'en-US',
          timestamp: new Date().toISOString(),
        },
        contract: {
          id: coreContract.id,
          version: coreContract.version,
          hash: coreContract.hash,
          doc: coreContract.doc as unknown as Record<string, unknown>,
        },
        world: {
          ref: world.id,
          hash: world.hash,
          slice: worldSlices,
        },
        adventure: {
          ref: adventure.id,
          hash: adventure.hash,
          slice: adventureSlices,
          start_hint: session.is_first_turn && adventureStart ? {
            scene: adventureStart.doc.start.scene,
            description: adventureStart.doc.start.description || '',
            initial_state: adventureStart.doc.start.initial_state,
          } : undefined,
        },
        npcs: {
          active: filterActiveNpcs(npcs, 5),
          count: Math.min(npcs.length, 5),
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
          hot: gameState.hot,
          warm: gameState.warm,
          cold: gameState.cold,
        },
        rng: {
          seed: generateRngSeed(params.sessionId, session.turn_id),
          policy: 'deterministic',
        },
        input: {
          text: params.inputText,
          timestamp: new Date().toISOString(),
        },
      },
    };
    
    // Apply injection map build pointers
    await applyInjectionMap(bundle, injectionMap.doc.build, coreContract);
    
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
      turnId: session.turn_id,
      isFirstTurn: session.is_first_turn,
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
  adventure: any,
  gameState: any
): Promise<Array<{
  id: string;
  name: string;
  description: string;
  role: string;
  location?: string;
  metadata?: Record<string, unknown>;
}>> {
  const npcs: Array<{
    id: string;
    name: string;
    description: string;
    role: string;
    location?: string;
    metadata?: Record<string, unknown>;
  }> = [];
  
  // Add NPCs from adventure
  if (adventure.doc.npcs && Array.isArray(adventure.doc.npcs)) {
    for (const npc of adventure.doc.npcs) {
      npcs.push({
        id: npc.id || `npc_${npcs.length}`,
        name: npc.name || 'Unknown NPC',
        description: npc.description || '',
        role: npc.role || 'unknown',
        location: npc.location,
        metadata: npc.metadata,
      });
    }
  }
  
  // Add NPCs from game state (if any)
  if (gameState.hot.npcs && Array.isArray(gameState.hot.npcs)) {
    for (const npc of gameState.hot.npcs) {
      npcs.push({
        id: npc.id || `state_npc_${npcs.length}`,
        name: npc.name || 'Unknown NPC',
        description: npc.description || '',
        role: npc.role || 'unknown',
        location: npc.location,
        metadata: npc.metadata,
      });
    }
  }
  
  return npcs;
}

/**
 * Apply injection map build pointers to the bundle
 * @param bundle - Bundle to modify
 * @param buildPointers - Build pointers from injection map
 * @param coreContract - Core contract data for injection
 */
async function applyInjectionMap(
  bundle: AwfBundle,
  buildPointers: Record<string, string>,
  coreContract: any
): Promise<void> {
  for (const [key, pointer] of Object.entries(buildPointers)) {
    try {
      // Handle core contract specific injections
      if (pointer === 'core_contracts.active.doc.contract') {
        setAtPointer(bundle as unknown as Record<string, unknown>, `/awf_bundle/${key}`, coreContract.doc.contract);
      } else if (pointer === 'core_contracts.active.doc.rules') {
        setAtPointer(bundle as unknown as Record<string, unknown>, `/awf_bundle/${key}`, coreContract.doc.rules);
      } else {
        // For other pointers, use the pointer as a direct path
        setAtPointer(bundle as unknown as Record<string, unknown>, `/awf_bundle/${key}`, pointer);
      }
    } catch (error) {
      console.warn(`[AWF] Failed to apply injection map pointer ${key}: ${pointer}`, error);
    }
  }
}
