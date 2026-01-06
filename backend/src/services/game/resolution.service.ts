
export interface ResolutionResult {
    success: boolean;
    logs: string[];
    mechanicalDelta: Record<string, any>;
    intent: 'COMBAT' | 'NARRATIVE' | 'OTHER';
}

export class ResolutionService {
    async resolve(input: string, state: any): Promise<ResolutionResult> {
        const lower = input.toLowerCase();
        let intent: 'COMBAT' | 'NARRATIVE' | 'OTHER' = 'NARRATIVE';

        // Simple Heuristic for Intent
        if (lower.includes('attack') || lower.includes('hit') || lower.includes('strike') || lower.includes('fight')) {
            intent = 'COMBAT';
        }

        const logs: string[] = [];
        const delta: Record<string, any> = {};

        if (intent === 'COMBAT') {
            // [MECHANIC: d100 Roll]
            const roll = Math.floor(Math.random() * 100) + 1;
            const targetNumber = 60; // Mock Stat (e.g., Strength 60)
            const isSuccess = roll <= targetNumber;

            logs.push(`[MECHANICAL] Rolled ${roll} vs TN ${targetNumber}.`);

            if (isSuccess) {
                const damage = Math.floor(Math.random() * 10) + 5; // 1d10 + 5
                delta.damage_dealt = damage;
                logs.push(`[MECHANICAL] SUCCESS. Deal ${damage} damage.`);
                return { success: true, logs, mechanicalDelta: delta, intent };
            } else {
                logs.push(`[MECHANICAL] FAILURE. Missed.`);
                return { success: false, logs, mechanicalDelta: delta, intent };
            }
        }

        // Default Narrative Resolution
        logs.push(`[SYSTEM] Interpreted as Narrative Action.`);
        return { success: true, logs, mechanicalDelta: delta, intent };
    }
}
