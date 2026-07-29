import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { toast } from 'sonner';
import { activeGameApi } from '@/features/active-game/services/activeGameApi';
import type { GameState } from '@shared/types/chimera-runtime';

export type InputMode = 'idle' | 'drafting' | 'thinking' | 'locked';

export interface Vitals {
    hp: number;
    maxHp: number;
    stamina: number; // 0-100%
    saturation: number; // 0-100%
    inCombat: boolean;
    /** Player's non-default condition (e.g. "Wounded", "Collapsed"), null when fine */
    condition: string | null;
}

interface ActiveGameState {
    // Session State
    activeGameId: string | null;
    gameState: GameState | null; // The Session Truth

    // Input State
    draftText: string;
    inputMode: InputMode;
    /** The input currently being processed by the server (renders as a pending turn in the feed) */
    pendingInput: string | null;
    lastError: string | null;

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

/**
 * Apply a server delta additively: numbers add onto numbers, nested objects
 * merge recursively, everything else overwrites.
 */
const applyAdditiveDelta = (target: any, source: any) => {
    for (const key of Object.keys(source)) {
        const val = source[key];
        if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
            if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
                target[key] = {};
            }
            applyAdditiveDelta(target[key], val);
        } else if (typeof val === 'number' && typeof target[key] === 'number') {
            target[key] += val;
        } else {
            target[key] = val;
        }
    }
};

export const useActiveGameStore = create<ActiveGameState>()(
    devtools(
        (set, get) => ({
            // Initial State
            activeGameId: null,
            gameState: null,
            draftText: '',
            inputMode: 'idle',
            pendingInput: null,
            lastError: null,

            // Default Derived
            vitals: { hp: 100, maxHp: 100, stamina: 100, saturation: 100, inCombat: false, condition: null },
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
                const queue = anyState.action_queue || [];

                // 3. Locate Player Entity
                // Try mechanical index first (most reliable), then root player_id, then fallback search
                const playerId = mech.index?.player_id || anyState.player_id;
                const allEntities = mech.entities || {};

                let playerEntity = playerId ? allEntities[playerId] : null;
                if (!playerEntity) {
                    // Fallback: search by type if ID lookup fails
                    playerEntity = Object.values(allEntities).find((e: any) => e.type === 'PLAYER' || e.type === 'player');
                }

                // 4. Extract Vitals
                let newVitals = get().vitals;
                if (playerEntity && playerEntity.properties) {
                    const props = playerEntity.properties;

                    // CRITICAL: Read current_stamina (the resource), not stamina (which might be max/static)
                    const currentStamina = props.current_stamina ?? props.stamina ?? 100;
                    const currentSatiety = props.satiety ?? props.saturation ?? 100;

                    // Surface the most urgent non-default condition (combat first)
                    const combatCondition = props.combat_condition && props.combat_condition !== 'Healthy'
                        ? props.combat_condition : null;
                    const physicalCondition = props.physical_condition && props.physical_condition !== 'Rested'
                        ? props.physical_condition : null;

                    newVitals = {
                        hp: props.hp ?? 100,
                        maxHp: props.maxHp ?? props.max_hp ?? 100,
                        stamina: currentStamina, // Use current_stamina for reactivity
                        saturation: currentSatiety, // Use satiety for reactivity
                        inCombat: mech.in_combat ?? false,
                        condition: combatCondition || physicalCondition
                    };
                } else if (mech.health) {
                    // Fallback to legacy global stats if entities missing
                    newVitals = {
                        hp: mech.health?.current ?? 100,
                        maxHp: mech.health?.max ?? 100,
                        stamina: mech.stamina?.current ?? 100,
                        saturation: 100,
                        inCombat: mech.in_combat ?? false,
                        condition: null
                    };
                }

                // 5. Extract Context
                const ctx = narrative.scene_context || {};

                // [CLIENT-SIDE MIGRATION] Patch legacy states missing location/time
                if (!ctx.location) ctx.location = ctx.name || "Unknown Location";
                if (!ctx.time) ctx.time = "Unknown";

                // Suggestions: Check Queue first, then context
                const newSuggestions = queue.length > 0 ? queue : (ctx.available_actions || []);

                // 6. Update Store
                // CRITICAL: Create new object references to ensure React detects changes
                set({
                    gameState: serverState,
                    vitals: newVitals,
                    suggested_actions: newSuggestions,
                    entities: { ...allEntities }
                });
            },

            commitInput: async () => {
                const { draftText, activeGameId, inputMode } = get();

                if (!draftText.trim() || !activeGameId || inputMode === 'locked' || inputMode === 'thinking') return;

                // 1. Lock UI; surface the in-flight input in the feed
                set({ inputMode: 'thinking', pendingInput: draftText, lastError: null });

                try {
                    // 2. Call API
                    const { delta, new_logs } = await activeGameApi.submitTurn(activeGameId, { input: draftText });

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

                        const anyDelta = (delta || {}) as any;

                        // B. Structured delta application — each delta root has a home:
                        //    entities → mechanical shard (additive), world.narrative →
                        //    narrative shard, action_queue → suggestions. Unknown roots
                        //    are ignored rather than blindly merged into mechanics.
                        const updatedMechanical = JSON.parse(JSON.stringify(currentState[mechKey] || {}));
                        if (anyDelta.entities) {
                            if (!updatedMechanical.entities) updatedMechanical.entities = {};
                            applyAdditiveDelta(updatedMechanical.entities, anyDelta.entities);
                        }

                        // C. Append New Logs + narrative-scoped world changes
                        const updatedNarrative = JSON.parse(JSON.stringify(currentState[narrKey] || {}));
                        if (anyDelta.world?.narrative) {
                            applyAdditiveDelta(updatedNarrative, anyDelta.world.narrative);
                        }
                        const currentHistory = updatedNarrative.dialogue_history || [];
                        updatedNarrative.dialogue_history = [...currentHistory, ...(new_logs || [])];

                        // D. Construct New State
                        const newState = {
                            ...currentState,
                            [mechKey]: updatedMechanical,
                            [narrKey]: updatedNarrative,
                            ...(Array.isArray(anyDelta.action_queue) && anyDelta.action_queue.length > 0
                                ? { action_queue: anyDelta.action_queue }
                                : {})
                        };

                        // E. Sync Store
                        get().syncState(newState);
                    }

                    // 4. Reset UI
                    set({ inputMode: 'idle', draftText: '', pendingInput: null });

                } catch (error) {
                    console.error('[ActiveGameStore] Turn failed:', error);
                    const message = error instanceof Error && error.message
                        ? error.message
                        : 'Failed to process turn. Please try again.';

                    // Keep the draft so the player can retry without retyping
                    set({ inputMode: 'drafting', pendingInput: null, lastError: message });
                    toast.error(message, {
                        action: {
                            label: 'Retry',
                            onClick: () => { void get().commitInput(); }
                        }
                    });
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
