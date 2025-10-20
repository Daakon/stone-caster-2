// Prompt Assembler Core
// Main assembly function that orchestrates the prompt building process

import type { AssembleArgs, AssembleResult, Scope, DbAdapter } from './types';
import { block } from './markdown';
import { estimateTokens, applyTruncationPolicy, createBudgetConfig } from './budget';
import { buildNpcBlock } from './npc';
import { buildStateBlocks } from './state';

// Static order for prompt assembly
const ORDER: Scope[] = [
  'core',
  'ruleset', 
  'world',
  'entry',
  'entry_start',
  'npc',
  'game_state',
  'player',
  'rng',
  'input'
];

/**
 * Main prompt assembly function
 * @param args Assembly arguments
 * @param dbAdapter Database adapter for fetching segments
 * @returns Assembled prompt and metadata
 */
export async function assemblePrompt(
  args: AssembleArgs,
  dbAdapter: DbAdapter
): Promise<AssembleResult> {
  // Initialize metadata tracking
  const segmentIds: Record<Scope, number[]> = {
    core: [],
    ruleset: [],
    world: [],
    entry: [],
    entry_start: [],
    npc: [],
    game_state: [],
    player: [],
    rng: [],
    input: []
  };

  const parts: string[] = [];

  // Fetch and assemble static layers
  await assembleStaticLayers(args, dbAdapter, segmentIds, parts);

  // Handle entry_start (first turn only)
  if (args.isFirstTurn) {
    const entryStartSegments = await dbAdapter.getSegments('entry_start', args.entryPointId);
    if (entryStartSegments.length > 0) {
      segmentIds.entry_start.push(...entryStartSegments.map(s => s.id));
      parts.push(block('entry_start', entryStartSegments.map(s => s.content).join('\n\n')));
    }
  }

  // Build NPC block
  if (args.npcs?.length) {
    const npcResult = await buildNpcBlock(
      args.npcs, 
      args.npcTokenBudget ?? 600, 
      dbAdapter
    );
    
    if (npcResult.body) {
      segmentIds.npc.push(...npcResult.segmentIds);
      parts.push(block('npc', npcResult.body));
    }
  }

  // Build dynamic state blocks
  const stateBlocks = buildStateBlocks(args);
  parts.push(...stateBlocks);

  // Assemble final prompt
  let prompt = parts.join('');

  // Create initial metadata
  const meta: AssembleResult['meta'] = {
    order: ORDER,
    segmentIdsByScope: segmentIds,
    tokensEstimated: estimateTokens(prompt)
  };

  // Apply budget constraints
  const budgetConfig = createBudgetConfig(args.tokenBudget, args.npcTokenBudget);
  const { prompt: finalPrompt, meta: finalMeta } = applyTruncationPolicy(
    prompt,
    budgetConfig,
    meta.truncated || {}
  );

  return {
    prompt: finalPrompt,
    meta: {
      ...meta,
      truncated: finalMeta
    }
  };
}

/**
 * Assembles static layers (core, ruleset, world, entry)
 * @param args Assembly arguments
 * @param dbAdapter Database adapter
 * @param segmentIds Segment ID tracking
 * @param parts Parts array to populate
 */
async function assembleStaticLayers(
  args: AssembleArgs,
  dbAdapter: DbAdapter,
  segmentIds: Record<Scope, number[]>,
  parts: string[]
): Promise<void> {
  // Core segments (no ref_id)
  const coreSegments = await dbAdapter.getSegments('core');
  if (coreSegments.length > 0) {
    segmentIds.core.push(...coreSegments.map(s => s.id));
    parts.push(block('core', coreSegments.map(s => s.content).join('\n\n')));
  }

  // Ruleset segments
  const rulesetSegments = await dbAdapter.getSegments('ruleset', args.rulesetId);
  if (rulesetSegments.length > 0) {
    segmentIds.ruleset.push(...rulesetSegments.map(s => s.id));
    parts.push(block('ruleset', rulesetSegments.map(s => s.content).join('\n\n')));
  }

  // World segments
  const worldSegments = await dbAdapter.getSegments('world', args.worldId);
  if (worldSegments.length > 0) {
    segmentIds.world.push(...worldSegments.map(s => s.id));
    parts.push(block('world', worldSegments.map(s => s.content).join('\n\n')));
  }

  // Entry segments
  const entrySegments = await dbAdapter.getSegments('entry', args.entryPointId);
  if (entrySegments.length > 0) {
    segmentIds.entry.push(...entrySegments.map(s => s.id));
    parts.push(block('entry', entrySegments.map(s => s.content).join('\n\n')));
  }
}

