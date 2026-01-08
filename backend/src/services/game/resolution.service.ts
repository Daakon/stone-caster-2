

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
            mas1 = {
                type: 'COMBAT',
                intent: 'combat_action',
                skill_id: 'root_force',
                difficulty_mod: 0,
                duration_tag: 'moment',
                confidence: 1.0,
                analysis: 'Combat Intent Detected',
                parameters: {}
            };
        } else if (lower.includes('look') || lower.includes('search') || lower.includes('examine')) {
            mas1 = {
                type: 'NARRATIVE',
                intent: 'attempt_action',
                skill_id: 'root_awareness',
                difficulty_mod: 0,
                duration_tag: 'scene',
                confidence: 1.0,
                analysis: 'Observation Intent Detected',
                parameters: {}
            };
        }

        const logs: string[] = [];
        logs.push(`[SYSTEM] MAS-1 Intent: ${mas1.intent} (${mas1.skill_id})`);

        // 2. Deterministic Engine Execution
        const playerId = state.index?.player_id;
        const player = state.mechanical?.entities?.[playerId];

        // Mock Action Definition (In real app, fetch from Ruleset based on mas1.skill_id)
        // Ensure path matches GameStateBundle structure: mechanical.entities...
        const mockActionDef = {
            logic: [
                {
                    function: 'state.modify',
                    args: {
                        path: `mechanical.entities.${playerId}.properties.stamina`,
                        amount: mas1.type === 'COMBAT' ? -5 : -1
                    }
                },
                {
                    function: 'state.modify',
                    args: {
                        path: `mechanical.entities.${playerId}.properties.satiety`,
                        amount: -1
                    }
                }
            ]
        };

        if (mas1.type === 'COMBAT') {
            // Add a mock HP damage to enemy logic if we had an enemy ID.
            // For now just drain stamina.
            logs.push(`[ENGINE] Executing Combat Action (Cost: 5 Stamina)`);
        } else {
            logs.push(`[ENGINE] Executing Narrative Action (Cost: 1 Stamina)`);
        }

        let newState = state;
        try {
            // [CRITICAL] Execute Engine even in Mock Mode
            newState = EngineExecutor.executeAction(state, mockActionDef, {}); // schema empty for mock
            logs.push(`[ENGINE] Execution Successful.`);
        } catch (e) {
            console.error('[ResolutionService] Engine Execution Failed:', e);
            logs.push(`[ENGINE] Error: ${(e as Error).message}`);
        }

        // Calculate explicit delta for frontend (Mock)
        const mechanicalDelta = {
            stamina: mas1.type === 'COMBAT' ? -5 : -1,
            satiety: -1
        };

        return {
            success: true,
            logs,
            mechanicalDelta,
            intent: mas1,
            state: newState
        };
    }
}
