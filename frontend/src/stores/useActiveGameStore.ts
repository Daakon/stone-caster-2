import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { activeGameApi } from '@/features/active-game/services/activeGameApi';

export type InputMode = 'idle' | 'drafting' | 'thinking' | 'locked';

export interface Vitals {
    hp: number;
    maxHp: number;
    stamina: number; // 0-100%
    saturation: number; // 0-100%
    inCombat: boolean;
}

interface InputState {
    draftText: string;
    inputMode: InputMode;
    suggestionBuffer: string[];
}

interface ActiveGameState extends InputState {
    // Session State
    activeGameId: string | null;

    // HUD State
    selectedEntityId: string | null;
    vitals: Vitals;

    // Knowledge & Suggestions
    entities: Record<string, { name: string; type: 'npc' | 'enemy' | 'item' | 'other' }>;
    suggested_actions: string[];

    // Actions
    setActiveGameId: (id: string) => void;
    setDraft: (text: string) => void;
    setInputMode: (mode: InputMode) => void;
    setSuggestions: (suggestions: string[]) => void;

    setSelectedEntity: (id: string | null) => void;
    updateVitals: (vitals: Partial<Vitals>) => void;

    updateEntities: (entities: Record<string, { name: string; type: 'npc' | 'enemy' | 'item' | 'other' }>) => void;
    setSuggestedActions: (actions: string[]) => void;

    // Logic
    commitInput: () => Promise<void>;
    unlockInput: () => void;
    clearDraft: () => void;
}

export const useActiveGameStore = create<ActiveGameState>()(
    devtools(
        (set, get) => ({
            // Initial State
            activeGameId: null,
            draftText: '',
            inputMode: 'idle',
            suggestionBuffer: [],
            selectedEntityId: null,
            vitals: { hp: 100, maxHp: 100, stamina: 100, saturation: 100, inCombat: false },
            entities: {},
            suggested_actions: [],

            // Actions
            setActiveGameId: (id) => set({ activeGameId: id }),
            setDraft: (text) => set((state) => ({
                draftText: text,
                inputMode: state.inputMode === 'thinking' || state.inputMode === 'locked' ? state.inputMode : 'drafting'
            })),
            setInputMode: (mode) => set({ inputMode: mode }),
            setSuggestions: (suggestions) => set({ suggestionBuffer: suggestions }),

            setSelectedEntity: (id) => set({ selectedEntityId: id }),
            updateVitals: (vitals) => set((state) => ({ vitals: { ...state.vitals, ...vitals } })),

            updateEntities: (entities) => set((state) => ({ entities: { ...state.entities, ...entities } })),
            setSuggestedActions: (actions) => set({ suggested_actions: actions }),

            // Helpers
            commitInput: async () => {
                const { draftText, activeGameId, inputMode } = get();

                if (!draftText.trim() || !activeGameId || inputMode === 'locked' || inputMode === 'thinking') return;

                set({ inputMode: 'thinking' });

                try {
                    const newState = await activeGameApi.submitTurn(activeGameId, { input: draftText });

                    // Merge State Logic
                    const anyState = newState as any;
                    const mech = anyState.tier1_mechanical || anyState.mechanical_state;

                    if (mech) {
                        get().updateVitals({
                            hp: mech.health?.current ?? 100,
                            maxHp: mech.health?.max ?? 100,
                            stamina: mech.stamina?.current ?? 100,
                            inCombat: mech.in_combat ?? false
                        });
                    }

                    // Update Suggestions & Entities
                    const narrative = anyState.narrative || {};
                    const ctx = narrative.scene_context || {};
                    if (ctx.available_actions) get().setSuggestedActions(ctx.available_actions);
                    if (ctx.visible_entities) get().updateEntities(ctx.visible_entities);

                    // Success Unlock active
                    set({ inputMode: 'idle', draftText: '' });
                } catch (error) {
                    console.error("Turn failed:", error);
                    set({ inputMode: 'idle' });
                    // TODO: Trigger sensory FX
                }
            },

            lockInput: () => set({ inputMode: 'locked' }),
            unlockInput: () => set({ inputMode: 'idle' }),
            clearDraft: () => set({ draftText: '', inputMode: 'idle' }),
        }),
        { name: 'ActiveGameStore' }
    )
);
