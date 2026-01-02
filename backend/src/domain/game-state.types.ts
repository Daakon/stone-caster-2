export type EntityId = string; // UUID
export type SceneId = string;  // Node UUID

// --- 1. Mechanical State (The Engine Room) ---
export interface ActiveEntity {
    id: EntityId;
    type: 'PLAYER' | 'NPC' | 'OBJECT';
    status: 'active' | 'incapacitated' | 'dead';
    // Dynamic bucket for Ruleset variables (HP: 100, STR: 10)
    // The Factory will default numeric values here.
    properties: Record<string, any>;
}

export interface MechanicalState {
    globals: Record<string, any>; // Time, Danger Level
    entities: Record<EntityId, ActiveEntity>; // The Active Roster
    index: {
        player_id: EntityId;
        [key: string]: any;
    };
}

// --- 2. Narrative Focus (The Stage) ---
export interface NarrativeFocus {
    scene_context: {
        name: string;
        description: string;
        atmosphere?: string;
    };
    // Visual descriptions mapped by ID
    // The Factory will default string values here.
    entity_visuals: Record<EntityId, string>;
    dialogue_history: Array<{ speaker: string; text: string }>;
}

// --- 3. Scene Registry (The Background) ---
export interface SceneRegistry {
    active_scene_id: SceneId;
    entity_locations: Record<EntityId, SceneId>;
    node_states: Record<SceneId, Record<string, any>>;
}

// --- Composite Bundle for Creation ---
export interface GameStateBundle {
    mechanical: MechanicalState;
    narrative: NarrativeFocus;
    registry: SceneRegistry;
    queue?: any[];
}
