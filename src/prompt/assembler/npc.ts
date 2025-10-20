// Prompt Assembler NPC Block Builder
// Handles NPC tier selection, budget management, and content assembly

import type { SegmentRow, NpcBlockResult, NpcTierDrop, DbAdapter } from './types';
import { estimateTokens } from './budget';
import { npcSummaryCue, npcTierDropIndicator } from './markdown';

/**
 * Builds NPC block with tier-based content selection and budget management
 * @param npcs Array of NPCs with their tiers
 * @param tokenCap Maximum tokens allowed for NPC section
 * @param dbAdapter Database adapter for fetching segments
 * @returns NPC block result with content and metadata
 */
export async function buildNpcBlock(
  npcs: Array<{ npcId: string; tier: number }>,
  tokenCap: number,
  dbAdapter: DbAdapter
): Promise<NpcBlockResult> {
  if (!npcs.length) {
    return { body: '', segmentIds: [] };
  }

  const chunks: string[] = [];
  const segmentIds: number[] = [];
  const dropped: NpcTierDrop[] = [];

  // Process each NPC
  for (const { npcId, tier } of npcs) {
    const npcResult = await buildNpcContent(npcId, tier, dbAdapter);
    
    if (npcResult.content) {
      chunks.push(npcResult.content);
      segmentIds.push(...npcResult.segmentIds);
      if (npcResult.dropped) {
        dropped.push(...npcResult.dropped);
      }
    }
  }

  let body = chunks.join('\n\n');
  let finalDropped = [...dropped];

  // Apply token budget if over cap
  const currentTokens = estimateTokens(body);
  if (currentTokens > tokenCap) {
    const budgetResult = await applyNpcBudget(body, tokenCap, npcs, dbAdapter);
    body = budgetResult.body;
    finalDropped.push(...budgetResult.dropped);
  }

  return {
    body,
    segmentIds,
    dropped: finalDropped.length > 0 ? finalDropped : undefined
  };
}

/**
 * Builds content for a single NPC with tier filtering
 * @param npcId NPC identifier
 * @param tier Maximum tier to include
 * @param dbAdapter Database adapter
 * @returns NPC content result
 */
async function buildNpcContent(
  npcId: string,
  tier: number,
  dbAdapter: DbAdapter
): Promise<{
  content: string;
  segmentIds: number[];
  dropped?: NpcTierDrop[];
}> {
  const segments = await dbAdapter.getSegments('npc', npcId);
  
  if (!segments.length) {
    return { content: '', segmentIds: [] };
  }

  // Filter segments by tier
  const tierSegments = segments.filter(segment => {
    const segmentTier = segment.metadata?.tier ?? 0;
    return segmentTier <= tier;
  });

  if (!tierSegments.length) {
    return { content: '', segmentIds: [] };
  }

  // Check if we need to drop higher tiers
  const droppedTiers = segments
    .filter(segment => {
      const segmentTier = segment.metadata?.tier ?? 0;
      return segmentTier > tier;
    })
    .map(segment => ({
      npcId,
      fromTier: segment.metadata?.tier ?? 0,
      toTier: tier
    }));

  const content = `NPC: ${npcId}\n` + tierSegments.map(s => s.content).join('\n');
  const segmentIds = tierSegments.map(s => s.id);

  return {
    content,
    segmentIds,
    dropped: droppedTiers.length > 0 ? droppedTiers : undefined
  };
}

/**
 * Applies budget constraints to NPC content
 * @param body Current NPC body content
 * @param tokenCap Token cap for NPC section
 * @param npcs Original NPCs array
 * @param dbAdapter Database adapter
 * @returns Budget-adjusted NPC content
 */