/**
 * Validates assembly arguments
 * @param args Assembly arguments
 * @returns Validation result
 */
export function validateAssembleArgs(args: AssembleArgs): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!args.entryPointId) {
    errors.push('entryPointId is required');
  }

  if (!args.worldId) {
    errors.push('worldId is required');
  }

  if (!args.rulesetId) {
    errors.push('rulesetId is required');
  }

  if (args.tokenBudget && args.tokenBudget < 100) {
    errors.push('tokenBudget must be at least 100');
  }

  if (args.npcTokenBudget && args.npcTokenBudget < 50) {
    errors.push('npcTokenBudget must be at least 50');
  }

  if (args.npcs) {
    for (const npc of args.npcs) {
      if (!npc.npcId) {
        errors.push('NPC ID is required');
      }
      if (typeof npc.tier !== 'number' || npc.tier < 0) {
        errors.push(`Invalid NPC tier for ${npc.npcId}: ${npc.tier}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Creates assembly summary for debugging
 * @param result Assembly result
 * @returns Summary string
 */
export function createAssemblySummary(result: AssembleResult): string {
  const summary = [
    `Prompt length: ${result.prompt.length} chars`,
    `Estimated tokens: ${result.meta.tokensEstimated}`,
    `Segments used: ${Object.values(result.meta.segmentIdsByScope).flat().length}`
  ];

  if (result.meta.truncated) {
    if (result.meta.truncated.droppedScopes?.length) {
      summary.push(`Dropped scopes: ${result.meta.truncated.droppedScopes.join(', ')}`);
    }
    if (result.meta.truncated.npcDroppedTiers?.length) {
      summary.push(`NPC tiers dropped: ${result.meta.truncated.npcDroppedTiers.length}`);
    }
    if (result.meta.truncated.inputTrimmed) {
      summary.push(`Input trimmed: ${result.meta.truncated.inputTrimmed.fromChars} → ${result.meta.truncated.inputTrimmed.toChars} chars`);
    }
    if (result.meta.truncated.gameStateCompressed) {
      summary.push('Game state compressed');
    }
  }

  return summary.join('\n');
}

/**
 * Extracts segment IDs by scope from assembly result
 * @param result Assembly result
 * @param scope Target scope
 * @returns Array of segment IDs
 */
export function getSegmentIdsByScope(result: AssembleResult, scope: Scope): number[] {
  return result.meta.segmentIdsByScope[scope] || [];
}

/**
 * Checks if a scope was dropped during assembly
 * @param result Assembly result
 * @param scope Target scope
 * @returns True if scope was dropped
 */
export function wasScopeDropped(result: AssembleResult, scope: Scope): boolean {
  return result.meta.truncated?.droppedScopes?.includes(scope) || false;
}

/**
 * Gets truncation details for a specific scope
 * @param result Assembly result
 * @param scope Target scope
 * @returns Truncation details or null
 */
export function getScopeTruncationDetails(result: AssembleResult, scope: Scope): {
  dropped: boolean;
  npcDroppedTiers?: Array<{ npcId: string; fromTier: number; toTier: number }>;
  inputTrimmed?: { fromChars: number; toChars: number };
  gameStateCompressed?: boolean;
} | null {
  if (!result.meta.truncated) return null;

  const dropped = wasScopeDropped(result, scope);
  const npcDroppedTiers = scope === 'npc' ? result.meta.truncated.npcDroppedTiers : undefined;
  const inputTrimmed = scope === 'input' ? result.meta.truncated.inputTrimmed : undefined;
  const gameStateCompressed = scope === 'game_state' ? result.meta.truncated.gameStateCompressed : undefined;

  return {
    dropped,
    npcDroppedTiers,
    inputTrimmed,
    gameStateCompressed
  };
}

/**
 * Creates a minimal assembly result for testing
 * @param prompt The prompt text
 * @param segmentIds Segment IDs by scope
 * @returns Minimal assembly result
 */
export function createMinimalResult(
  prompt: string,
  segmentIds: Record<Scope, number[]> = {
    core: [],
    ruleset: [],
    world: [],
    entry: [],
    entry_start: [],
    npc: [],
    game_state: [],
    player: [],
    rng: [],
    input: []
  }
): AssembleResult {
  return {
    prompt,
    meta: {
      order: ORDER,
      segmentIdsByScope: segmentIds,
      tokensEstimated: estimateTokens(prompt)
    }
  };
}
