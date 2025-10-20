/**
 * AWF Scenario Types - Versioned scenario documents for game startpoints
 * Scenarios define initial game state and can be linked to worlds/adventures
 */

export interface ScenarioDocV1 {
  world_ref: string;                 // e.g. "world.mystika@1.0.0"
  adventure_ref?: string;            // optional
  is_public?: boolean;               // whether scenario is available to players
  scenario: {
    display_name: string;            // ≤ 64
    synopsis?: string;               // ≤ 160
    start_scene: string;             // scene/locale key, e.g. "inn.last_ember.common_room"
    fixed_npcs?: Array<{ npc_ref: string }>;
    // Optional seeds (all are hints; canonical state still in game snapshot after acts)
    starting_party?: Array<{ npc_ref: string }>;
    starting_inventory?: Array<{ item_id: string; qty?: number }>;
    starting_resources?: Record<string, number>; // hp/energy/stamina/etc.
    starting_flags?: Record<string, boolean>;
    starting_objectives?: Array<{ id: string; label: string; status?: "active"|"completed"|"failed" }>;
    tags?: string[];                  // facets, e.g., ["inn","social","low_combat"]
    slices?: string[];                // optional author slices (kept flexible)
    i18n?: Record<string, {
      display_name?: string;
      synopsis?: string;
      start_scene?: string;
    }>;
  };
}

// Database record type for scenarios
export interface ScenarioRecord {
  id: string;
  version: string;
  doc: ScenarioDocV1;
  created_at: string;
  updated_at: string;
}
