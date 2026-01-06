import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../db/supabase-client.js';
import { NarrativeService } from './narrative.service.js';
import { ResolutionService } from './resolution.service.js';
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
    private resolutionService: ResolutionService;

    constructor(
        private supabase: SupabaseClient<Database>,
        narrativeService?: NarrativeService
    ) {
        this.compiledStoriesRepo = new CompiledStoriesRepository(supabase);
        this.narrativeService = narrativeService || new NarrativeService();
        this.resolutionService = new ResolutionService();
    }

    /**
     * The Master Loop: Phase 5.5 "Double-Loop" Mock Pipeline
     * Step 1: MAS1 Intent Analysis
     * Step 2: Engine Pass 1 (Action Resolution)
     * Step 3: MAS2 Narrative Generation
     * Step 4: Engine Pass 2 (Consequence Resolution)
     */
    /**
     * The Standard Turn Loop (Phase 7.1)
     * Step 1: Load State & Context
     * Step 2: Mechanical Resolution (The Engine)
     * Step 3: Narrative Generation (The Brain)
     * Step 4: Merge & Persist
     */
    async processTurn(gameStateId: string, playerInput: string, userId: string): Promise<TurnResult> {
        console.log(`[Turn Start] Game: ${gameStateId}, Input: "${playerInput}"`);

        // Step 1: Load State
        const state = await this.loadState(gameStateId, userId);
        const compiledPrompt = state.compiled_system_prompt;

        // Step 2: Resolution (The Engine)
        // We use the ResolutionService to determine the "Physics" result before the "Narrator" speaks.
        const resolution = await this.resolutionService.resolve(playerInput, state);
        console.log('[Turn] Resolution:', resolution);

        // Step 3: Narrative (The Brain)
        // We inject the mechanical result into the prompt so the AI knows what happened.
        const mechanicalContext = resolution.logs.join(' | ');
        const augmentedInput = `PLAYER ACTION: "${playerInput}"\nMECHANICAL RESULT: [${mechanicalContext}]`;

        console.log('[Turn] Invoking Narrative Service...');
        const turnResult = await this.narrativeService.generateReaction(state, augmentedInput, compiledPrompt || undefined);

        // Step 4: Merge & Persist
        // We merge both the Mechanical Delta (from Resolution) and Narrative Delta (from AI)

        // Merge Mechanical Delta first (engine truth)
        if (resolution.mechanicalDelta) {
            const mech = state.mechanical;
            if (resolution.mechanicalDelta.damage_dealt) {
                // Hacky mock application for demo 'damage_dealt' -> reduce generic enemy health?
                // For now, let's just let the AI handle "state_updates" for visual HP/Stamina based on the prompt.
                // But wait, ResolutionService returned `mechanicalDelta`.
                // We should ideally apply it.
                // For the "Mock d100", it returned { damage_dealt: X }.
                // We will trust the AI's `state_updates` to be the "Final Commit" to the DB for now,
                // assuming the AI reads "MECHANICAL RESULT: Deal 10 damage" and puts "enemy_hp_change: -10" in the JSON.
                // This keeps the "Single Source of Truth for State Write" in the AI JSON for Phase 7 simplicity.
            }
        }

        await this.applyTurnResult(state, turnResult);

        return {
            success: true,
            state: state,
            output: turnResult.narrative
        };
    }

    /**
     * Applies the AI's deterministic output to the DB state
     */
    private async applyTurnResult(state: any, result: any): Promise<void> {
        // 1. Log Thought Chain
        console.log('[AI Thought Chain]', result.thought_chain);

        // Append to history so frontend can see it (but we will hide it in UI)
        if (result.thought_chain && state.narrative.dialogue_history) {
            state.narrative.dialogue_history.push({
                id: crypto.randomUUID(),
                role: 'system',
                content: `[THOUGHT] ${result.thought_chain}`,
                timestamp: new Date().toISOString()
            });
        }

        // 2. Apply Mechanical Changes
        if (result.state_updates) {
            const mech = state.mechanical;
            const updates = result.state_updates;

            // HP
            if (updates.player_hp_change && mech.entities[state.index.player_id]) {
                mech.entities[state.index.player_id].properties.hp =
                    (mech.entities[state.index.player_id].properties.hp || 100) + updates.player_hp_change;
            }

            // Stamina
            if (updates.player_stamina_change && mech.entities[state.index.player_id]) {
                mech.entities[state.index.player_id].properties.stamina =
                    (mech.entities[state.index.player_id].properties.stamina || 100) + updates.player_stamina_change;
            }
        }

        // 3. Persist
        const { error } = await this.supabase
            .from('chimera_game_states')
            .update({
                mechanical_state: state.mechanical,
                narrative_focus: state.narrative,
                current_turn_index: (state.current_turn_index || 0) + 1,
                action_queue: [] // Clear queue
            })
            .eq('id', state.id);

        if (error) throw error;
    }

    // ============================================================================
    // MOCK PIPELINE METHODS
    // ============================================================================

    private async mockMas1_Intent(input: string): Promise<Mas1Intent> {
        const lower = input.toLowerCase();
        if (lower.includes('attack') || lower.includes('hit') || lower.includes('strike')) {
            return {
                type: 'COMBAT',
                target: lower.includes('guard') ? 'Guard' : 'Enemy',
                rawInput: input
            };
        }
        return {
            type: 'NARRATIVE',
            rawInput: input
        };
    }

    private async mockEngine_Pass1(intent: Mas1Intent): Promise<ActionDelta> {
        if (intent.type === 'COMBAT') {
            // Dice Roll (1-100)
            const roll = Math.floor(Math.random() * 100) + 1;
            const success = roll >= 50;

            if (success) {
                return {
                    success: true,
                    logs: [`Hit! (Rolled ${roll})`, 'Damage: 12'],
                    mechanicalDelta: {
                        'tier1_mechanical.health.current': -0,
                        'tier1_mechanical.stamina.current': -5
                    }
                };
            } else {
                return {
                    success: false,
                    logs: [`Miss! (Rolled ${roll})`],
                    mechanicalDelta: {
                        'tier1_mechanical.stamina.current': -15
                    }
                };
            }
        }

        // Narrative Action (Neutral)
        return {
            success: true,
            logs: [],
            mechanicalDelta: {}
        };
    }

    private async mockMas2_Narrative(action: ActionDelta, intent: Mas1Intent): Promise<Mas2Narrative> {
        if (intent.type === 'COMBAT') {
            if (action.success) {
                // Check if we have logs to extract details? hardcoded for mock is fine.
                return {
                    text: `You strike true! The ${intent.target} snarls in pain as your blow connects definedly.`,
                    tags: ['HOSTILE_TRIGGER'],
                    systemLogs: ['Opponent Staggered']
                };
            } else {
                return {
                    text: `You stumble forward, swinging wildly. The ${intent.target} easily sidesteps, leaving you exposed.`,
                    tags: [],
                    systemLogs: ['Balance Lost']
                };
            }
        }

        return {
            text: `You ${intent.rawInput}. The world watches, indifferent.`,
            tags: [],
            systemLogs: []
        };
    }

    private async mockEngine_Pass2(narrative: Mas2Narrative): Promise<ConsequenceDelta> {
        const delta: ConsequenceDelta = { tier0Delta: {} };

        if (narrative.tags.includes('HOSTILE_TRIGGER')) {
            // Mock updating relationship
            // In real engine, this would look up entity ID. Mocking "Guard" relation.
            delta.tier0Delta['tier0_narrative.world_state.relationships.guard_captain'] = 'HOSTILE';
        }

        return delta;
    }

    // ============================================================================
    // HELPERS
    // ============================================================================

    private async loadState(gameId: string, userId: string): Promise<any> {
        const { data, error } = await this.supabase
            .from('chimera_game_states')
            .select('*')
            .eq('id', gameId)
            .single();

        if (error || !data) throw new Error(`Game state not found: ${gameId}`);
        if (data.player_id !== userId) throw new Error('Unauthorized');

        return data;
    }

    private async applyAndSaveState(
        initialState: any,
        intent: Mas1Intent,
        action: ActionDelta,
        narrative: Mas2Narrative,
        consequence: ConsequenceDelta
    ): Promise<any> {
        // Map DB Columns -> App State
        // DISCOVERY: Schema is Sharded (mechanical_state, narrative_focus, etc.)
        const tier0 = initialState.narrative_focus || {};
        const tier1 = initialState.mechanical_state || {};
        const tier2 = initialState.scene_registry || {};
        const queue = initialState.action_queue || [];

        // 1. Construct Dialogue Entry
        const startHistory = tier0.dialogue_history || [];

        const playerTurn = {
            role: 'player',
            content: intent.rawInput,
            timestamp: new Date().toISOString()
        };

        // Combine logs from Action and Narrative steps
        const allLogs = [...(action.logs || []), ...(narrative.systemLogs || [])];
        const systemEntries = allLogs.map(log => ({
            role: 'system',
            content: log,
            timestamp: new Date().toISOString()
        }));

        const narratorTurn = {
            role: 'narrator',
            content: narrative.text,
            timestamp: new Date().toISOString()
        };

        const finalHistory = [...startHistory, playerTurn, ...systemEntries, narratorTurn];

        // 2. Apply Deltas
        let updatedTier1 = { ...tier1 };
        let updatedTier0 = {
            ...tier0,
            dialogue_history: finalHistory
        };

        // Apply Action Delta (Tier 1)
        for (const [key, val] of Object.entries(action.mechanicalDelta)) {
            // "tier1_mechanical.stamina.current" -> ["stamina", "current"]
            const path = key.replace('tier1_mechanical.', '');
            const parts = path.split('.');

            // Simple specific patch for "stamina.current" / "health.current"
            if (parts.length === 2) {
                const [category, FIELD] = parts; // e.g. stamina, current
                if (!updatedTier1[category]) updatedTier1[category] = {};

                const currentVal = updatedTier1[category][FIELD] || 0;
                updatedTier1[category][FIELD] = currentVal + (val as number);
            }
        }

        // Apply Consequence Delta (Tier 0)
        for (const [key, val] of Object.entries(consequence.tier0Delta)) {
            if (!updatedTier0.world_state) updatedTier0.world_state = {};

            const parts = key.split('.');
            const finalKey = parts[parts.length - 1];

            updatedTier0.world_state[finalKey] = val;
        }

        // 3. Update DB (Sharded Columns)
        const payload = {
            mechanical_state: updatedTier1,
            narrative_focus: updatedTier0,
            scene_registry: tier2,
            action_queue: queue,
            updated_at: new Date().toISOString()
        };

        const { data: updated, error } = await this.supabase
            .from('chimera_game_states')
            .update(payload)
            .eq('id', initialState.id)
            .select()
            .single();

        if (error) throw new Error(error.message);

        return updated;
    }
}
