import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../db/supabase-client.js';
import { CompiledStoriesRepository } from '../../db/repos/compiled-stories.repo.js';
import { GameSetupService } from './setup.service.js';

export interface CreateGameInstanceParams {
    userId: string;
    compiledStoryId: string;
    characterData: Record<string, unknown>;
}

export class GameInstanceService {
    private compiledStoriesRepo: CompiledStoriesRepository;
    private setupService: GameSetupService;

    constructor(private supabase: SupabaseClient<Database>) {
        this.compiledStoriesRepo = new CompiledStoriesRepository(supabase);
        this.setupService = new GameSetupService(supabase);
    }

    async createInstance(params: CreateGameInstanceParams) {
        const { userId, compiledStoryId, characterData } = params;

        // Step 1: Load Cartridge (Compiled Story)
        const compiledStory = await this.compiledStoriesRepo.findById(compiledStoryId);
        if (!compiledStory) {
            throw new Error(`Compiled story not found: ${compiledStoryId}`);
        }

        const cartridge = compiledStory as any;

        // Step 2 & 3: Hydrate Initial State (Delegate to Setup Service)
        const fullInitialState = this.setupService.hydrateInitialState(cartridge, characterData);

        // Step 4: Persist
        const { data, error } = await this.supabase
            .from('chimera_instances_v3' as any) // Cast until type is fixed in client
            .insert({
                user_id: userId,
                compiled_story_id: compiledStoryId,
                status: 'active',
                current_state: fullInitialState,
                event_log: [{
                    turn: 0,
                    type: 'system',
                    text: 'Game Initialized',
                    timestamp: new Date().toISOString()
                }],
                turn_count: 0
            })
            .select('id, current_state')
            .single();

        if (error) {
            throw new Error(`Failed to create game instance: ${error.message}`);
        }

        return {
            success: true,
            instanceId: data.id,
            initialState: data.current_state
        };
    }
}
