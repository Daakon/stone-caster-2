import { ENGINE_FUNCTION_MAP } from '../../../engine/registry.js';
import { EngineConfig } from '../types';

/**
 * Engine Refiner
 * Extracts deterministic data for the Client/Server Engine.
 */
export class EngineRefiner {
    /**
     * Parse raw rulesets into a strict EngineConfig
     */
    static refine(rulesets: any[]): EngineConfig {
        const config: EngineConfig = {
            actions: {},
            state_schema: {},
            form_hints: {}
        };

        for (const ruleset of rulesets) {
            const ruleName = ruleset.name || 'Unknown Rule';
            const definition = ruleset.definition || {};

            // 1. Merge Actions
            if (definition.actions) {
                for (const [actionKey, actionSteps] of Object.entries(definition.actions)) {
                    // Validate every step in the action chain
                    if (Array.isArray(actionSteps)) {
                        (actionSteps as any[]).forEach((step, index) => {
                            if (!step.function) return;

                            // STRICT VALIDATION
                            if (!ENGINE_FUNCTION_MAP[step.function]) {
                                throw new Error(
                                    `Compiler Error: Rule '${ruleName}' references unknown function '${step.function}' in action '${actionKey}' (step ${index}). See MIGRATION_GUIDE.md.`
                                );
                            }
                        });
                    }

                    // Merge into output
                    config.actions[actionKey] = actionSteps;
                }
            }

            // 2. Merge State Schema
            if (definition.state_contributions) {
                config.state_schema = {
                    ...config.state_schema,
                    ...definition.state_contributions
                };
            }

            // 3. Outlier Fix: Legacy Form Hints (stamina-based-magic support)
            // Path: definition.ai_instructions.tier1_entity.form_hints
            if (definition.ai_instructions?.tier1_entity?.form_hints) {
                config.form_hints = {
                    ...config.form_hints,
                    ...definition.ai_instructions.tier1_entity.form_hints
                };
            }
        }

        return config;
    }
}
