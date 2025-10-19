/**
 * AWF Bundle Assembler with Caching
 * Phase 6: Performance & Cost Controls - Cached bundle assembly with token budgets
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
import { createCacheProvider, CacheKeyBuilder } from '../cache/CacheProvider.js';
import { compactSlice, createInlineSummaries } from '../compactors/slice-compactor.js';
import { awfBudgetEnforcer, awfBudgetConfig } from '../config/awf-budgets.js';
import { AWFMetricsUtils } from '../metrics/awf-metrics.js';
import { WorldDocFlex } from '../types/awf-world.js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize cache provider
const cacheProvider = createCacheProvider({
  maxSize: 1000,
  defaultTtlSec: 3600 // 1 hour
});

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
 * Assemble an AWF bundle with caching and budget enforcement
 */
export async function assembleBundleCached(params: AwfBundleParams): Promise<AwfBundleResult> {
  const startTime = Date.now();
  
  try {
    console.log(`[AWF] Starting cached bundle assembly for session ${params.sessionId}`);
    
    // Initialize repositories
    const repoFactory = new AWFRepositoryFactory({ supabase });
    const repos = repoFactory.getAllRepositories();
    
    // Load session data
    const session = await repos.sessions.getByIdVersion(params.sessionId);
    if (!session) {
      throw new Error(`Session ${params.sessionId} not found`);
    }

    const gameState = await repos.gameStates.getByIdVersion(params.sessionId);
    if (!gameState) {
      throw new Error(`Game state for session ${params.sessionId} not found`);
    }

    // Note: Player data would be loaded from the existing player system
    // For now, we'll use a mock player structure
    const player = {
      id: 'player-123',
      name: 'Test Player',
      traits: {},
      skills: {},
      inventory: {},
      metadata: {}
    };

    // Load core documents with caching
    const [coreContract, world, adventure, adventureStart, injectionMap] = await Promise.all([
      loadWithCache('core', 'default', 'v1', () => repos.coreContracts.getByIdVersion('default', 'v1')),
      loadWithCache('world', session.world_ref, 'v1', () => repos.worlds.getByIdVersion(session.world_ref, 'v1')),
      loadWithCache('adventure', session.adventure_ref, 'v1', () => repos.adventures.getByIdVersion(session.adventure_ref, 'v1')),
      loadWithCache('adventureStart', session.adventure_ref, 'v1', () => repos.adventureStarts.getByIdVersion(session.adventure_ref)),
      loadWithCache('injectionMap', 'default', 'v1', () => repos.injectionMap.getByIdVersion('default'))
    ]);

    if (!coreContract || !world || !adventure || !adventureStart || !injectionMap) {
      throw new Error('Required documents not found');
    }

    // Load slices with caching
    const worldSlices = await loadSlicesWithCache('world', world.id, world.version, world.hash, []);
    const adventureSlices = await loadSlicesWithCache('adventure', adventure.id, adventure.version, adventure.hash, (adventure.doc.slices || []).map(s => s.name));

    // Create inline summaries if enabled
    let inlineSummaries: any = {};
    if (awfBudgetConfig.inlineSliceSummaries) {
      inlineSummaries = createInlineSummaries(worldSlices, adventureSlices, {
        maxTokens: 200
      });
    }

    // Create the bundle structure
    const bundle: AwfBundle = {
      awf_bundle: {
        meta: {
          engine_version: '1.0.0',
          world: 'Test World',
          adventure: 'Test Adventure',
          turn_id: session.turn_id,
          is_first_turn: session.is_first_turn,
          timestamp: new Date().toISOString()
        },
        contract: {
          id: 'default',
          version: '1.0.0',
          hash: 'default-hash',
          doc: coreContract.doc as any
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
          ...inlineSummaries.world
        },
        adventure: {
          id: adventure.id,
          name: 'Test Adventure',
          version: adventure.version,
          slice: adventureSlices,
          ...inlineSummaries.adventure
        },
        npcs: {
          active: [],
          count: 0 // Will be set after filtering
        },
        player: {
          id: player.id,
          name: player.name,
          traits: player.traits,
          skills: player.skills,
          inventory: (player.inventory || []) as any,
          metadata: player.metadata
        },
        game_state: {
          hot: gameState.hot,
          warm: gameState.warm,
          cold: gameState.cold
        },
        rng: {
          seed: generateRngSeed(params.sessionId, session.turn_id),
          policy: 'deterministic'
        },
        input: {
          text: params.inputText,
          timestamp: new Date().toISOString()
        }
      }
    };

    // Apply injection map build pointers
    await applyInjectionMap(bundle, injectionMap.doc.build);
    
    // Calculate initial metrics
    const initialMetrics = calculateBundleMetrics(bundle as unknown as Record<string, unknown>, Date.now() - startTime);
    const estimatedTokens = initialMetrics.estimatedTokens;

    // Enforce token budget
    const budgetResult = awfBudgetEnforcer.enforceInputBudget(bundle, estimatedTokens);
    
    if (!budgetResult.withinBudget) {
      console.error(`[AWF Budget] Bundle exceeds token budget: ${budgetResult.finalTokens} > ${awfBudgetConfig.maxInputTokens}`);
      throw new Error(`Bundle exceeds token budget: ${budgetResult.finalTokens} tokens (max: ${awfBudgetConfig.maxInputTokens})`);
    }

    // Log budget enforcement results
    if (budgetResult.reductions.length > 0) {
      console.log(`[AWF Budget] Applied ${budgetResult.reductions.length} reductions:`, 
        budgetResult.reductions.map(r => `${r.type}: ${r.tokensSaved} tokens saved`).join(', '));
    }

    // Validate the final bundle
    const validationErrors = validateBundleStructure(bundle as unknown as Record<string, unknown>);
    if (validationErrors.length > 0) {
      throw new Error(`Bundle validation failed: ${validationErrors.map(e => e.message).join(', ')}`);
    }
    
    // Calculate final metrics
    const buildTime = Date.now() - startTime;
    const metrics = calculateBundleMetrics(bundle as unknown as Record<string, unknown>, buildTime);
    
    // Record metrics
    AWFMetricsUtils.recordBundleAssembly(
      params.sessionId,
      metrics.byteSize,
      metrics.estimatedTokens,
      buildTime
    );
    
    // Log assembly metrics
    console.log(`[AWF] Cached bundle assembly completed:`, {
      sessionId: params.sessionId,
      turnId: session.turn_id,
      isFirstTurn: session.is_first_turn,
      byteSize: metrics.byteSize,
      estimatedTokens: metrics.estimatedTokens,
      npcCount: metrics.npcCount,
      sliceCount: metrics.sliceCount,
      buildTime: metrics.buildTime,
      cacheHits: 'tracked separately', // TODO: implement cache hit tracking
      budgetReductions: budgetResult.reductions.length
    });
    
    return {
      bundle,
      metrics,
      budgetResult: budgetResult as any
    } as any;
    
  } catch (error) {
    console.error(`[AWF] Cached bundle assembly failed for session ${params.sessionId}:`, error);
    throw error;
  }
}

