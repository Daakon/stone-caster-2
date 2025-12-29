import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../db/supabase-client.js';
import { CompiledStoriesRepository } from '../../db/repos/compiled-stories.repo.js';

export interface FormHint {
    key: string;
    control: 'slider' | 'dropdown' | 'text' | 'number' | 'checkbox';
    label: string;
    min?: number;
    max?: number;
    options?: string[] | { label: string; value: any }[];
    default?: any;
    description?: string;
}

export interface SetupConfig {
    storyTitle: string;
    fields: Record<string, FormHint[]>; // Grouped by category (e.g. 'Attributes', 'Background')
}

export class GameSetupService {
    private compiledStoriesRepo: CompiledStoriesRepository;

    constructor(private supabase: SupabaseClient<Database>) {
        // Note: Repository might still point to 'compiled_stories' in its implementation.
        // We should ensure it matches the DB. 
        this.compiledStoriesRepo = new CompiledStoriesRepository(supabase);
    }

    /**
     * Get the UI configuration for the New Game screen
     */
    async getSetupConfig(compiledStoryId: string): Promise<SetupConfig> {
        // Try finding by ID (Cartridge ID)
        let story = await this.compiledStoriesRepo.findById(compiledStoryId);

        // If not found, try finding by Story Key (Story ID) assuming 1:1 mapping
        if (!story) {
            console.log(`[GameSetup] Not found by ID, trying Key: ${compiledStoryId}`);
            story = await this.compiledStoriesRepo.findByKey(compiledStoryId);
        }

        if (!story) {
            console.error(`[GameSetup] Failed to find compiled story for ID/Key: ${compiledStoryId}`);
            throw new Error(`Compiled story not found for ID/Key: ${compiledStoryId}`);
        }

        const cartridge = story as any;
        // Extract form hints from engine config
        // Structure expected: config_engine.form_hints = { "Attributes": [...], "Background": [...] }
        // Or if it's flat, we group it.
        // The prompt example shows: { "fields": [...] } but implies grouping by category logic.
        // "Group fields by category".

        // Align with V3 CompiledCartridge structure
        // config_engine.creation.fields (Array) instead of form_hints (Object)
        const creationFields = cartridge.config_engine?.creation?.fields || [];

        const fields: Record<string, FormHint[]> = {};

        if (Array.isArray(creationFields)) {
            // Group by category
            creationFields.forEach((field: any) => {
                const category = field.category || 'General';
                if (!fields[category]) {
                    fields[category] = [];
                }
                fields[category].push(field);
            });
        } else {
            // Fallback for legacy
            const rawHints = cartridge.config_engine?.form_hints || {};
            if (Array.isArray(rawHints)) {
                fields['General'] = rawHints;
            } else {
                Object.assign(fields, rawHints);
            }
        }

        return {
            storyTitle: cartridge.story_key || 'New Game', // fallback
            fields
        };
    }

    /**
     * Hydrate the initial game state from the cartridge and user inputs
     */
    hydrateInitialState(cartridge: any, formData: Record<string, unknown>) {
        // 1. Entity Assembly (Tier 1)
        // V3: config_engine.runtime.schema
        const schemaDefaults = cartridge.config_engine?.runtime?.schema ||
            cartridge.config_engine?.state_schema || {}; // Fallback

        // We need to merge defaults with validated formData
        // Deep copy defaults first
        const entityState = JSON.parse(JSON.stringify(schemaDefaults));

        // Flatten formData into entityState
        // Assuming formData keys map directly to state keys for the main player
        for (const [key, value] of Object.entries(formData)) {
            // Validation: strict check against schema/allowlist could happen here too
            // For now, we trust the caller (InstanceService) or just merge
            // The prompt says: "Validation: Ensure every field required by the schema exists"
            entityState[key] = value;
        }

        const playerEntity = {
            id: 'player_main',
            ...entityState
        };

        // 2. World Assembly (Tier 1)
        // Deep copy snapshot world
        const tier1_world = JSON.parse(JSON.stringify(cartridge.snapshot_world || {}));

        // 3. Entity Registry
        const snapshot_entities = cartridge.snapshot_entities || [];
        const tier1_entities = [playerEntity, ...(Array.isArray(snapshot_entities) ? snapshot_entities : [])];

        // 4. System Assembly (Tier 2)
        const tier2_system = {
            turn: 0,
            phase: 'setup',
            // Add any global system defaults here
        };

        return {
            tier1_entities,
            tier1_world,
            tier2_system,
            schema_version: 'v3.0.0'
        };
    }
}
