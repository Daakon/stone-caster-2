/**
 * Story Compiler Type Definitions
 */

export interface EngineConfig {
    actions: Record<string, any>;
    state_schema: any;
    form_hints: any;
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
