import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../db/supabase-client.js';
import { NarrativeService } from './narrative.service.js';
import { ResolutionService } from './resolution.service.js';
// REFACTOR: Import StoriesRepository (The new DAL)
import { StoriesRepository } from '../../db/repos/stories.repo.js';
import { CompiledStoriesRepository } from '../../db/repos/compiled-stories.repo.js';
// Import proper Director, Engine, and Narrator services for the game loop
import { DirectorService } from '../runtime/director.service.js';
import { EngineService } from '../runtime/engine.service.js';
import { Mas2Service } from '../runtime/mas2.service.js';
import { StateService } from '../runtime/state.service.js';

import { GameStateBundle, MechanicalState, NarrativeFocus, SceneRegistry } from '../../domain/game-state.types.js';

interface TurnResult {
    success: boolean;
    state?: GameStateBundle;
    turn?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    delta?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    new_logs?: any[]; // The new dialogue entries created during this turn
    message?: string;
}

export class GameTurnService {
    private storiesRepo: StoriesRepository; // REFACTOR: Use Repo
    private compiledStoriesRepo: CompiledStoriesRepository; // Keep for legacy if needed/removed
    private narrativeService: NarrativeService;
    private resolutionService: ResolutionService; // Legacy - kept for fallback
    private directorService: DirectorService;
    private engineService: EngineService; // NEW: Resolution Ladder Engine
    private mas2Service: Mas2Service;

    constructor(
        private supabase: SupabaseClient<Database>,
        narrativeService?: NarrativeService,
        directorService?: DirectorService,
        engineService?: EngineService,
        mas2Service?: Mas2Service
    ) {
        this.storiesRepo = new StoriesRepository(supabase); // Initialize Repo
        this.compiledStoriesRepo = new CompiledStoriesRepository(supabase);
        this.narrativeService = narrativeService || new NarrativeService();
        this.resolutionService = new ResolutionService(); // Legacy fallback
        // Director and Narrator can have mock AI, but Engine is deterministic
        this.directorService = directorService || new DirectorService();
        this.engineService = engineService || new EngineService(); // NEW: Use Resolution Ladder Engine
        this.mas2Service = mas2Service || new Mas2Service();
    }

