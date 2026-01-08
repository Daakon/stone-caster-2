

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

        // Define Mock Delta (Entity-Keyed)
        // Use "current_stamina" vs "stamina" based on verified schema. 
        // User requested "current_stamina". 
        const deltaValues = mas1.type === 'COMBAT'
            ? { current_stamina: -5, satiety: -1 }
            : { current_stamina: -1, satiety: -1 };

        const keyedDelta = {
            [playerId]: deltaValues
        };

        // 3. Apply Delta to create New State
        // Use structuredClone for deep copy
        const newState = structuredClone(state);
        const targetEntity = newState.mechanical.entities[playerId];

        // Initialize properties if missing to avoid crashes
        if (!targetEntity.properties) targetEntity.properties = {};

        // Apply changes
        Object.entries(deltaValues).forEach(([key, val]) => {
            const current = targetEntity.properties[key] || 0; // Default to 0? Or 100?
            // If value is missing in DB, we should probably default to something safe or handle gracefully.
            // Using existing val or 100 if we assume max is 100?
            // Let's use `current || 0` and assume it handles initialized state properly.
            targetEntity.properties[key] = (current as number) + (val as number);
        });

        logs.push(`[ENGINE] Applied Delta to ${playerId}: ${JSON.stringify(deltaValues)}`);

        return {
            success: true,
            logs,
            mechanicalDelta: keyedDelta,
            intent: mas1,
            state: newState
        };
    }
}
