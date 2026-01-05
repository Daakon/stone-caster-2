import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../db/supabase-client.js';
import { NarrativeService } from './narrative.service.js';
import { CompiledStoriesRepository } from '../../db/repos/compiled-stories.repo.js';

interface TurnResult {
    success: boolean;
    state?: any;
    output?: string;
    message?: string;
}

export class GameTurnService {
    private compiledStoriesRepo: CompiledStoriesRepository;
    private narrativeService: NarrativeService;

    constructor(
        private supabase: SupabaseClient<Database>,
        narrativeService?: NarrativeService
    ) {
        this.compiledStoriesRepo = new CompiledStoriesRepository(supabase);
        this.narrativeService = narrativeService || new NarrativeService();
    }

    async processTurn(gameStateId: string, playerInput: string, userId: string): Promise<TurnResult> {
        // 1. Ingest Intent & Load State
        const { data: gameState, error: loadError } = await this.supabase
            .from('chimera_game_states')
            .select('*')
            .eq('id', gameStateId)
            .single();

        if (loadError || !gameState) {
            throw new Error(`Game state not found: ${gameStateId}`);
        }

        // Verify Ownership (Basic check, Middleware usually handles this but good to be safe)
        if (gameState.player_id !== userId) {
            throw new Error('Unauthorized: You do not own this game session.');
        }

        // 2. Append Player Input
        const currentHistory = (gameState.tier0_narrative as any).dialogue_history || [];
        const playerTurn = {
            role: 'player',
            content: playerInput,
            timestamp: new Date().toISOString()
        };

        // Optimistic append for context generation
        const historyWithPlayer = [...currentHistory, playerTurn];

        // Update local state object slightly for the service call
        const tempState = {
            ...gameState,
            narrative: {
                ...gameState.tier0_narrative,
                dialogue_history: historyWithPlayer
            }
        };

        // 3. The Agentic Handoff (The Brain)
        // 4. Generate Narrative Reaction (MOCK MODE ENABLED)
        const reaction = await this.narrativeService.generateReaction(tempState as any, playerInput);

        // 5. Integrate Results
        const newLogs = [];

        // 5a. System Logs
        if (reaction.system_logs && reaction.system_logs.length > 0) {
            for (const log of reaction.system_logs) {
                newLogs.push({
                    role: 'system',
                    content: log,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // 5b. Narrative
        newLogs.push({
            role: 'narrator',
            content: reaction.narrative,
            timestamp: new Date().toISOString()
        });

        const finalHistory = [...historyWithPlayer, ...newLogs];

        // 5c. Apply State Delta (Mock Application)
        // We need to actually modify the state if we want the frontend to react
        // In a real system, we'd have a DeltaApplicator service.
        // Here, we'll do simple specific patches for the Mock.

        let updatedTier1 = { ...gameState.tier1_mechanical };

        if (reaction.state_delta) {
            // Handle specific mock keys
            if (reaction.state_delta["tier1_mechanical.current_stamina"]) {
                const delta = reaction.state_delta["tier1_mechanical.current_stamina"];
                updatedTier1.current_stamina = (updatedTier1.current_stamina || 100) + delta;
            }
            if (reaction.state_delta["tier1_mechanical.current_hp"]) {
                const delta = reaction.state_delta["tier1_mechanical.current_hp"];
                updatedTier1.current_hp = (updatedTier1.current_hp || 100) + delta;
            }
        }

        const updatedTier0 = {
            ...gameState.tier0_narrative as any,
            dialogue_history: finalHistory
        };

        const { data: updatedState, error: updateError } = await this.supabase
            .from('chimera_game_states')
            .update({
                tier0_narrative: updatedTier0,
                tier1_mechanical: updatedTier1,
                updated_at: new Date().toISOString()
            })
            .eq('id', gameStateId)
            .select() // Return the updated row
            .single();

        if (updateError) {
            throw new Error(`Failed to persist turn: ${updateError.message}`);
        }

        // Reconstruct full compatible state object if needed, or return DB row
        return {
            success: true,
            state: updatedState,
            output: reaction.narrative
        };
    }
}