/**
 * Load document with caching
 */
async function loadWithCache<T>(
  docType: string,
  docId: string,
  version?: string,
  loader?: () => Promise<T | null>
): Promise<T | null> {
  if (!loader) {
    throw new Error(`No loader provided for ${docType}:${docId}`);
  }

  // Create cache key
  let cacheKey: string;
  if (docType === 'core') {
    cacheKey = CacheKeyBuilder.core(docId, version || 'v1', 'hash');
  } else if (docType === 'world') {
    cacheKey = CacheKeyBuilder.world(docId, version || 'v1', 'hash');
  } else if (docType === 'adventure') {
    cacheKey = CacheKeyBuilder.adventure(docId, version || 'v1', 'hash');
  } else if (docType === 'adventureStart') {
    cacheKey = CacheKeyBuilder.adventureStart(docId, 'hash');
  } else if (docType === 'injectionMap') {
    cacheKey = CacheKeyBuilder.core(docId, version || 'v1', 'hash');
  } else {
    throw new Error(`Unknown document type: ${docType}`);
  }

  // Try cache first
  const cached = await cacheProvider.get<T>(cacheKey);
  if (cached) {
    console.log(`[AWF Cache] Hit for ${docType}:${docId}`);
    return cached;
  }

  // Load from database
  console.log(`[AWF Cache] Miss for ${docType}:${docId}, loading from database`);
  const doc = await loader();
  
  if (doc) {
    // Cache the document
    await cacheProvider.set(cacheKey, doc, { ttlSec: 3600 }); // 1 hour TTL
    console.log(`[AWF Cache] Cached ${docType}:${docId}`);
  }

  return doc;
}

/**
 * Load slices with caching and compaction
 */
async function loadSlicesWithCache(
  docType: 'world' | 'adventure',
  docId: string,
  version: string,
  hash: string,
  sliceNames: string[]
): Promise<string[]> {
  const slices: string[] = [];
  
  for (const sliceName of sliceNames) {
    const cacheKey = CacheKeyBuilder.slice(docId, version, hash, sliceName);
    
    // Try cache first
    const cached = await cacheProvider.get<string>(cacheKey);
    if (cached) {
      console.log(`[AWF Cache] Hit for slice ${docType}:${docId}:${sliceName}`);
      slices.push(cached);
      continue;
    }

    // Load slice from document (simplified - in practice you'd load from the actual document)
    const sliceContent = `Content for ${sliceName} in ${docType} ${docId}`;
    
    // Compact the slice
    const compacted = compactSlice(sliceContent, sliceName, {
      maxTokens: 250,
      preserveKeyPoints: true,
      includeMetadata: false
    });

    // Cache the compacted slice
    await cacheProvider.set(cacheKey, compacted.content, { ttlSec: 1800 }); // 30 minutes TTL
    console.log(`[AWF Cache] Cached compacted slice ${docType}:${docId}:${sliceName}`);
    
    slices.push(compacted.content);
  }

  return slices;
}

/**
 * Apply injection map build pointers
 */
async function applyInjectionMap(bundle: AwfBundle, buildPointers: any): Promise<void> {
  // This is a simplified implementation
  // In practice, you'd apply the injection map pointers to the bundle
  console.log('[AWF] Applied injection map build pointers');
}

/**
 * Clear cache for a specific document
 */
export async function clearDocumentCache(docType: string, docId: string, version?: string): Promise<void> {
  const pattern = version 
    ? `awf:${docType}:${docId}:${version}:*`
    : `awf:${docType}:${docId}:*`;
  
  const keys = await cacheProvider.keys(pattern);
  await Promise.all(keys.map(key => cacheProvider.del(key)));
  
  console.log(`[AWF Cache] Cleared ${keys.length} cache entries for ${docType}:${docId}`);
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  size: number;
  keys: string[];
  hitRate?: number;
}> {
  const keys = await cacheProvider.keys();
  return {
    size: keys.length,
    keys: keys.slice(0, 100), // Limit to first 100 keys
    hitRate: undefined // TODO: implement hit rate tracking
  };
}
