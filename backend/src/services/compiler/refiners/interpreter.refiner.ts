/**
 * Interpreter Refiner
 * Extracts logic/rule-parsing instructions for the "Arbiter" Agent.
 */
export class InterpreterRefiner {
    /**
     * Generate the System Prompt for the Logic Agent
     */
    static refine(rulesets: any[]): string {
        let promptSections: string[] = [];

        for (const ruleset of rulesets) {
            const ruleName = ruleset.name || 'Unknown Rule';
            const definition = ruleset.definition || {};
            const aiInstructions = definition.ai_instructions || {};

            // Look for Interpreter or Action Parser instructions
            const instruction = aiInstructions.mas1_interpreter || aiInstructions.mas1_action_parser;

            if (instruction) {
                promptSections.push(`[RULESET: ${ruleName}]`);

                if (instruction.logic) {
                    promptSections.push(`- Constraint: ${instruction.logic}`);
                }

                // If there are intent keywords/verb mappings
                // This assumes instruction might have a 'verbs' or similar structure, 
                // but based on prompt we just need to capture the available info.
                // We'll dump the raw instruction fields that are relevant if they exist.

                // Use the example format if specific fields are present
                if (instruction.verbs) {
                    // Generic handling for verbs if present
                    // Logic: {verb} -> {trigger_id}
                    for (const [verb, trigger] of Object.entries(instruction.verbs)) {
                        promptSections.push(`- Intent Keywords: ${verb} -> ${trigger}`);
                    }
                }

                promptSections.push(''); // Spacing
            }
        }

        return promptSections.join('\n').trim();
    }
}
