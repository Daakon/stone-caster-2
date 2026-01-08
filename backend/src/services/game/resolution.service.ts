

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

        // 3. Lookup: Retrieve the current entity
        const entity = mech.entities[playerId];
        
        // Initialize properties if missing
        if (!entity.properties) {
            entity.properties = {};
        }

        // 4. Calculate: Perform Real Math on the correct Path
        const currentStamina = (entity.properties.current_stamina ?? 100) as number;
        const currentSatiety = (entity.properties.satiety ?? 100) as number;

        // Define delta values (negative for reduction)
        const staminaDelta = mas1.type === 'COMBAT' ? -5 : -1;
        const satietyDelta = -1;

        // Calculate new values with Math.max to prevent negatives
        const newStamina = Math.max(0, currentStamina + staminaDelta);
        const newSatiety = Math.max(0, currentSatiety + satietyDelta);

        // --- DEBUG STATE UPDATE ---
        console.log('--- DEBUG STATE UPDATE ---');
        console.log('Player ID:', playerId);
        console.log('Old Stamina:', currentStamina);
        console.log('Old Satiety:', currentSatiety);

        // 5. Mutate State: Update entity.properties with calculated values
        // CRITICAL: Use structuredClone to avoid mutating the original state
        const newState = structuredClone(state);
        const targetEntity = newState.mechanical.entities[playerId];
        
        if (!targetEntity.properties) {
            targetEntity.properties = {};
        }

        // Explicitly assign the calculated values
        targetEntity.properties.current_stamina = newStamina;
        targetEntity.properties.satiety = newSatiety;

        // Verify the mutation
        const verifiedStamina = newState.mechanical.entities[playerId].properties.current_stamina;
        const verifiedSatiety = newState.mechanical.entities[playerId].properties.satiety;

        // 6. Construct Delta: Return delta that reflects the schema (with properties nesting)
        const keyedDelta = {
            [playerId]: {
                properties: {
                    current_stamina: staminaDelta,
                    satiety: satietyDelta
                }
            }
        };

        console.log('Generated Delta:', JSON.stringify(keyedDelta, null, 2));
        console.log('New Stamina (InMemory):', verifiedStamina);
        console.log('New Satiety (InMemory):', verifiedSatiety);
        console.log('--- END DEBUG STATE UPDATE ---');

        logs.push(`[ENGINE] Applied Delta to ${playerId}: stamina ${currentStamina} -> ${newStamina} (${staminaDelta}), satiety ${currentSatiety} -> ${newSatiety} (${satietyDelta})`);

        return {
            success: true,
            logs,
            mechanicalDelta: keyedDelta,
            intent: mas1,
            state: newState
        };
    }
}
