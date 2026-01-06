export type EntityId = string; // UUID
export type SceneId = string;  // Node UUID

// --- 1. Mechanical State (The Engine Room) ---
export interface EntityProperties {
    visual_name?: string; // "First Impression" / Visual Alias (e.g., "A Slumped Guard")
    visual_tags?: string[]; // The specific tokens (Race, Attire, Quirk)
    is_known?: boolean; // False by default for Extras; determines if the UI shows name or visual_name
    [key: string]: any; // Allow dynamic props
}

export interface ActiveEntity {
    id: EntityId;
    type: 'PLAYER' | 'NPC' | 'OBJECT';
    status: 'active' | 'incapacitated' | 'dead';
    // Dynamic bucket for Ruleset variables (HP: 100, STR: 10)
    // The Factory will default numeric values here.
    properties: EntityProperties;
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
export interface DirectorInstructions {
    tone: string;
    pacing: string;
    perspective: string;
}

export interface NarrativeFocus {
    scene_context: {
        name: string; // Internal/System Name
        description: string;
        // [PHASE 6.6] Structured Scene Data
        location?: string; // Display Name (The Wobbly Goblin)
        time?: string;     // Time of Day (Night, Morning)
        atmosphere?: string;
    };
    // Visual descriptions mapped by ID
    // The Factory will default string values here.
    entity_visuals: Record<EntityId, string>;
    dialogue_history: Array<{ speaker: string; text: string; type?: 'dialogue' | 'action' | 'system' }>;
    director_instructions?: DirectorInstructions;
}

// --- 3. Scene Registry (The Background) ---
export interface SceneRegistry {
    active_scene_id: SceneId;
    entity_locations: Record<EntityId, SceneId>;
    node_states: Record<SceneId, Record<string, any>>;
}

// --- Composite Bundle for Creation ---
export interface GameStateBundle {
    id?: string; // Optional during creation phase
    mechanical: MechanicalState;
    narrative: NarrativeFocus;
    registry: SceneRegistry;
    queue?: any[];
    compiled_system_prompt?: string;
}
