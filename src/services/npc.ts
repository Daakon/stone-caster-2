// NPC Service
// Handles NPC catalog, relationships, and tier computation

import { SupabaseDbAdapter } from '../prompt/assembler/db';
import type { DbAdapter } from '../prompt/assembler/types';

export interface NpcBinding {
  npcId: string;
  weight: number;
  roleHint: string;
}

export interface NpcRelationship {
  gameId: string;
  npcId: string;
  trust: number;
  warmth: number;
  respect: number;
  romance: number;
  awe: number;
  fear: number;
  desire: number;
  flags: Record<string, any>;
  updatedAt: string;
}

export interface NpcArgs {
  npcId: string;
  tier: number;
}

/**
 * Gets NPCs bound to an entry point
 * @param entryPointId Entry point identifier
 * @param dbAdapter Database adapter
 * @returns Array of NPC bindings
 */
export async function getEntryNpcs(
  entryPointId: string,
  dbAdapter: DbAdapter = new SupabaseDbAdapter({} as any)
): Promise<NpcBinding[]> {
  // Mock implementation - in production, query entry_point_npcs table
  const mockBindings: NpcBinding[] = [
    { npcId: 'npc.mystika.kiera', weight: 3, roleHint: 'guide' },
    { npcId: 'npc.mystika.thorne', weight: 2, roleHint: 'lorekeeper' },
    { npcId: 'npc.mystika.zara', weight: 1, roleHint: 'guard' }
  ];

  // Filter by entry point (in production, this would be a database query)
  return mockBindings.filter(binding => 
    entryPointId === 'demo.system.adventure' || 
    entryPointId === 'ep.whispercross'
  );
}

/**
 * Gets or creates an NPC relationship for a game
 * @param gameId Game identifier
 * @param npcId NPC identifier
 * @param dbAdapter Database adapter
 * @returns NPC relationship record
 */
export async function getOrCreateRel(
  gameId: string,
  npcId: string,
  dbAdapter: DbAdapter = new SupabaseDbAdapter({} as any)
): Promise<NpcRelationship> {
  // Mock implementation - in production, query/insert npc_relationships table
  const mockRelationship: NpcRelationship = {
    gameId,
    npcId,
    trust: 0,
    warmth: 0,
    respect: 0,
    romance: 0,
    awe: 0,
    fear: 0,
    desire: 0,
    flags: {},
    updatedAt: new Date().toISOString()
  };

  return mockRelationship;
}

/**
 * Computes NPC tier based on relationship values
 * @param rel NPC relationship record
 * @returns Computed tier (0-3)
 */
export function computeTier(rel: NpcRelationship): number {
  // Simple formula: floor((trust + warmth + respect + romance + awe - fear) / 40)
  // Clamped to 0-3 range
  const relationshipScore = rel.trust + rel.warmth + rel.respect + rel.romance + rel.awe - rel.fear;
  const tier = Math.floor(relationshipScore / 40);
  return Math.max(0, Math.min(3, tier));
}

/**
 * Builds NPC arguments for assembler
 * @param gameId Game identifier
 * @param entryPointId Entry point identifier
 * @param dbAdapter Database adapter
 * @returns Array of NPC args with computed tiers
 */
export async function buildNpcArgs(
  gameId: string,
  entryPointId: string,
  dbAdapter: DbAdapter = new SupabaseDbAdapter({} as any)
): Promise<NpcArgs[]> {
  // Get NPCs bound to this entry point
  const bindings = await getEntryNpcs(entryPointId, dbAdapter);
  
  // Get relationships and compute tiers
  const npcArgs: NpcArgs[] = [];
  
  for (const binding of bindings) {
    const rel = await getOrCreateRel(gameId, binding.npcId, dbAdapter);
    const tier = computeTier(rel);
    
    npcArgs.push({
      npcId: binding.npcId,
      tier
    });
  }
  
  return npcArgs;
}

/**
 * Updates NPC relationship values
 * @param gameId Game identifier
 * @param npcId NPC identifier
 * @param updates Partial relationship updates
 * @param dbAdapter Database adapter
 */
export async function updateNpcRelationship(
  gameId: string,
  npcId: string,
  updates: Partial<Omit<NpcRelationship, 'gameId' | 'npcId' | 'updatedAt'>>,
  dbAdapter: DbAdapter = new SupabaseDbAdapter({} as any)
): Promise<void> {
  // Mock implementation - in production, update npc_relationships table
  console.log(`Updating relationship for game ${gameId}, NPC ${npcId}:`, updates);
}

/**
 * Gets NPC details by ID
 * @param npcId NPC identifier
 * @param dbAdapter Database adapter
 * @returns NPC details or null
 */
export async function getNpcDetails(
  npcId: string,
  dbAdapter: DbAdapter = new SupabaseDbAdapter({} as any)
): Promise<any | null> {
  // Mock implementation - in production, query npcs table
  const mockNpcs: Record<string, any> = {
    'npc.mystika.kiera': {
      id: 'npc.mystika.kiera',
      name: 'Kiera',
      archetype: 'Warden',
      roleTags: ['companion', 'guide'],
      doc: {
        quirks: ['speaks in clipped phrases'],
        mannerisms: ['taps ring when thinking']
      }
    },
    'npc.mystika.thorne': {
      id: 'npc.mystika.thorne',
      name: 'Thorne',
      archetype: 'Scholar',
      roleTags: ['merchant', 'lorekeeper'],
      doc: {
        quirks: ['constantly adjusts spectacles'],
        mannerisms: ['mumbles to himself']
      }
    },
    'npc.mystika.zara': {
      id: 'npc.mystika.zara',
      name: 'Zara',
      archetype: 'Warrior',
      roleTags: ['guard', 'mentor'],
      doc: {
        quirks: ['sharpens blade when nervous'],
        mannerisms: ['stands with hand on sword']
      }
    }
  };

  return mockNpcs[npcId] || null;
}

/**
 * Gets all NPCs for a world
 * @param worldId World identifier
 * @param dbAdapter Database adapter
 * @returns Array of NPC details
 */
export async function getWorldNpcs(
  worldId: string,
  dbAdapter: DbAdapter = new SupabaseDbAdapter({} as any)
): Promise<any[]> {
  // Mock implementation - in production, query npcs table by world_id
  const allNpcs = [
    {
      id: 'npc.mystika.kiera',
      name: 'Kiera',
      archetype: 'Warden',
      roleTags: ['companion', 'guide']
    },
    {
      id: 'npc.mystika.thorne',
      name: 'Thorne',
      archetype: 'Scholar',
      roleTags: ['merchant', 'lorekeeper']
    },
    {
      id: 'npc.mystika.zara',
      name: 'Zara',
      archetype: 'Warrior',
      roleTags: ['guard', 'mentor']
    }
  ];

  return allNpcs.filter(npc => npc.id.startsWith(`npc.${worldId}`));
}
