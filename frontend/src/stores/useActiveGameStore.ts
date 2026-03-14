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
                // Try mechanical index first (most reliable), then root player_id, then fallback search
                const playerId = mech.index?.player_id || anyState.player_id;
                const allEntities = mech.entities || {};

                console.log('[syncState] Debug - Player Lookup:', {
                    playerId,
                    mechIndexPlayerId: mech.index?.player_id,
                    rootPlayerId: anyState.player_id,
                    hasMech: !!mech,
                    hasEntities: !!mech.entities,
                    entityKeys: Object.keys(allEntities),
                    mechIndex: mech.index
                });

                let playerEntity = playerId ? allEntities[playerId] : null;
                if (!playerEntity && playerId) {
                    console.warn('[syncState] Player entity not found by ID, trying fallback search');
                    // Fallback: search by type if ID lookup fails
                    playerEntity = Object.values(allEntities).find((e: any) => e.type === 'PLAYER' || e.type === 'player');
                    console.log('[syncState] Fallback search found player:', !!playerEntity);
                } else if (!playerId) {
                    console.warn('[syncState] No player ID found, using fallback search');
                    playerEntity = Object.values(allEntities).find((e: any) => e.type === 'PLAYER' || e.type === 'player');
                    console.log('[syncState] Fallback search found player:', !!playerEntity);
                }

                // 4. Extract Vitals
                let newVitals = get().vitals;
                if (playerEntity && playerEntity.properties) {
                    const props = playerEntity.properties;

                    // CRITICAL: Read current_stamina (the resource), not stamina (which might be max/static)
                    const currentStamina = props.current_stamina ?? props.stamina ?? 100;
                    const currentSatiety = props.satiety ?? props.saturation ?? 100;

                    console.log('[syncState] Extracting Vitals from Player Entity:', {
                        playerId,
                        current_stamina: props.current_stamina,
                        stamina: props.stamina,
                        satiety: props.satiety,
                        saturation: props.saturation,
                        extractedStamina: currentStamina,
                        extractedSatiety: currentSatiety,
                        allProps: Object.keys(props)
                    });

                    newVitals = {
                        hp: props.hp ?? 100,
                        maxHp: props.maxHp ?? props.max_hp ?? 100,
                        stamina: currentStamina, // Use current_stamina for reactivity
                        saturation: currentSatiety, // Use satiety for reactivity
                        inCombat: mech.in_combat ?? false
                    };
                } else if (mech.health) {
                    // Fallback to legacy global stats if entities missing
                    console.log('[syncState] Using legacy health fallback');
                    newVitals = {
                        hp: mech.health?.current ?? 100,
                        maxHp: mech.health?.max ?? 100,
                        stamina: mech.stamina?.current ?? 100,
                        saturation: 100,
                        inCombat: mech.in_combat ?? false
                    };
                } else {
                    console.warn('[syncState] No player entity or health found, keeping default vitals');
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
                // CRITICAL: Create new object references to ensure React detects changes
                const newEntities = { ...allEntities }; // Spread to create new reference

                console.log('[ActiveGameStore] Synced State:', {
                    newVitals,
                    ctx,
                    narrative,
                    playerEntity,
                    playerId,
                    entitiesCount: Object.keys(newEntities).length,
                    playerEntityInNewEntities: !!newEntities[playerId || '']
                });

                set({
                    gameState: serverState,
                    vitals: newVitals,
                    suggested_actions: newSuggestions,
                    entities: newEntities // Use new reference
                });

                console.log('[ActiveGameStore] Store updated. New vitals:', newVitals);
            },

            commitInput: async () => {
                const { draftText, activeGameId, inputMode } = get();

                if (!draftText.trim() || !activeGameId || inputMode === 'locked' || inputMode === 'thinking') return;

                // 1. Lock UI
                set({ inputMode: 'thinking' });

                try {
                    // 2. Call API
                    const { turn, delta, new_logs } = await activeGameApi.submitTurn(activeGameId, { input: draftText });

                    // 3. Apply Delta & Append Logs (Event-Driven Update)
                    const currentState = get().gameState as any;
                    if (currentState) {
                        // A. Identify Keys
                        const mechKey = currentState.tier1_mechanical ? 'tier1_mechanical' :
                            currentState.mechanical_state ? 'mechanical_state' :
                                'mechanical';
                        const narrKey = currentState.narrative_focus ? 'narrative_focus' :
                            currentState.tier0_narrative ? 'tier0_narrative' :
                                'narrative';

                        const currentMech = currentState[mechKey] || {};
                        const currentNarr = currentState[narrKey] || {};

                        // B. Deep Merge Delta into Mechanical State
                        const mergeDelta = (target: any, source: any) => {
                            for (const key in source) {
                                if (source[key] instanceof Object && key in target) {
                                    Object.assign(source[key], mergeDelta(target[key], source[key]));
                                }
                            }
                            Object.assign(target || {}, source);
                            return target;
                        };

                        const updatedMechanical = JSON.parse(JSON.stringify(currentMech));
                        mergeDelta(updatedMechanical, delta || {});

                        // C. Append New Logs
                        const updatedNarrative = { ...currentNarr };
                        const currentHistory = updatedNarrative.dialogue_history || [];
                        updatedNarrative.dialogue_history = [...currentHistory, ...(new_logs || [])];

                        // D. Construct New State
                        const newState = {
                            ...currentState,
                            [mechKey]: updatedMechanical,
                            [narrKey]: updatedNarrative
                        };

                        // E. Sync Store
                        console.log(`[ActiveGameStore] Applying delta to ${mechKey} and logs to ${narrKey}`);
                        get().syncState(newState);
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
