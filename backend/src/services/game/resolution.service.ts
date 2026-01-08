

import { EngineExecutor } from './engine/executor.js';

export interface Mas1Intent {
    type: 'COMBAT' | 'NARRATIVE' | 'OTHER';
    intent: string; // "combat_action" | "attempt_action"
    skill_id: string;
    difficulty_mod: number;
    duration_tag: string;
    confidence: number;
    analysis: string;
    parameters: any;
}

export interface ResolutionResult {
    success: boolean;
    logs: string[];
    mechanicalDelta: Record<string, any>;
    intent: Mas1Intent;
    state?: any; // The updated state after engine execution
}

export class ResolutionService {
    async resolve(input: string, state: any): Promise<ResolutionResult> {
        const lower = input.toLowerCase();

        // 1. Mock MAS-1 Interpretation
        let mas1: Mas1Intent = {
            type: 'NARRATIVE',
            intent: 'attempt_action',
            skill_id: 'root_finesse',
            difficulty_mod: 0,
            duration_tag: 'moment',
            confidence: 1.0,
            analysis: 'Heuristic Default',
            parameters: {}
        };

        if (lower.includes('attack') || lower.includes('hit') || lower.includes('strike') || lower.includes('fight')) {
            mas1 = { type: 'COMBAT', intent: 'combat_action', skill_id: 'root_force', difficulty_mod: 0, duration_tag: 'moment', confidence: 1.0, analysis: 'Combat Intent', parameters: {} };
        } else if (lower.includes('look') || lower.includes('search')) {
            mas1 = { type: 'NARRATIVE', intent: 'attempt_action', skill_id: 'root_awareness', difficulty_mod: 0, duration_tag: 'scene', confidence: 1.0, analysis: 'Observation Intent', parameters: {} };
        }

        const logs: string[] = [];
        logs.push(`[SYSTEM] MAS-1 Intent: ${mas1.intent}`);

        // 2. Deterministic State Modification (Mock Engine)
        // Access via mechanical state structure
        const mech = state.mechanical || {};
        const playerId = mech.index?.player_id;

        // Safety check
        if (!playerId || !mech.entities || !mech.entities[playerId]) {
            logs.push('[ENGINE] Error: Player Entity not found in state.');
            return { success: false, logs, mechanicalDelta: {}, intent: mas1 };
        }

        // 3. Identify Target Entity (for combat actions)
        let targetId: string | null = null;
        let targetEntity: any = null;

        if (mas1.type === 'COMBAT') {
            // Try to extract target from input text (simple heuristic)
            // Look for entity names in the input
            const entityNames = Object.values(mech.entities || {}).map((e: any) => {
                const name = e.properties?.name || e.properties?.display_name || '';
                return { id: e.id, name: name.toLowerCase() };
            });

            // Check if input mentions any entity name
            for (const { id, name } of entityNames) {
                if (id !== playerId && name && lower.includes(name)) {
                    targetId = id;
                    targetEntity = mech.entities[id];
                    logs.push(`[ENGINE] Target identified by name: ${name} (${id})`);
                    break;
                }
            }

            // Fallback: Find first non-player entity
            if (!targetId) {
                const nonPlayerEntities = Object.entries(mech.entities || {}).filter(
                    ([id, entity]: [string, any]) => id !== playerId && (entity.type === 'NPC' || entity.type === 'npc' || entity.type !== 'PLAYER')
                );
                
                if (nonPlayerEntities.length > 0) {
                    targetId = nonPlayerEntities[0][0];
                    targetEntity = nonPlayerEntities[0][1];
                    logs.push(`[ENGINE] Target identified by fallback: ${targetId}`);
                }
            }
        }

        // 4. Lookup: Retrieve the current player entity
        const playerEntity = mech.entities[playerId];
        
        // Initialize properties if missing
        if (!playerEntity.properties) {
            playerEntity.properties = {};
        }
        if (targetEntity && !targetEntity.properties) {
            targetEntity.properties = {};
        }

        // 5. Calculate Player Costs
        const currentStamina = (playerEntity.properties.current_stamina ?? 100) as number;
        const currentSatiety = (playerEntity.properties.satiety ?? 100) as number;

        // Define delta values (negative for reduction)
        const staminaDelta = mas1.type === 'COMBAT' ? -5 : -1;
        const satietyDelta = -1;

        // Calculate new values with Math.max to prevent negatives
        const newStamina = Math.max(0, currentStamina + staminaDelta);
        const newSatiety = Math.max(0, currentSatiety + satietyDelta);

        // 6. Calculate Target Consequences (for combat)
        let targetCombatCondition: string | null = null;
        if (mas1.type === 'COMBAT' && targetId && targetEntity) {
            const currentCondition = targetEntity.properties.combat_condition || 'Healthy';
            
            // Transition logic: Healthy -> Wounded -> Defeated
            if (currentCondition === 'Healthy') {
                targetCombatCondition = 'Wounded';
            } else if (currentCondition === 'Wounded') {
                targetCombatCondition = 'Defeated';
            } else {
                // Already defeated or unknown state, keep current
                targetCombatCondition = currentCondition;
            }
            
            logs.push(`[ENGINE] Target ${targetId} condition: ${currentCondition} -> ${targetCombatCondition}`);
        }

        // --- DEBUG STATE UPDATE ---
        console.log('--- DEBUG STATE UPDATE ---');
        console.log('Player ID:', playerId);
        console.log('Target ID:', targetId);
        console.log('Old Stamina:', currentStamina);
        console.log('Old Satiety:', currentSatiety);
        if (targetId) {
            console.log('Target Old Condition:', targetEntity?.properties?.combat_condition || 'Healthy');
            console.log('Target New Condition:', targetCombatCondition);
        }

        // 7. Mutate State: Update entity.properties with calculated values
        // CRITICAL: Use structuredClone to avoid mutating the original state
        const newState = structuredClone(state);
        const newPlayerEntity = newState.mechanical.entities[playerId];
        
        if (!newPlayerEntity.properties) {
            newPlayerEntity.properties = {};
        }

        // Explicitly assign the calculated values for player
        newPlayerEntity.properties.current_stamina = newStamina;
        newPlayerEntity.properties.satiety = newSatiety;

        // Update target entity if combat action
        if (mas1.type === 'COMBAT' && targetId && targetCombatCondition) {
            const newTargetEntity = newState.mechanical.entities[targetId];
            if (!newTargetEntity.properties) {
                newTargetEntity.properties = {};
            }
            newTargetEntity.properties.combat_condition = targetCombatCondition;
        }

        // Verify the mutations
        const verifiedStamina = newState.mechanical.entities[playerId].properties.current_stamina;
        const verifiedSatiety = newState.mechanical.entities[playerId].properties.satiety;
        const verifiedTargetCondition = targetId ? newState.mechanical.entities[targetId]?.properties?.combat_condition : null;

        // 8. Construct Composite Delta: Return delta that reflects the schema (with properties nesting)
        const keyedDelta: Record<string, any> = {
            [playerId]: {
                properties: {
                    current_stamina: staminaDelta,
                    satiety: satietyDelta
                }
            }
        };

        // Add target delta if combat action
        if (mas1.type === 'COMBAT' && targetId && targetCombatCondition) {
            keyedDelta[targetId] = {
                properties: {
                    combat_condition: targetCombatCondition
                }
            };
        }

        console.log('Generated Delta:', JSON.stringify(keyedDelta, null, 2));
        console.log('New Stamina (InMemory):', verifiedStamina);
        console.log('New Satiety (InMemory):', verifiedSatiety);
        if (targetId) {
            console.log('New Target Condition (InMemory):', verifiedTargetCondition);
        }
        console.log('--- END DEBUG STATE UPDATE ---');

        logs.push(`[ENGINE] Applied Delta to ${playerId}: stamina ${currentStamina} -> ${newStamina} (${staminaDelta}), satiety ${currentSatiety} -> ${newSatiety} (${satietyDelta})`);
        if (targetId && targetCombatCondition) {
            logs.push(`[ENGINE] Applied Delta to ${targetId}: combat_condition -> ${targetCombatCondition}`);
        }

        return {
            success: true,
            logs,
            mechanicalDelta: keyedDelta,
            intent: mas1,
            state: newState
        };
    }
}