    /**
     * The Standard Turn Loop (Phase 7.1)
     * Proper Flow: MAS1 (Interpreter) -> Engine (Deterministic) -> MAS2 (Narrator)
     * Mocks ONLY for MAS1 and MAS2 AI results, Engine is fully deterministic
     */
    async processTurn(gameStateId: string, playerInput: string, userId: string): Promise<TurnResult> {
        console.log(`[Turn Start] Game: ${gameStateId}, Input: "${playerInput}"`);
        console.log('[Turn] 🚀 NEW FLOW: MAS1 -> Engine -> MAS2 (Proper Architecture)');

        try {
            // Step 1: Load State and Compiled Story
            const state = await this.loadState(gameStateId, userId);
            const compiledPrompt = state.compiled_system_prompt;

            // Load compiled story to get actionsMap for MAS1 and Engine
            // The game state's story_id is the draft story ID, not the compiled story ID
            const draftStoryId = await this.getStoryIdFromGameState(gameStateId);
            if (!draftStoryId) {
                throw new Error(`Story ID not found for game state: ${gameStateId}`);
            }

            // Try to get compiled story by draft ID first (most common case)
            let compiledStory = await this.storiesRepo.getCompiledStoryByDraftId(draftStoryId);

            // Fallback: try by ID in case story_id is actually a compiled story ID
            if (!compiledStory) {
                compiledStory = await this.storiesRepo.getCompiledStoryById(draftStoryId);
            }

            if (!compiledStory) {
                throw new Error(`Compiled story not found for draft story: ${draftStoryId}`);
            }

            // Extract actionsMap from compiled story
            const actionsMap = this.extractActionsMap(compiledStory);

            // Step 2: Director (Strategic Lead) - Can have mock AI results
            // Converts player input into Unified Intent DTO with intent_queue, unseen_ripples, and proximity_cluster
            console.log('[Turn] Step 2: Calling Director (Strategic Lead)...');
            const directorIntent = await this.directorService.resolve(
                playerInput,
                this.convertStateToGameState(state),
                actionsMap,
                [] // TODO: Retrieve lore fragments via RAG
            );
            console.log('[Turn] Director Result:', {
                resolutionMode: directorIntent.turn_meta.resolution_mode,
                intentQueueLength: directorIntent.intent_queue.length,
                unseenRipplesCount: directorIntent.unseen_ripples.length,
                firstIntent: directorIntent.intent_queue[0] ? {
                    trigger_id: directorIntent.intent_queue[0].trigger_id,
                    target_count: directorIntent.intent_queue[0].intended_targets.length,
                    proximity_cluster_size: directorIntent.intent_queue[0].proximity_cluster.length,
                    verb: directorIntent.intent_queue[0].parameters.verb
                } : null
            });

            // Convert Director intent_queue to Mas1Intent[] format for Engine (temporary bridge)
            const mas1Intents = directorIntent.intent_queue.map(intent => ({
                trigger_id: intent.trigger_id as any,
                target_ids: intent.intended_targets,
                parameters: {
                    verb: intent.parameters.verb,
                    tactic_tag: intent.parameters.tactic_tag,
                    skill_id: intent.parameters.skill_id,
                    difficulty_mod: 0,
                },
                duration_tag: 'moment' as const,
                situational_tags: [],
                original_text: intent.parameters.verb,
            }));

            // Step 3: Engine (Deterministic) - NO MOCKS, pure logic
            // Uses Resolution Ladder (4-tier priority system) for D100 resolution
            console.log('[Turn] Step 3: Calling Engine (Deterministic with Resolution Ladder)...');

            // Convert state to GameState format for EngineService
            const gameState = this.convertStateToGameState(state);

            // Extract schema from CompiledStory for strict validation
            const schema = compiledStory.master_schema ? {
                tier1_allowlist: compiledStory.master_schema.tier1_allowlist || [],
                tier0_allowlist: compiledStory.master_schema.tier0_allowlist || [],
            } : undefined;

            // Initialize StateService (Single Source of Truth) with schema validation
            const stateService = new StateService(gameState, schema);

            // Execute all intents via EngineService (uses Resolution Ladder)
            const engineResult = await this.engineService.executeActionSteps(
                mas1Intents,
                stateService.getState(),
                actionsMap
            );

            console.log('[Turn] Engine Result:', {
                success: engineResult.success,
                deltaKeys: Object.keys(engineResult.numeric_deltas),
                stateUpdated: Object.keys(engineResult.numeric_deltas).length > 0
            });

            // Apply engine deltas to StateService
            stateService.applyDeltas(engineResult.numeric_deltas);

            // Get final authoritative state from StateService
            const finalGameState = stateService.getState();

            // Convert back to GameStateBundle format for compatibility
            // Map tier1_mechanical back to mechanical, tier0_narrative back to narrative
            const engineProcessedState: GameStateBundle = {
                ...state,
                mechanical: (finalGameState as any).tier1_mechanical || state.mechanical,
                narrative: (finalGameState as any).tier0_narrative || state.narrative,
            };

            // Convert numeric deltas to nested structure for compatibility
            const delta: Record<string, any> = {};
            for (const [path, value] of Object.entries(engineResult.numeric_deltas)) {
                if (path.includes('.')) {
                    // Deep path (e.g., "entities.id.properties.stamina")
                    const parts = path.split('.');
                    let current: Record<string, any> = delta;
                    for (let i = 0; i < parts.length - 1; i++) {
                        if (!current[parts[i]]) {
                            current[parts[i]] = {};
                        }
                        current = current[parts[i]];
                    }
                    current[parts[parts.length - 1]] = value;
                } else {
                    delta[path] = value;
                }
            }

            const engineResultFormatted = {
                success: engineResult.success,
                state: engineProcessedState, // Authoritative final state from StateService
                delta,
                outcome_summary: engineResult.outcome_summary
            };
            console.log('[Turn] Engine Result:', {
                success: engineResult.success,
                deltaKeys: Object.keys(delta?.entities || {}),
                stateUpdated: !!engineProcessedState,
                outcomeSummary: engineResult.outcome_summary
            });

            // CRITICAL: Use the authoritative final state from engineResult
            // This is the state after all intents have been processed sequentially
            // Do NOT fall back to the original state - use the mutated state
            let processedState = engineResultFormatted.state;

            if (!processedState) {
                console.error('[Turn] ❌ Engine did not return state! Using original state as fallback.');
                processedState = state;
            }

            // Verify the state structure is correct
            if (!processedState.mechanical) {
                console.error('[Turn] ❌ Processed state missing mechanical property! State keys:', Object.keys(processedState));
                // Try to recover by using original state
                processedState = state;
            }

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

            // Step 4: MAS2 (Narrator) - Can have mock AI results
            // Generates narrative and may trigger additional relationship changes
            console.log('[Turn] Step 4: Calling MAS2 (Narrator)...');
            const mas2Result = await this.mas2Service.narrate(
                {
                    success: engineResultFormatted.success,
                    outcome_summary: engineResultFormatted.outcome_summary || (engineResultFormatted.success ? 'Action executed' : 'Action failed'),
                    numeric_deltas: engineResult.numeric_deltas || {} // Use numeric_deltas directly from EngineService
                },
                this.convertStateToGameState(processedState),
                mas1Intents[0]?.trigger_id, // Use first intent's trigger_id
                undefined, // worldStyle
                compiledStory
            );
            console.log('[Turn] MAS2 Result:', {
                ripple_narrative: mas2Result.ripple_narrative?.substring(0, 100),
                hasMutations: !!(mas2Result.tier0_mutations && Object.keys(mas2Result.tier0_mutations).length > 0)
            });

            // Step 5: Process MAS2 Mutations (e.g., relationship changes from NPC reactions)
            // If MAS2 detected NPC reactions (e.g., guard's friend gets mad), process them
            if (mas2Result.tier0_mutations && Object.keys(mas2Result.tier0_mutations).length > 0) {
                const mutationResult = await this.processMas2Mutations(
                    processedState,
                    mas2Result.tier0_mutations,
                    actionsMap
                );
                processedState = mutationResult.state || processedState;
                // Merge deltas
                if (mutationResult.delta) {
                    engineResultFormatted.delta = this.mergeDeltas(engineResultFormatted.delta || {}, mutationResult.delta);
                }
            }

            // Step 5b: Process MAS2 State Updates (social ripple effects)
            // Apply entity relationship changes and world updates from MAS2
            if (mas2Result.state_updates) {
                const stateUpdateDelta = await this.processMas2StateUpdates(
                    processedState,
                    mas2Result.state_updates,
                    actionsMap
                );
                processedState = stateUpdateDelta.state || processedState;
                if (stateUpdateDelta.delta) {
                    engineResultFormatted.delta = this.mergeDeltas(engineResultFormatted.delta || {}, stateUpdateDelta.delta);
                }
            }

            // Step 6: Record History (The Log)
            const nextIndex = await this.storiesRepo.getNextTurnIndex(state.id);
            console.log('[GameLoop] Preparing Turn:', { nextIndex, gameStateId });

            // Convert MAS1 intents to intent format for storage (use first intent)
            const firstIntent = mas1Intents[0];
            const mas1Intent = {
                type: firstIntent?.trigger_id === 'combat_action' ? 'COMBAT' : 'NARRATIVE',
                intent: firstIntent?.trigger_id || 'attempt_action',
                skill_id: firstIntent?.parameters.skill_id || 'root_force',
                difficulty_mod: firstIntent?.parameters.difficulty_mod || 0,
                duration_tag: firstIntent?.duration_tag || 'moment',
                confidence: 1.0,
                analysis: 'neutral',
                parameters: firstIntent?.parameters || {}
            };

            const recordedTurn = await this.storiesRepo.recordTurn({
                gameStateId: state.id,
                turnIndex: nextIndex,
                playerInput: playerInput,
                directorIntent: mas1Intent, // TODO: Convert to DirectorUnifiedIntent format
                mechanicalDelta: engineResultFormatted.delta || {},
                narratorOutput: {
                    narration: mas2Result.ripple_narrative || '',
                    thought_chain: mas2Result.thought_chain || ''
                }
            });

            // [TELEMETRY] Link Turn to Audit Log if Trace ID exists
            const traceId = mas2Result.meta?.traceId || (firstIntent as any)?.meta?.traceId;
            if (traceId && recordedTurn?.id) {
                await this.storiesRepo.linkAuditLogToTurn(traceId, recordedTurn.id);
                console.log('[GameLoop] Linked Audit Log:', { traceId, turnId: recordedTurn.id });
            } else {
                console.warn('[GameLoop] Failed to link audit log: Missing ID', { traceId, turnId: recordedTurn?.id });
            }

            console.log('[GameLoop] Turn Recorded:', { id: recordedTurn.id, index: recordedTurn.turn_index });

            // Step 7: Merge & Persist State (The Snapshot)
            // CRITICAL: Ensure processedState is in the correct GameStateBundle format
            // The engine may have mutated the state structure, so we need to ensure it matches
            const finalState: GameStateBundle = {
                id: processedState.id || state.id,
                mechanical: processedState.mechanical || state.mechanical,
                narrative: processedState.narrative || state.narrative,
                registry: processedState.registry || state.registry,
                compiled_system_prompt: processedState.compiled_system_prompt || state.compiled_system_prompt,
            };

            // Final validation: Log the authoritative state before persistence
            const finalPlayerId = finalState.mechanical?.index?.player_id;
            if (finalPlayerId && finalState.mechanical?.entities?.[finalPlayerId]) {
                const finalEntity = finalState.mechanical.entities[finalPlayerId];
                console.log('[Turn] 📊 FINAL STATE BEFORE PERSISTENCE:');
                console.log(`  Player ID: ${finalPlayerId}`);
                console.log(`  Stamina: ${finalEntity.properties?.current_stamina}`);
                console.log(`  Satiety: ${finalEntity.properties?.satiety}`);
            }

            // Use finalState (the authoritative, validated state)
            const newLogs = await this.applyTurnResult(finalState, {
                narration: mas2Result.ripple_narrative || '',
                thought_chain: mas2Result.thought_chain || ''
            }, {
                mechanicalDelta: engineResultFormatted.delta || {},
                intent: mas1Intent
            }, nextIndex, playerInput);

            return {
                success: true,
                state: finalState, // Return the validated final state
                turn: recordedTurn,
                delta: engineResultFormatted.delta || {},
                new_logs: newLogs
            };
        } catch (error) {
            // NO FALLBACK: Fail fast with clear error message
            console.error('[Turn] ❌ Error in MAS1 -> Engine -> MAS2 flow:', error);
            throw error;
        }
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
    ): Promise<any[]> {
        const newLogs: any[] = [];

        // 1. Log Thought Chain (Console only, stored in Turn History now)
        console.log('[AI Thought Chain]', result.thought_chain);

        // 1. Append Player Input first (The Action)
        if (state.narrative.dialogue_history) {
            const entry = {
                id: crypto.randomUUID(),
                role: 'player',
                content: playerInput,
                timestamp: new Date(Date.now() - 200).toISOString() // Slightly in past
            };
            state.narrative.dialogue_history.push(entry);
            newLogs.push(entry);
        }

        // 2. Append System Thought (The Processing)
        if (result.thought_chain && state.narrative.dialogue_history) {
            const entry = {
                id: crypto.randomUUID(),
                role: 'system',
                content: `[THOUGHT] ${result.thought_chain}`,
                timestamp: new Date(Date.now() - 100).toISOString()
            };
            state.narrative.dialogue_history.push(entry);
            newLogs.push(entry);
        }

        // 3. Append Mechanical Delta Log (System)
        // 3. Append Mechanical Delta Log (System)
        if (resolution && resolution.mechanicalDelta) {
            const delta = resolution.mechanicalDelta;
            const logLines: string[] = [];

            // Helper to format deep objects into readable strings (e.g., "Stamina: -5")
            const formatRecursive = (obj: any, prefix = ''): string[] => {
                const parts: string[] = [];
                for (const [key, value] of Object.entries(obj)) {
                    // Skip technical keys or flatten them
                    if (key === 'properties' || key === 'stats') { // auto-flatten common containers
                        parts.push(...formatRecursive(value, prefix));
                        continue;
                    }

                    if (typeof value === 'object' && value !== null) {
                        parts.push(...formatRecursive(value, prefix ? `${prefix} ${key}` : key));
                    } else {
                        // Formatting: "current_stamina" -> "Stamina"
                        let niceKey = (prefix ? `${prefix} ${key}` : key)
                            .replace(/^current_/, '')
                            .replace(/_/g, ' ');
                        niceKey = niceKey.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                        parts.push(`${niceKey}: ${value}`);
                    }
                }
                return parts;
            };

            // A. Handle Entities
            if (delta.entities) {
                for (const [entityId, changes] of Object.entries(delta.entities)) {
                    // Resolve Entity Name
                    const entity = state.mechanical?.entities?.[entityId];
                    const entityName = entity?.properties?.display_name || entity?.properties?.name || 'Unknown Entity';

                    const changesFull = formatRecursive(changes);
                    if (changesFull.length > 0) {
                        logLines.push(`${entityName} [${changesFull.join(', ')}]`);
                    }
                }
            }

            // B. Handle World/Global
            if (delta.world) {
                const worldChanges = formatRecursive(delta.world, 'World');
                if (worldChanges.length > 0) {
                    logLines.push(`World [${worldChanges.join(', ')}]`);
                }
            }

            // C. Fallback (if old flat format is somehow used)
            const remainingKeys = Object.keys(delta).filter(k => k !== 'entities' && k !== 'world');
            if (remainingKeys.length > 0) {
                const otherProps: Record<string, any> = {};
                remainingKeys.forEach(k => otherProps[k] = delta[k]);
                const otherChanges = formatRecursive(otherProps);
                if (otherChanges.length > 0) {
                    logLines.push(`Global [${otherChanges.join(', ')}]`);
                }
            }

            if (logLines.length > 0) {
                if (state.narrative.dialogue_history) {
                    const entry = {
                        id: crypto.randomUUID(),
                        role: 'system',
                        content: `${logLines.join(' | ')}`, // Removed [SYSTEM] prefix to let UI handle styling
                        timestamp: new Date(Date.now() - 50).toISOString()
                    };
                    state.narrative.dialogue_history.push(entry);
                    newLogs.push(entry);
                }
            }
        }

        // 4. Append Narrator Response (The Result)
        if (result.narration && state.narrative.dialogue_history) {
            const entry = {
                id: crypto.randomUUID(),
                role: 'narrator',
                content: result.narration,
                timestamp: new Date().toISOString()
            };
            state.narrative.dialogue_history.push(entry);
            newLogs.push(entry);
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

        // CRITICAL: Use the authoritative state passed to this method
        // This should be the final processedState from processTurn, not a stale copy
        // Verify we have the correct state structure
        if (!state.mechanical) {
            console.error('[PERSIST] ❌ State missing mechanical property! State keys:', Object.keys(state));
            throw new Error('Cannot persist state: missing mechanical property');
        }

        const updatePayload = {
            mechanical_state: state.mechanical, // Use the authoritative state from processTurn
            narrative_focus: state.narrative || {}, // Ensure narrative exists
            action_queue: [], // Clear queue
            // turn_index updated by Repo
        };

        // --- DEBUG UPDATE PAYLOAD ---
        console.log('--- DEBUG UPDATE PAYLOAD ---');
        console.log('Update Payload Keys:', Object.keys(updatePayload));
        console.log('State ID:', state.id);
        if (updatePayload.mechanical_state?.entities?.[playerId]) {
            const entity = updatePayload.mechanical_state.entities[playerId];
            console.log('Update Payload Entity Stamina:', entity.properties?.current_stamina);
            console.log('Update Payload Entity Satiety:', entity.properties?.satiety);
            console.log('Update Payload Entity Properties Keys:', Object.keys(entity.properties || {}));
        } else {
            console.warn('[PERSIST] ⚠️ Player entity not found in mechanical_state.entities');
            console.log('Available entity IDs:', Object.keys(updatePayload.mechanical_state?.entities || {}));
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

        return newLogs;
    }

    // ============================================================================
    // HELPERS
    // ============================================================================

    /**
     * Extract actionsMap from compiled story
     */
    private extractActionsMap(compiledStory: any): Record<string, unknown> {
        // Try config_mechanics first (new architecture)
        if (compiledStory.config_mechanics?.runtime?.actions) {
            return compiledStory.config_mechanics.runtime.actions;
        }
        // Fallback to legacy config_engine
        if (compiledStory.config_engine?.runtime?.actions) {
            return compiledStory.config_engine.runtime.actions;
        }
        // Fallback to master_schema
        if (compiledStory.master_schema?.actions_map) {
            const actionsMap: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(compiledStory.master_schema.actions_map)) {
                try {
                    actionsMap[key] = typeof value === 'string' ? JSON.parse(value) : value;
                } catch {
                    actionsMap[key] = value;
                }
            }
            return actionsMap;
        }
        return {};
    }

    /**
     * Get story ID from game state
     */
    private async getStoryIdFromGameState(gameStateId: string): Promise<string | null> {
        const gameState = await this.storiesRepo.loadGameState(gameStateId);
        return gameState?.story_id || null;
    }

    /**
     * Convert GameStateBundle to GameState format expected by MAS1/MAS2
     */
    private convertStateToGameState(state: GameStateBundle): any {
        // Extract player_id from mechanical state
        const playerId = state.mechanical?.index?.player_id;

        return {
            story_id: state.id || '', // Use state ID as story_id
            player_id: playerId || '', // Extract player_id from mechanical.index
            tier1_mechanical: state.mechanical || {},
            tier0_narrative: state.narrative || {},
            tier2_spatial: state.registry || {}
        };
    }

    /**
     * Flatten delta to numeric_deltas format for EngineResultDto
     */
    private flattenDeltaToNumeric(delta: Record<string, any>): Record<string, number> {
        const numeric: Record<string, number> = {};
        if (delta.entities) {
            for (const [entityId, changes] of Object.entries(delta.entities)) {
                if (typeof changes === 'object' && changes !== null) {
                    for (const [key, value] of Object.entries(changes)) {
                        if (typeof value === 'number') {
                            numeric[`entities.${entityId}.${key}`] = value;
                        }
                    }
                }
            }
        }
        return numeric;
    }

    /**
     * Process MAS2 mutations (e.g., NPC relationship changes)
     * These may trigger additional engine calls for relationship updates
     */
    private async processMas2Mutations(
        state: GameStateBundle,
        mutations: Record<string, unknown>,
        actionsMap: Record<string, unknown>
    ): Promise<{ state: GameStateBundle; delta?: Record<string, any> }> {
        // Apply tier0_mutations to narrative state (memory, flags, etc.)
        if (mutations.memory_stream && state.narrative) {
            state.narrative.memory_stream = mutations.memory_stream as any[];
        }

        // Process relationship changes from MAS2 (mock mode - apply directly to state)
        const relationshipChanges = mutations.relationship_changes as Record<string, Record<string, number>> | undefined;
        if (relationshipChanges && Object.keys(relationshipChanges).length > 0) {
            // Initialize relationships structure if needed
            const mech = state.mechanical_state || state.mechanical || {};
            if (!mech.ledgers) {
                mech.ledgers = {};
            }
            if (!mech.ledgers.relationships) {
                mech.ledgers.relationships = {};
            }

            const relationships = mech.ledgers.relationships as Record<string, Record<string, number>>;
            const relationshipDelta: Record<string, any> = { relationships: {} };

            // Apply relationship changes
            for (const [npcId, changes] of Object.entries(relationshipChanges)) {
                if (!relationships[npcId]) {
                    relationships[npcId] = { trust: 5, warmth: 5, respect: 5, desire: 5, awe: 5 };
                }

                if (!relationshipDelta.relationships[npcId]) {
                    relationshipDelta.relationships[npcId] = {};
                }

                for (const [axis, delta] of Object.entries(changes)) {
                    const current = relationships[npcId][axis] || 5;
                    const newValue = Math.max(0, Math.min(20, current + (delta as number)));
                    relationships[npcId][axis] = newValue;
                    relationshipDelta.relationships[npcId][axis] = newValue;
                }
            }

            // Update state
            if (state.mechanical_state) {
                state.mechanical_state.ledgers = mech.ledgers;
            } else if (state.mechanical) {
                state.mechanical.ledgers = mech.ledgers;
            }

            return { state, delta: relationshipDelta };
        }

        return { state };
    }

    /**
     * Process MAS2 state_updates (social ripple effects)
     * Applies entity relationship changes and world updates
     */
    private async processMas2StateUpdates(
        state: GameStateBundle,
        stateUpdates: { entity_updates: Array<{ id: string; path: string; value: number | string | boolean; description?: string }>; world_updates: Record<string, unknown> },
        actionsMap: Record<string, unknown>
    ): Promise<{ state: GameStateBundle; delta?: Record<string, any> }> {
        const delta: Record<string, any> = {
            entities: {},
            world: {},
        };

        // Process entity updates (relationship changes)
        for (const update of stateUpdates.entity_updates) {
            // Parse the path (e.g., "relationships.player.trust")
            const pathParts = update.path.split('.');

            if (pathParts[0] === 'relationships' && pathParts.length >= 3) {
                // Initialize relationships structure if needed
                const mech = state.mechanical_state || state.mechanical || {};
                if (!mech.ledgers) {
                    mech.ledgers = {};
                }
                if (!mech.ledgers.relationships) {
                    mech.ledgers.relationships = {};
                }

                const relationships = mech.ledgers.relationships as Record<string, Record<string, number>>;
                if (!relationships[update.id]) {
                    relationships[update.id] = { trust: 5, warmth: 5, respect: 5, desire: 5, awe: 5 };
                }

                // Extract relationship axis (e.g., "trust" from "relationships.player.trust")
                const axis = pathParts[pathParts.length - 1];
                const current = relationships[update.id][axis] || 5;

                // Apply change (value is a delta, not absolute)
                if (typeof update.value === 'number') {
                    const newValue = Math.max(0, Math.min(20, current + update.value));
                    relationships[update.id][axis] = newValue;

                    // Add to delta
                    if (!delta.entities[update.id]) {
                        delta.entities[update.id] = {};
                    }
                    if (!delta.entities[update.id].relationships) {
                        delta.entities[update.id].relationships = {};
                    }
                    delta.entities[update.id].relationships[axis] = newValue;
                }

                // Update state
                if (state.mechanical_state) {
                    state.mechanical_state.ledgers = mech.ledgers;
                } else if (state.mechanical) {
                    state.mechanical.ledgers = mech.ledgers;
                }
            }
        }

        // Process world updates
        for (const [path, value] of Object.entries(stateUpdates.world_updates)) {
            // Parse path (e.g., "narrative.atmosphere")
            const pathParts = path.split('.');
            if (pathParts[0] === 'narrative') {
                const narrative = state.narrative || {};
                const targetKey = pathParts.slice(1).join('.');

                // Set nested value
                const setNested = (obj: any, keys: string[], val: unknown) => {
                    const [first, ...rest] = keys;
                    if (rest.length === 0) {
                        obj[first] = val;
                    } else {
                        if (!obj[first]) obj[first] = {};
                        setNested(obj[first], rest, val);
                    }
                };

                setNested(narrative, targetKey.split('.'), value);
                state.narrative = narrative;

                // Add to delta
                if (!delta.world.narrative) {
                    delta.world.narrative = {};
                }
                setNested(delta.world.narrative, targetKey.split('.'), value);
            }
        }

        // Clean up empty objects
        if (Object.keys(delta.entities).length === 0) {
            delete delta.entities;
        }
        if (Object.keys(delta.world).length === 0) {
            delete delta.world;
        }

        return { state, delta: Object.keys(delta).length > 0 ? delta : undefined };
    }

    /**
     * Merge two delta objects
     */
    private mergeDeltas(delta1: Record<string, any>, delta2: Record<string, any>): Record<string, any> {
        // Deep merge deltas
        const merged = { ...delta1 };

        // Merge entities
        if (delta2.entities) {
            if (!merged.entities) merged.entities = {};
            Object.assign(merged.entities, delta2.entities);
        }

        // Merge world changes
        if (delta2.world) {
            if (!merged.world) merged.world = {};
            Object.assign(merged.world, delta2.world);
        }

        // Merge relationship changes
        if (delta2.relationships) {
            if (!merged.relationships) merged.relationships = {};
            Object.assign(merged.relationships, delta2.relationships);
        }

        return merged;
    }

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
