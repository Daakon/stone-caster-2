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
                    const { turn, delta } = await activeGameApi.submitTurn(activeGameId, { input: draftText });

                    // --- FRONTEND DEBUG ---
                    console.log('Frontend Delta received:', delta);
                    console.log('Turn received:', turn);

                    // 3. Merging (Hybrid Sync) - IMMUTABLE PATTERN
                    const currentGameState = get().gameState;
                    if (currentGameState) {
                        // A. Merge Delta (Mechanical changes) - Using Immutable Patterns
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const currentMech = (currentGameState as any).mechanical_state || (currentGameState as any).mechanical || {};
                        const playerId = currentMech.index?.player_id;

                        console.log('Frontend Player ID:', playerId);
                        console.log('Frontend Mechanical State:', {
                            hasEntities: !!currentMech.entities,
                            entityKeys: Object.keys(currentMech.entities || {}),
                            playerEntityExists: !!currentMech.entities?.[playerId],
                            currentStamina: currentMech.entities?.[playerId]?.properties?.current_stamina,
                            currentSatiety: currentMech.entities?.[playerId]?.properties?.satiety
                        });

                        let nextGameState = currentGameState;

                        // Unwrap delta.entities if present (backend sends { entities: { ... }, world: { ... } })
                        const entityDelta = (delta as any)?.entities || delta;
                        const worldDelta = (delta as any)?.world;
                        
                        if (currentMech.entities && entityDelta && playerId) {
                            // IMMUTABLE UPDATE PATTERN: Create new object references at every level
                            const newEntities: Record<string, any> = { ...currentMech.entities };

                            // Iterate Keyed Delta: { [entityId]: { properties: { current_stamina: -5, satiety: -1 } } }
                            // OR: { [entityId]: { combat_condition: "Wounded" } } (flat structure)
                            Object.entries(entityDelta).forEach(([entityId, entityDeltaValue]) => {
                                const oldEntity = currentMech.entities[entityId];
                                if (!oldEntity || !oldEntity.properties) {
                                    console.warn(`Frontend: Entity ${entityId} not found or missing properties`);
                                    return;
                                }

                                // Handle nested properties structure OR flat structure
                                const playerDelta = entityDeltaValue as any;
                                const propertiesDelta = playerDelta?.properties;
                                
                                // If delta is flat (e.g., { combat_condition: "Wounded" }), treat it as properties
                                const isFlatDelta = !propertiesDelta && typeof playerDelta === 'object' && playerDelta !== null;
                                
                                console.log(`Frontend Processing Delta for Entity ${entityId}:`, {
                                    hasProperties: !!propertiesDelta,
                                    isFlatDelta,
                                    propertiesDelta,
                                    playerDelta,
                                    currentEntityProps: oldEntity.properties
                                });

                                // Process nested properties structure
                                if (propertiesDelta && typeof propertiesDelta === 'object') {
                                    // 1. Clone the specific entity's properties (Spread operator)
                                    const oldProperties = oldEntity.properties;
                                    const newProperties = { ...oldProperties };

                                    // 2. Apply changes to the CLONE (handles both numeric deltas and string assignments)
                                    Object.entries(propertiesDelta as Record<string, any>).forEach(([key, val]) => {
                                        if (typeof val === 'number') {
                                            // Numeric delta: add to current value
                                            // Get current value (default to 100 for stamina/satiety, 0 for others)
                                            const defaultValue = (key === 'current_stamina' || key === 'satiety') ? 100 : 0;
                                            const current = (oldProperties[key] ?? defaultValue) as number;
                                            
                                            // Apply math for visual transition (add delta to current)
                                            // Delta is relative (-5), so we add it to current
                                            const newVal = Math.max(0, current + val);
                                            
                                            console.log(`Frontend Applying ${key}: ${current} + ${val} = ${newVal}`);
                                            
                                            newProperties[key] = newVal;

                                            // Compatibility Mapping (current_stamina <-> stamina)
                                            if (key === 'current_stamina') {
                                                newProperties['stamina'] = newVal;
                                            }
                                            if (key === 'stamina') {
                                                newProperties['current_stamina'] = newVal;
                                            }
                                        } else if (typeof val === 'string' || typeof val === 'boolean') {
                                            // String/Boolean assignment: set directly (e.g., combat_condition: "Wounded")
                                            console.log(`Frontend Setting ${key}: ${oldProperties[key]} -> ${val}`);
                                            newProperties[key] = val;
                                        }
                                    });

                                    // 3. Clone the Entity and inject new properties
                                    const newEntity = { ...oldEntity, properties: newProperties };

                                    // 4. Clone the Entity Map and inject new Entity
                                    newEntities[entityId] = newEntity;
                                    
                                    console.log(`Frontend After Delta - Entity ${entityId} properties:`, newProperties);
                                } else if (isFlatDelta) {
                                    // Handle flat structure: { combat_condition: "Wounded" } directly on entity
                                    console.log('Frontend Using flat structure handling (no properties wrapper)');
                                    const oldProperties = oldEntity.properties;
                                    const newProperties = { ...oldProperties };

                                    Object.entries(playerDelta as Record<string, any>).forEach(([key, val]) => {
                                        if (typeof val === 'number') {
                                            // Numeric delta: add to current
                                            const defaultValue = (key === 'current_stamina' || key === 'satiety') ? 100 : 0;
                                            const current = (oldProperties[key] ?? defaultValue) as number;
                                            const newVal = Math.max(0, current + val);
                                            
                                            console.log(`Frontend Applying (flat) ${key}: ${current} + ${val} = ${newVal}`);
                                            
                                            newProperties[key] = newVal;

                                            if (key === 'current_stamina') {
                                                newProperties['stamina'] = newVal;
                                            }
                                            if (key === 'stamina') {
                                                newProperties['current_stamina'] = newVal;
                                            }
                                        } else if (typeof val === 'string' || typeof val === 'boolean') {
                                            // String/Boolean assignment: set directly
                                            console.log(`Frontend Setting (flat) ${key}: ${oldProperties[key]} -> ${val}`);
                                            newProperties[key] = val;
                                        }
                                    });

                                    const newEntity = { ...oldEntity, properties: newProperties };
                                    newEntities[entityId] = newEntity;
                                }
                            });

                            // 5. Clone the mechanical state and inject new entities
                            let newMech = {
                                ...currentMech,
                                entities: newEntities
                            };
                            
                            // 6. Apply world-level changes (e.g., atmosphere)
                            if (worldDelta && typeof worldDelta === 'object') {
                                const newGlobals = { ...(newMech.globals || {}) };
                                
                                // Merge world delta into globals
                                if (worldDelta.narrative) {
                                    newGlobals.narrative = {
                                        ...(newGlobals.narrative || {}),
                                        ...worldDelta.narrative
                                    };
                                }
                                
                                newMech = {
                                    ...newMech,
                                    globals: newGlobals
                                };
                                
                                console.log('Frontend Applied world delta:', worldDelta);
                            }

                            // 7. Clone the game state and inject new mechanical state
                            nextGameState = {
                                ...currentGameState,
                                mechanical_state: newMech
                            } as any;

                            console.log('Frontend Immutable Update Complete:', {
                                newStamina: newMech.entities[playerId]?.properties?.current_stamina,
                                newSatiety: newMech.entities[playerId]?.properties?.satiety
                            });
                        } else {
                            console.warn('Frontend: No entities or delta to process', {
                                hasEntities: !!currentMech.entities,
                                hasDelta: !!delta,
                                hasPlayerId: !!playerId
                            });
                            // Still clone to ensure immutability even if no delta
                            nextGameState = structuredClone(currentGameState);
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
