// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * AI Service Types
 * Defines the contract for all Narrative AI outputs (Genesis & Turns)
 */

export interface AiTurnResult {
    // The Story Prose
    narration: string;

    // The World Context (Updates to the Header/Environment)
    scene_context?: {
        location?: string;
        time?: string;
        atmosphere?: string;
    };

    // Mechanical Updates (Detected by AI logic, verified by Engine)
    state_updates?: {
        player_hp_change?: number;
        player_stamina_change?: number;
        entity_updates?: Array<{
            id: string; // Target Entity ID
            status_effect?: string; // e.g. "Staggered"
            relationship_delta?: number; // e.g. -5 (Anger)
        }>;
    };

    // Meta Data
    thought_chain?: string; // Optional reasoning trace or "scratchpad"
}
