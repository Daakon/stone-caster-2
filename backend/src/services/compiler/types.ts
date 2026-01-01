/**
 * Story Compiler Type Definitions
 */

export interface RuntimeConfig {
    logic: any;
    actions: Record<string, any>;
    state_defaults: Record<string, any>;
}

export interface EngineConfig {
    runtime: RuntimeConfig;
}

export interface CompiledCartridge {
    id: string; // UUID
    story_id: string; // UUID
    version: number;

    // The deterministic ruleset for the Logic Agent
    config_engine: EngineConfig;

    // System Prompts
    prompt_interpreter_logic: string | null;
    prompt_narrator_style: string | null;

    // Deep Clones of the source data at compilation time
    snapshot_world: Record<string, any>;
    snapshot_entities: Record<string, any>;


    created_at: string; // ISO Timestamp
}

// Creation Manifest Types (For UI Menu)
export interface CreationField {
    key: string;
    label: string;
    control: string;
    default?: any;
    options?: string[]; // For dropdowns
    suggestions?: string[]; // For tag_lists
    description?: string;
    ui_order: number;
    [key: string]: any;
}

export interface CreationGroup {
    id: string;
    label: string;
    priority: number;
    fields: CreationField[];
}

export interface CreationStep {
    id: string;
    label: string;
    priority: number;
    groups: CreationGroup[];
}

export interface CreationManifest {
    steps: CreationStep[];
}
