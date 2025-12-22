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

            const definition = ruleset.definition || {};
            const aiInstructions = definition.ai_instructions || {};

            // Look for Narrator instructions
            const instruction = aiInstructions.mas2_narrator;

            // Name Resolution Priority: Top-level Name -> Definition Name -> Key -> Unknown
            const ruleName = ruleset.name || definition.name || ruleset.key || 'Unknown Rule';

            // Check if instruction has meaningful content to avoid empty headers
            const hasContent = instruction && (
                (instruction.style_injections && Object.keys(instruction.style_injections).length > 0) ||
                (instruction.state_readouts && Object.keys(instruction.state_readouts).length > 0) ||
                instruction.priority
            );

            if (hasContent) {
                promptSections.push(`[STYLE: ${ruleName}]`);

                // Helper to format string/object
                const formatItem = (item: any) => {
                    if (typeof item === 'string') return item;
                    if (typeof item === 'object' && item !== null) {
                        return item.content || JSON.stringify(item);
                    }
                    return String(item);
                };

                if (instruction.style_injections) {
                    if (Array.isArray(instruction.style_injections)) {
                        instruction.style_injections.forEach((style: any) => {
                            promptSections.push(`- Instruction: ${formatItem(style)}`);
                        });
                    } else {
                        promptSections.push(`- Instruction: ${formatItem(instruction.style_injections)}`);
                    }
                }

                if (instruction.state_readouts) {
                    if (Array.isArray(instruction.state_readouts)) {
                        instruction.state_readouts.forEach((readout: any) => {
                            promptSections.push(`- Readout: ${formatItem(readout)}`);
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
