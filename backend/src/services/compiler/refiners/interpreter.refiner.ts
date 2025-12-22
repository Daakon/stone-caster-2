
import { RulesetDTO } from '../schemas';

export interface InterpreterConfig {
    intents: Record<string, string>; // verb -> trigger_id
    constraints: Array<{ logic: string; context?: string }>;
}

export class InterpreterRefiner {
    /**
     * Extracts structured, deterministic rules for the Game Engine.
     */
    static extractConfig(rulesets: RulesetDTO[]): InterpreterConfig {
        const config: InterpreterConfig = { intents: {}, constraints: [] };

        rulesets.forEach(rule => {
            const def = rule.definition;
            const name = rule.name || def.name || rule.key || 'Unknown';

            // 1. Locate the Instruction Set (Handle all variations)
            const source =
                def.ai_instructions?.mas1_interpreter ||
                def.ai_instructions?.mas1_action_parser ||
                def.actions?.['mas1_interpreter'] ||
                def.actions?.['mas1_action_parser'];

            if (!source) return;

            // 2. Extract Intents (Deterministic Mapping)
            // Structure: { verb: "attack", trigger_id: "combat_action", tags: [...] }
            if (Array.isArray(source.intent_keywords)) {
                source.intent_keywords.forEach((kw: any) => {
                    if (kw.verb && kw.trigger_id) {
                        // Normalize to lowercase for O(1) lookups
                        config.intents[kw.verb.toLowerCase()] = kw.trigger_id;
                    }
                });
            }

            // 3. Extract Constraints (Deterministic Checks)
            // Structure: { logic: "If stamina is 0, reject..." }
            if (Array.isArray(source.instructions)) {
                source.instructions.forEach((instr: any) => {
                    if (instr.logic) {
                        config.constraints.push({
                            logic: instr.logic,
                            context: name
                        });
                    }
                });
            }
        });

        return config;
    }

    /**
     * Generates the System Prompt for the LLM (Text Representation).
     */
    static process(rulesets: RulesetDTO[]): string {
        const config = this.extractConfig(rulesets);
        let prompt = "";

        if (config.constraints.length > 0) {
            prompt += "[LOGIC CONSTRAINTS]\n";
            config.constraints.forEach(c => prompt += `- [${c.context}] ${c.logic} \n`);
            prompt += "\n";
        }

        if (Object.keys(config.intents).length > 0) {
            prompt += "[INTENT MAPPINGS]\n";
            Object.entries(config.intents).forEach(([verb, trigger]) => {
                prompt += `- "${verb}" -> TRIGGER: ${trigger} \n`;
            });
        }

        return prompt.trim();
    }
}

