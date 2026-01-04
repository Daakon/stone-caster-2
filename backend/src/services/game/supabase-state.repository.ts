
import { IGameStateRepository } from './state.repository.interface';
import { GameStateBundle, MechanicalState } from '../../domain/game-state.types';
import { SupabaseClient } from '@supabase/supabase-js';

export class SupabaseGameStateRepository implements IGameStateRepository {
    constructor(private supabase: SupabaseClient) { }

    /**
     * Persist the initial state bundle for a new game session.
     */
    async createState(storyId: string, bundle: GameStateBundle, userId: string): Promise<string> {
        const { data, error } = await this.supabase
            .from('chimera_game_states')
            .insert({
                story_id: storyId,
                player_id: userId,

                mechanical_state: bundle.mechanical,
                narrative_focus: bundle.narrative,
                scene_registry: bundle.registry,
                action_queue: bundle.queue || []
            })
            .select('id')
            .single();

        if (error) throw new Error(`Failed to create game state: ${error.message}`);
        if (!data) throw new Error('No data returned from create game state');

        return data.id;
    }

    /**
     * Load ONLY the mechanical state (efficient fetch).
     */
    async loadMechanical(storyId: string): Promise<MechanicalState> {
        const { data, error } = await this.supabase
            .from('chimera_game_states')
            .select('mechanical_state')
            .eq('story_id', storyId)
            .single();

        if (error) throw new Error(`Failed to load mechanical state: ${error.message}`);
        if (!data) throw new Error('Game state not found');

        return data.mechanical_state as MechanicalState;
    }
}
