

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
    intent: Mas1Intent; // Updated from simple string
}

export class ResolutionService {
    async resolve(input: string, state: any): Promise<ResolutionResult> {
        const lower = input.toLowerCase();
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

        const logs: string[] = [];
        const delta: Record<string, any> = {};

        // Simple Heuristic for Intent
        if (lower.includes('attack') || lower.includes('hit') || lower.includes('strike') || lower.includes('fight')) {
            mas1 = {
                type: 'COMBAT',
                intent: 'combat_action',
                skill_id: 'root_force',
                difficulty_mod: 0,
                duration_tag: 'moment',
                confidence: 1.0,
                analysis: 'Mock Heuristic: Combat Keywords Detected',
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
                analysis: 'Mock Heuristic: Observation Keywords Detected',
                parameters: {}
            };
        }

        if (mas1.type === 'COMBAT') {
            // [MECHANIC: d100 Roll]
            const roll = Math.floor(Math.random() * 100) + 1;
            const targetNumber = 60; // Mock Stat (e.g., Strength 60)
            const isSuccess = roll <= targetNumber;

            logs.push(`[MECHANICAL] Rolled ${roll} vs TN ${targetNumber}.`);

            if (isSuccess) {
                const damage = Math.floor(Math.random() * 10) + 5; // 1d10 + 5
                delta.damage_dealt = damage;
                logs.push(`[MECHANICAL] SUCCESS. Deal ${damage} damage.`);
            } else {
                logs.push(`[MECHANICAL] FAILURE. Missed.`);
            }
            return { success: true, logs, mechanicalDelta: delta, intent: mas1 };
        }

        // Default Narrative Resolution
        logs.push(`[SYSTEM] Interpreted as Narrative Action: ${mas1.analysis}`);
        return { success: true, logs, mechanicalDelta: delta, intent: mas1 };
    }
}
