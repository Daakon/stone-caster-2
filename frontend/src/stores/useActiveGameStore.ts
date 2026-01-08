import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { activeGameApi } from '@/features/active-game/services/activeGameApi';
import type { GameState } from '@shared/types/chimera-runtime';
import { deepMerge } from '@/utils/deepMerge';

export type InputMode = 'idle' | 'drafting' | 'thinking' | 'locked';

export interface Vitals {
    hp: number;
    maxHp: number;
    stamina: number; // 0-100%
    saturation: number; // 0-100%
    inCombat: boolean;
}

interface ActiveGameState {
    // Session State
    activeGameId: string | null;
    gameState: GameState | null; // The Session Truth

    // Input State
    draftText: string;
    inputMode: InputMode;

    // Derived/Buffered Utils (Hydrated from GameState)
    vitals: Vitals;
    entities: Record<string, any>;
    suggested_actions: string[];

    // Actions
    setActiveGameId: (id: string) => void;
    setDraft: (text: string) => void;

    // Hybrid Sync Pattern
    syncState: (serverState: GameState) => void;
    commitInput: () => Promise<void>;

    // Utils
    lockInput: () => void;
    unlockInput: () => void;
    clearDraft: () => void;

    // UI State
    selectedEntityId: string | null;
    setSelectedEntity: (id: string | null) => void;
}

