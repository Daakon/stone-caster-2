/**
 * Narrator Refiner
 * Extracts tone/style instructions for the "Storyteller" Agent.
 */
export class NarratorRefiner {
    /**
     * Generate the System Prompt for the Narrator Agent
     */
    static refine(rulesets: any[]): string {
        let promptSections: string[] = [];

        for (const ruleset of rulesets) {
            const ruleName = ruleset.name || 'Unknown Rule';
            const definition = ruleset.definition || {};
            const aiInstructions = definition.ai_instructions || {};

            // Look for Narrator instructions
            const instruction = aiInstructions.mas2_narrator;

            if (instruction) {
                promptSections.push(`[STYLE: ${ruleName}]`);

                if (instruction.style_injections) {
                    // These are often arrays or strings
                    if (Array.isArray(instruction.style_injections)) {
                        instruction.style_injections.forEach((style: string) => {
                            promptSections.push(`- Instruction: ${style}`);
                        });
                    } else if (typeof instruction.style_injections === 'string') {
                        promptSections.push(`- Instruction: ${instruction.style_injections}`);
                    }
                }

                if (instruction.state_readouts) {
                    if (Array.isArray(instruction.state_readouts)) {
                        instruction.state_readouts.forEach((readout: string) => {
                            promptSections.push(`- Readout: ${readout}`);
                        });
                    }
                }

                if (instruction.priority) {
                    promptSections.push(`- Priority: ${instruction.priority}`);
                }

                promptSections.push(''); // Spacing
            }
        }

        return promptSections.join('\n').trim();
    }
}