async function applyNpcBudget(
  body: string,
  tokenCap: number,
  npcs: Array<{ npcId: string; tier: number }>,
  dbAdapter: DbAdapter
): Promise<{
  body: string;
  dropped: NpcTierDrop[];
}> {
  const dropped: NpcTierDrop[] = [];
  let currentBody = body;
  let currentTokens = estimateTokens(currentBody);

  // Strategy 1: Reduce tiers for all NPCs
  if (currentTokens > tokenCap) {
    const reducedNpcs = npcs.map(npc => ({ ...npc, tier: Math.max(0, npc.tier - 1) }));
    
    // Rebuild with reduced tiers
    const chunks: string[] = [];
    for (const { npcId, tier } of reducedNpcs) {
      const npcResult = await buildNpcContent(npcId, tier, dbAdapter);
      if (npcResult.content) {
        chunks.push(npcResult.content);
        if (npcResult.dropped) {
          dropped.push(...npcResult.dropped);
        }
      }
    }
    
    currentBody = chunks.join('\n\n');
    currentTokens = estimateTokens(currentBody);
  }

  // Strategy 2: If still over budget, drop highest tier NPCs
  if (currentTokens > tokenCap) {
    const npcsByTier = npcs.sort((a, b) => b.tier - a.tier);
    const npcsToKeep = Math.floor(npcs.length * 0.7); // Keep 70% of NPCs
    
    const keptNpcs = npcsByTier.slice(0, npcsToKeep);
    const droppedNpcs = npcsByTier.slice(npcsToKeep);
    
    // Record dropped NPCs
    for (const npc of droppedNpcs) {
      dropped.push({
        npcId: npc.npcId,
        fromTier: npc.tier,
        toTier: 0
      });
    }
    
    // Rebuild with kept NPCs only
    const chunks: string[] = [];
    for (const { npcId, tier } of keptNpcs) {
      const npcResult = await buildNpcContent(npcId, tier, dbAdapter);
      if (npcResult.content) {
        chunks.push(npcResult.content);
      }
    }
    
    currentBody = chunks.join('\n\n');
    currentTokens = estimateTokens(currentBody);
  }

  // Strategy 3: If still over budget, summarize remaining NPCs
  if (currentTokens > tokenCap) {
    const summaryChunks: string[] = [];
    
    for (const { npcId, tier } of npcs) {
      const summaryCue = npcSummaryCue(npcId, tier);
      summaryChunks.push(summaryCue);
      
      dropped.push({
        npcId,
        fromTier: tier,
        toTier: 0
      });
    }
    
    currentBody = summaryChunks.join('\n\n');
  }

  return { body: currentBody, dropped };
}

/**
 * Validates NPC tier configuration
 * @param npcs Array of NPCs to validate
 * @returns Validation result
 */
export function validateNpcTiers(npcs: Array<{ npcId: string; tier: number }>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (const npc of npcs) {
    if (!npc.npcId || typeof npc.npcId !== 'string') {
      errors.push(`Invalid NPC ID: ${npc.npcId}`);
    }
    if (typeof npc.tier !== 'number' || npc.tier < 0) {
      errors.push(`Invalid NPC tier for ${npc.npcId}: ${npc.tier}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Creates NPC tier summary for debugging
 * @param npcs Array of NPCs
 * @returns Summary string
 */
export function createNpcTierSummary(npcs: Array<{ npcId: string; tier: number }>): string {
  if (!npcs.length) return 'No NPCs';
  
  const byTier = npcs.reduce((acc, npc) => {
    acc[npc.tier] = (acc[npc.tier] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const tierSummary = Object.entries(byTier)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([tier, count]) => `Tier ${tier}: ${count} NPCs`)
    .join(', ');

  return `${npcs.length} NPCs (${tierSummary})`;
}

/**
 * Estimates NPC content tokens before building
 * @param npcs Array of NPCs
 * @param dbAdapter Database adapter
 * @returns Estimated token count
 */
export async function estimateNpcTokens(
  npcs: Array<{ npcId: string; tier: number }>,
  dbAdapter: DbAdapter
): Promise<number> {
  let totalTokens = 0;

  for (const { npcId, tier } of npcs) {
    const segments = await dbAdapter.getSegments('npc', npcId);
    const tierSegments = segments.filter(segment => {
      const segmentTier = segment.metadata?.tier ?? 0;
      return segmentTier <= tier;
    });

    if (tierSegments.length > 0) {
      const content = `NPC: ${npcId}\n` + tierSegments.map(s => s.content).join('\n');
      totalTokens += estimateTokens(content);
    }
  }

  return totalTokens;
}

/**
 * Creates NPC block summary for debugging
 * @param result NPC block result
 * @returns Summary string
 */
export function createNpcBlockSummary(result: NpcBlockResult): string {
  const summary = [
    `Content length: ${result.body.length} chars`,
    `Estimated tokens: ${estimateTokens(result.body)}`,
    `Segments used: ${result.segmentIds.length}`
  ];

  if (result.dropped?.length) {
    summary.push(`Tiers dropped: ${result.dropped.length}`);
  }

  return summary.join(', ');
}