export const useActiveGameStore = create<ActiveGameState>()(
    devtools(
        (set, get) => ({
            // Initial State
            activeGameId: null,
            gameState: null,
            draftText: '',
            inputMode: 'idle',

            // Default Derived
            vitals: { hp: 100, maxHp: 100, stamina: 100, saturation: 100, inCombat: false },
            entities: {},
            suggested_actions: [],

            // Actions
            setActiveGameId: (id) => set({ activeGameId: id }),

            setDraft: (text) => set((state) => ({
                draftText: text,
                inputMode: state.inputMode === 'thinking' || state.inputMode === 'locked' ? state.inputMode : 'drafting'
            })),

            // core sync logic
            syncState: (serverState: GameState) => {
                // 1. Update Truth
                const anyState = serverState as any; // Cast for loose access to shards

                // 2. Extract Shards
                const mech = anyState.mechanical_state || anyState.tier1_mechanical || anyState.state?.tier1_mechanical || {};
                const narrative = anyState.narrative_focus || anyState.tier0_narrative || anyState.narrative || {};
                const registry = anyState.scene_registry || anyState.tier2_spatial || {};
                const queue = anyState.action_queue || [];

                // 3. Locate Player Entity
                // Try root player_id, then mechanical index, then fallback search
                const playerId = anyState.player_id || mech.index?.player_id;
                const allEntities = mech.entities || {};

                let playerEntity = allEntities[playerId];
                if (!playerEntity) {
                    // Fallback: search by type if ID lookup fails
                    playerEntity = Object.values(allEntities).find((e: any) => e.type === 'PLAYER' || e.type === 'player');
                }

                // 4. Extract Vitals
                let newVitals = get().vitals;
                if (playerEntity && playerEntity.properties) {
                    const props = playerEntity.properties;
                    newVitals = {
                        hp: props.hp ?? 100,
                        maxHp: props.maxHp ?? props.max_hp ?? 100,
                        stamina: props.stamina ?? 100,
                        saturation: props.saturation ?? 100,
                        inCombat: mech.in_combat ?? false
                    };
                } else if (mech.health) {
                    // Fallback to legacy global stats if entities missing
                    newVitals = {
                        hp: mech.health?.current ?? 100,
                        maxHp: mech.health?.max ?? 100,
                        stamina: mech.stamina?.current ?? 100,
                        saturation: 100,
                        inCombat: mech.in_combat ?? false
                    };
                }

                // 5. Extract Context
                const ctx = narrative.scene_context || {};

                // [CLIENT-SIDE MIGRATION] Patch legacy states missing location/time
                if (!ctx.location) ctx.location = ctx.name || "The Wobbly Goblin Tavern";
                if (!ctx.time) ctx.time = "Night";
                if (!ctx.atmosphere && !ctx.description) ctx.atmosphere = "Anticipation";

                // Suggestions: Check Queue first, then context
                const newSuggestions = queue.length > 0 ? queue : (ctx.available_actions || []);

                // 6. Update Store
                console.log('[ActiveGameStore] Synced State:', { newVitals, ctx, narrative, playerEntity });
                set({
                    gameState: serverState,
                    vitals: newVitals,
                    suggested_actions: newSuggestions,
                    entities: allEntities
                });
            },

            commitInput: async () => {
                const { draftText, activeGameId, inputMode } = get();

                if (!draftText.trim() || !activeGameId || inputMode === 'locked' || inputMode === 'thinking') return;

                // 1. Lock UI
                set({ inputMode: 'thinking' });

                try {
                    // 2. Call API
                    const { turn, delta } = await activeGameApi.submitTurn(activeGameId, { input: draftText });

                    // 3. Merging (Hybrid Sync)
                    // 3. Merging (Hybrid Sync)
                    const currentGameState = get().gameState;
                    if (currentGameState) {
                        // A. Merge Delta (Mechanical changes)
                        // Use structuredClone for deep copy since deepMerge might not be sufficient/safe for immutability here
                        const nextGameState = structuredClone(currentGameState); // Clone entire state

                        // Locate Player Entity in the New State
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const mech = (nextGameState as any).mechanical_state || {};
                        const playerId = mech.index?.player_id;

                        if (playerId && mech.entities && mech.entities[playerId] && delta) {
                            const playerProps = mech.entities[playerId].properties;

                            // Iterate Input Delta: { stamina: -5 }
                            Object.entries(delta).forEach(([key, val]) => {
                                if (typeof val === 'number') {
                                    // 1. Direct key match (e.g. 'stamina' -> 'stamina')
                                    if (typeof playerProps[key] === 'number') {
                                        playerProps[key] += val;
                                    }
                                    // 2. Schema Translation (e.g. 'stamina' -> 'current_stamina')
                                    // This ensures LeftSidebar (using current_*) updates too.
                                    const currentKey = `current_${key}`;
                                    if (typeof playerProps[currentKey] === 'number') {
                                        playerProps[currentKey] += val;
                                    }

                                    // 3. Initialize if missing?
                                    if (typeof playerProps[key] === 'undefined' && typeof playerProps[currentKey] === 'undefined') {
                                        playerProps[key] = val;
                                    }
                                }
                            });
                        }

                        // B. Append Logs (Narrative changes)
                        // Construct Log Entries from Turn Record
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const newLogs: any[] = [];

                        // Thought Chain (System)
                        if (turn.mas2_narration?.thought_chain) {
                            newLogs.push({
                                id: crypto.randomUUID(),
                                role: 'system',
                                content: `[THOUGHT] ${turn.mas2_narration.thought_chain}`,
                                timestamp: new Date().toISOString()
                            });
                        }

                        // Player Input (Player)
                        newLogs.push({
                            id: crypto.randomUUID(),
                            role: 'player',
                            content: turn.player_input,
                            timestamp: new Date().toISOString()
                        });

                        // Narration (Narrator)
                        if (turn.mas2_narration?.narration) {
                            newLogs.push({
                                id: crypto.randomUUID(),
                                role: 'narrator', // Frontend uses 'narrator' for AI output
                                content: turn.mas2_narration.narration,
                                timestamp: new Date().toISOString()
                            });
                        }

                        // Push to history
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        if (!nextGameState.narrative_focus) nextGameState.narrative_focus = { dialogue_history: [] } as any;
                        if (!nextGameState.narrative_focus.dialogue_history) nextGameState.narrative_focus.dialogue_history = [];

                        // We push mutably to the deepMerged copy
                        nextGameState.narrative_focus.dialogue_history.push(...newLogs);

                        // C. Update Store using syncState to derived vitals
                        get().syncState(nextGameState);
                    }

                    // 4. Reset UI
                    set({ inputMode: 'idle', draftText: '' });

                } catch (error) {
                    console.error("Turn failed:", error);
                    set({ inputMode: 'idle' });
                    // TODO: Toast or Error State
                }
            },

            lockInput: () => set({ inputMode: 'locked' }),
            unlockInput: () => set({ inputMode: 'idle' }),
            clearDraft: () => set({ draftText: '', inputMode: 'idle' }),

            selectedEntityId: null,
            setSelectedEntity: (id) => set({ selectedEntityId: id }),
        }),
        { name: 'ActiveGameStore' }
    )
);
