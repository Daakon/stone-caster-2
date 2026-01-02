export interface CharacterTemplate {
    id: string; // UUID of the character row
    user_id?: string;
    world_id?: string;
    name: string;
    state_snapshot: {
        tier1_entity?: Record<string, any>; // Mechanical stats override
        appearance?: string; // Optional visual description if stored here
        [key: string]: any;
    };
    created_at?: string;
    updated_at?: string;
}
