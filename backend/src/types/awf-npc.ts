/**
 * AWF NPC Types - Versioned NPC documents for reusable character pool
 * NPCs are static authoring documents that can be referenced across worlds/adventures
 */

export interface NPCDocV1 {
  npc: {
    display_name: string;
    archetype?: string;
    summary: string;                 // ≤ 160 chars author intent
    tags?: string[];                // search facets
    traits?: Record<string, number>; // 0–100 author seeds (ex: openness, loyalty)
    skills?: Record<string, number>; // 0–100
    style?: {
      voice?: string;                // e.g., "wry, concise, observant"
      register?: "casual"|"formal"|"playful"|"stoic"|string;
      taboos?: string[];             // content the NPC avoids
    };
    links?: {
      world_ref?: string;
      adventure_refs?: string[];
    };
    slices?: string[];               // named sub-bodies (e.g., ["core","bio","lore"])
    i18n?: Record<string, { 
      display_name?: string; 
      summary?: string; 
      style?: Partial<NPCDocV1["npc"]["style"]> 
    }>;
  };
}

// Database record type for NPCs
export interface NPCRecord {
  id: string;
  version: string;
  doc: NPCDocV1;
  created_at: string;
  updated_at: string;
}
