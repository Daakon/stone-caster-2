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
        console.log('[Turn] Resolution:', resolution?.logs);

        // Update state with Engine results for the Narrative to see (e.g. reduced stamina)
        let processedState = state;
        if (resolution.state) {
            processedState = resolution.state;
            
            // --- DEBUG PERSISTENCE ---
            const playerId = processedState.mechanical?.index?.player_id;
            if (playerId && processedState.mechanical?.entities?.[playerId]) {
                const entity = processedState.mechanical.entities[playerId];
                console.log('--- DEBUG PERSISTENCE ---');
                console.log('ProcessedState Player ID:', playerId);
                console.log('ProcessedState Stamina:', entity.properties?.current_stamina);
                console.log('ProcessedState Satiety:', entity.properties?.satiety);
                console.log('ProcessedState Mechanical State Keys:', Object.keys(processedState.mechanical || {}));
                console.log('--- END DEBUG PERSISTENCE ---');
            }
        }

        // Step 3: Narrative (The Brain)
        const mechanicalContext = resolution.logs.join(' | ');
        const augmentedInput = `PLAYER ACTION: "${playerInput}"\nMECHANICAL RESULT: [${mechanicalContext}]`;

        console.log('[Turn] Invoking Narrative Service...');
        const turnResult: any = await this.narrativeService.generateReaction(processedState, augmentedInput, compiledPrompt || undefined);

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
        // Use processedState (which has engine updates)
        await this.applyTurnResult(processedState, turnResult, resolution, nextIndex, playerInput);

        return {
            success: true,
            state: processedState,
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

        // 1. Append Player Input first (The Action)
        if (state.narrative.dialogue_history) {
            state.narrative.dialogue_history.push({
                id: crypto.randomUUID(),
                role: 'player',
                content: playerInput,
                timestamp: new Date(Date.now() - 200).toISOString() // Slightly in past
            });
        }

        // 2. Append System Thought (The Processing)
        if (result.thought_chain && state.narrative.dialogue_history) {
            state.narrative.dialogue_history.push({
                id: crypto.randomUUID(),
                role: 'system',
                content: `[THOUGHT] ${result.thought_chain}`,
                timestamp: new Date(Date.now() - 100).toISOString()
            });
        }

        // 3. Append Mechanical Delta Log (System)
        if (resolution && resolution.mechanicalDelta && Object.keys(resolution.mechanicalDelta).length > 0) {

            const logLines: string[] = [];

            // Keyed Delta: { [entityId]: { prop: val } }
            for (const [entityId, changes] of Object.entries(resolution.mechanicalDelta)) {
                // Resolve Entity Name
                // state.mechanical?.entities is where they live
                const entity = state.mechanical?.entities?.[entityId];
                const entityName = entity?.properties?.name || entity?.properties?.display_name || 'Unknown Entity';

                // Format Changes: "Stamina -5, Satiety -1"
                // Cast changes to Record<string, any>
                const changeStr = Object.entries(changes as Record<string, any>)
                    .map(([k, v]) => {
                        // Cleanup key names if needed (e.g. current_stamina -> Stamina)
                        const niceKey = k.replace('current_', '').replace('_', ' ');
                        const niceKeyCap = niceKey.charAt(0).toUpperCase() + niceKey.slice(1);
                        return `${niceKeyCap}: ${v}`;
                    })
                    .join(', ');

                if (changeStr) {
                    logLines.push(`${entityName}: ${changeStr}`);
                }
            }

            if (logLines.length > 0) {
                if (state.narrative.dialogue_history) {
                    state.narrative.dialogue_history.push({
                        id: crypto.randomUUID(),
                        role: 'system',
                        content: `[SYSTEM] ${logLines.join(' | ')}`,
                        timestamp: new Date(Date.now() - 50).toISOString()
                    });
                }
            }
        }

        // 4. Append Narrator Response (The Result)
        if (result.narration && state.narrative.dialogue_history) {
            state.narrative.dialogue_history.push({
                id: crypto.randomUUID(),
                role: 'narrator',
                content: result.narration,
                timestamp: new Date().toISOString()
            });
        }

        // 5. Apply Mechanical Changes (LEGACY/FALLBACK)
        // If resolution.state was used, state.mechanical is already updated. 
        // If NOT, we might need to apply delta here.
        // But we refactored ResolutionService to run EngineExecutor which updates state. 
        // So state should be fresh.
        // We skip manual application here to avoid double-application if we trust ResolutionService.

        // 6. Persist
        // --- DEBUG BEFORE PERSIST ---
        const playerId = state.mechanical?.index?.player_id;
        if (playerId && state.mechanical?.entities?.[playerId]) {
            const entity = state.mechanical.entities[playerId];
            console.log('--- DEBUG BEFORE PERSIST ---');
            console.log('State ID:', state.id);
            console.log('Player ID:', playerId);
            console.log('Stamina to persist:', entity.properties?.current_stamina);
            console.log('Satiety to persist:', entity.properties?.satiety);
            console.log('Mechanical state structure:', {
                hasEntities: !!state.mechanical.entities,
                entityKeys: Object.keys(state.mechanical.entities || {}),
                playerEntityExists: !!state.mechanical.entities[playerId],
                playerEntityHasProperties: !!state.mechanical.entities[playerId]?.properties
            });
            console.log('--- END DEBUG BEFORE PERSIST ---');
        }

        const updatePayload = {
            mechanical_state: state.mechanical,
            narrative_focus: state.narrative,
            action_queue: [], // Clear queue
            // turn_index updated by Repo
        };

        // --- DEBUG UPDATE PAYLOAD ---
        console.log('--- DEBUG UPDATE PAYLOAD ---');
        console.log('Update Payload Keys:', Object.keys(updatePayload));
        if (updatePayload.mechanical_state?.entities?.[playerId]) {
            const entity = updatePayload.mechanical_state.entities[playerId];
            console.log('Update Payload Entity Stamina:', entity.properties?.current_stamina);
            console.log('Update Payload Entity Satiety:', entity.properties?.satiety);
        }
        console.log('--- END DEBUG UPDATE PAYLOAD ---');

        await this.storiesRepo.updateGameState(state.id, updatePayload);

        console.log('[PERSIST] Game state updated in database');
        
        // Verify the save by reloading (optional, for debugging)
        const verifyState = await this.storiesRepo.loadGameState(state.id);
        if (verifyState && verifyState.mechanical_state?.entities?.[playerId]) {
            const savedEntity = verifyState.mechanical_state.entities[playerId];
            console.log('--- VERIFY SAVED STATE ---');
            console.log('Saved Stamina:', savedEntity.properties?.current_stamina);
            console.log('Saved Satiety:', savedEntity.properties?.satiety);
            console.log('--- END VERIFY SAVED STATE ---');
        }
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
