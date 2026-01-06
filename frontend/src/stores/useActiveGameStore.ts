import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { activeGameApi } from '@/features/active-game/services/activeGameApi';
import type { GameState } from '@shared/types/chimera-runtime';

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
                const anyState = serverState as any;

                // 2. Extract Vitals
                const mech = anyState.tier1_mechanical || anyState.mechanical_state || anyState.state?.tier1_mechanical;
                let newVitals = get().vitals;

                if (mech) {
                    newVitals = {
                        hp: mech.health?.current ?? 100,
                        maxHp: mech.health?.max ?? 100,
                        stamina: mech.stamina?.current ?? 100,
                        saturation: 100, // Not yet in mock
                        inCombat: mech.in_combat ?? false
                    };
                }

                // 3. Extract Context
                const narrative = anyState.tier0_narrative || anyState.narrative_focus || anyState.narrative || {};
                const ctx = narrative.scene_context || {};

                // [CLIENT-SIDE MIGRATION] Patch legacy states missing location/time
                if (!ctx.location) ctx.location = ctx.name || "The Wobbly Goblin Tavern";
                if (!ctx.time) ctx.time = "Night";
                if (!ctx.atmosphere && !ctx.description) ctx.atmosphere = "Anticipation";

                const newSuggestions = ctx.available_actions || [];
                const newEntities = mech.entities || {};

                // 4. Update Store
                console.log('[ActiveGameStore] Synced State:', { newVitals, ctx, narrative });
                set({
                    gameState: serverState,
                    vitals: newVitals,
                    suggested_actions: newSuggestions,
                    entities: newEntities
                });
            },

            commitInput: async () => {
                const { draftText, activeGameId, inputMode } = get();

                if (!draftText.trim() || !activeGameId || inputMode === 'locked' || inputMode === 'thinking') return;

                // 1. Lock UI
                set({ inputMode: 'thinking' });

                try {
                    // 2. Call API
                    const newState = await activeGameApi.submitTurn(activeGameId, { input: draftText });

                    // 3. Direct/Optimistic Update (The "Hybrid" part - we trust the return mostly)
                    get().syncState(newState);

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
