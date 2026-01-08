import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../db/supabase-client.js';
import { NarrativeService } from './narrative.service.js';
import { ResolutionService } from './resolution.service.js';
// REFACTOR: Import StoriesRepository (The new DAL)
import { StoriesRepository } from '../../db/repos/stories.repo.js';
import { CompiledStoriesRepository } from '../../db/repos/compiled-stories.repo.js';

import { GameStateBundle, MechanicalState, NarrativeFocus, SceneRegistry } from '../../domain/game-state.types.js';

interface TurnResult {
    success: boolean;
    state?: GameStateBundle;
    turn?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    delta?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    message?: string;
}

export class GameTurnService {
    private storiesRepo: StoriesRepository; // REFACTOR: Use Repo
    private compiledStoriesRepo: CompiledStoriesRepository; // Keep for legacy if needed/removed
    private narrativeService: NarrativeService;
    private resolutionService: ResolutionService;

    constructor(
        private supabase: SupabaseClient<Database>,
        narrativeService?: NarrativeService
    ) {
        this.storiesRepo = new StoriesRepository(supabase); // Initialize Repo
        this.compiledStoriesRepo = new CompiledStoriesRepository(supabase);
        this.narrativeService = narrativeService || new NarrativeService();
        this.resolutionService = new ResolutionService();
    }

    /**
     * The Standard Turn Loop (Phase 7.1)
     */
    async processTurn(gameStateId: string, playerInput: string, userId: string): Promise<TurnResult> {
        console.log(`[Turn Start] Game: ${gameStateId}, Input: "${playerInput}"`);

        // Step 1: Load State
        const state = await this.loadState(gameStateId, userId);
        const compiledPrompt = state.compiled_system_prompt;

        // Step 2: Resolution (The Engine)
        const resolution = await this.resolutionService.resolve(playerInput, state);
        console.log('[Turn] Resolution:', resolution);

        // Step 3: Narrative (The Brain)
        const mechanicalContext = resolution.logs.join(' | ');
        const augmentedInput = `PLAYER ACTION: "${playerInput}"\nMECHANICAL RESULT: [${mechanicalContext}]`;

        console.log('[Turn] Invoking Narrative Service...');
        const turnResult: any = await this.narrativeService.generateReaction(state, augmentedInput, compiledPrompt || undefined);

        // Step 4: Record History (The Log)
        const nextIndex = await this.storiesRepo.getNextTurnIndex(state.id);
        console.log('[GameLoop] Preparing Turn:', { nextIndex, gameStateId });

        // Ensure we pass objects, not strings. verify resolution.intent is object or parses to one if string
        // The user says: "Pass Object. NOT JSON.stringify". 
        // We assume resolution.intent IS an object.

        const recordedTurn = await this.storiesRepo.recordTurn({
            gameStateId: state.id,
            turnIndex: nextIndex,
            playerInput: playerInput,
            mas1Intent: resolution.intent,
            mechanicalDelta: resolution.mechanicalDelta || {},
            mas2Narration: {
                narration: turnResult.narration,
                thought_chain: turnResult.thought_chain
            }
        });

        // [TELEMETRY] Link Turn to Audit Log if Trace ID exists
        // Check both locations for meta just in case
        const traceId = turnResult.meta?.traceId || resolution.meta?.traceId;

        if (traceId && recordedTurn?.id) {
            await this.storiesRepo.linkAuditLogToTurn(traceId, recordedTurn.id);
            console.log('[GameLoop] Linked Audit Log:', { traceId, turnId: recordedTurn.id });
        } else {
            console.warn('[GameLoop] Failed to link audit log: Missing ID', { traceId, turnId: recordedTurn?.id });
        }

        console.log('[GameLoop] Turn Recorded:', { id: recordedTurn.id, index: recordedTurn.turn_index });

        // Step 5: Merge & Persist State (The Snapshot)
        await this.applyTurnResult(state, turnResult, resolution, nextIndex, playerInput);

        return {
            success: true,
            state: state, // Legacy support (optional, but requested to NOT be the primary payload if possible, but controller decides what to send)
            turn: recordedTurn,
            delta: resolution.mechanicalDelta || {}
        };
    }

    /**
     * Applies the AI's deterministic output to the DB state
     */
    private async applyTurnResult(
        state: GameStateBundle,
        result: any,
        resolution: any,
        newTurnIndex: number,
        playerInput: string
    ): Promise<void> {
        // 1. Log Thought Chain (Console only, stored in Turn History now)
        console.log('[AI Thought Chain]', result.thought_chain);

        // Append to history so frontend can see it (Frontend reads from narrative_focus.dialogue_history)
        if (result.thought_chain && state.narrative.dialogue_history) {
            state.narrative.dialogue_history.push({
                id: crypto.randomUUID(),
                role: 'system',
                content: `[THOUGHT] ${result.thought_chain}`,
                timestamp: new Date().toISOString()
            });
        }

        // Append actual narrative
        state.narrative.dialogue_history?.push({
            role: 'player',
            content: playerInput,
            timestamp: new Date().toISOString()
        });

        // 2. Apply Mechanical Changes (AI Driven + Engine Driven)
        // Merge Engine Delta (from Resolution)
        if (resolution && resolution.mechanicalDelta) {
            // ... Logic to apply delta ...
            // (Simulated for MVP)
        }

        // Merge AI State Updates
        if (result.state_updates) {
            const mech = state.mechanical;
            const updates = result.state_updates;

            // HP
            if (updates.player_hp_change && mech.entities[mech.index.player_id]) {
                const entity = mech.entities[mech.index.player_id];
                entity.properties.hp = (entity.properties.hp || 100) + updates.player_hp_change;
            }
            // Stamina
            if (updates.player_stamina_change && mech.entities[mech.index.player_id]) {
                const entity = mech.entities[mech.index.player_id];
                entity.properties.stamina = (entity.properties.stamina || 100) + updates.player_stamina_change;
            }
        }

        // 3. Persist (REFACTOR: Use StoriesRepo)
        await this.storiesRepo.updateGameState(state.id, {
            mechanical_state: state.mechanical,
            narrative_focus: state.narrative,
            action_queue: [], // Clear queue
            // turn_index is now determined by the count of chimera_turns rows conceptually,
            // but we don't store it in chimera_game_states anymore (removed in migration).
            // So we just update the content.
        });
    }

    // ============================================================================
    // HELPERS
    // ============================================================================

    private async loadState(gameId: string, userId: string): Promise<GameStateBundle> {
        // REFACTOR: Use StoriesRepo
        const data = await this.storiesRepo.loadGameState(gameId);

        if (!data) throw new Error(`Game state not found: ${gameId}`);
        // if (data.player_id !== userId) throw new Error('Unauthorized'); // Repo loads by ID. Authorization should be here or Repo.

        // Map GameState (DB DTO) to GameStateBundle (Domain)
        return {
            id: data.id!,
            mechanical: data.mechanical_state as MechanicalState,
            narrative: data.narrative_focus as NarrativeFocus,
            registry: data.scene_registry as SceneRegistry,
            queue: data.action_queue as any[],
            compiled_system_prompt: data.compiled_system_prompt || '',
            current_turn_index: 0 // We'd need to count turns or fetch max index. For now, 0 or pass-through.
            // TODO: Fetch max turn index if needed for logic, or let DB auto-increment ID.
            // For MVP, we can query proper index if strictness required.
        };
    }
}
