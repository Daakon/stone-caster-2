import { ENGINE_FUNCTION_MAP } from '../../../engine/registry.js';
import { CompiledCartridge, RuntimeConfig, CreationConfig } from '../../../engine/types';
import { InterpreterRefiner } from './interpreter.refiner';
import { RulesetDTO } from '../schemas'; // Assuming types are available here

/**
 * Engine Refiner
 * Extracts deterministic data for the Client/Server Engine.
 */
export class EngineRefiner {
    /**
     * Parse raw rulesets into a strict CompiledCartridge (Creation vs Runtime split)
     */
    static refine(rulesets: RulesetDTO[]): CompiledCartridge {
        // 1. Initialize Runtime Config
        const runtime: RuntimeConfig = {
            logic: InterpreterRefiner.extractConfig(rulesets), // Reuse Logic Extraction
            actions: {},
            schema: {}
        };

        // 2. Initialize Creation Config
        const creation: CreationConfig = {
            fields: []
        };

        for (const ruleset of rulesets) {
            const ruleName = ruleset.name || ruleset.key || 'Unknown Rule';
            const definition = ruleset.definition || {};

            // A. Merge Actions (Runtime)
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
                    runtime.actions[actionKey] = actionSteps;
                }
            }

            // B. Merge State Schema (Runtime)
            if (definition.state_contributions) {
                // Convert old state_contributions to strict RuntimeSchema
                // Assuming state_contributions aligns with RuntimeSchema for now
                // or needs mapping. For now, strict copy.
                Object.entries(definition.state_contributions).forEach(([key, value]) => {
                    // Start simple: assume value matches compatible schema or is a direct object
                    // In reality, we might need to normalize "defaults" here.
                    runtime.schema[key] = value as any;
                });
            }

            // C. Extract Form Hints (Creation)
            // Path: definition.ai_instructions.tier1_entity.form_hints
            const formHints = definition.ai_instructions?.tier1_entity?.form_hints;
            if (formHints) {
                Object.entries(formHints).forEach(([key, hint]: [string, any]) => {
                    creation.fields.push({
                        key: key,
                        label: hint.label || key,
                        control: hint.control || 'text',
                        options: hint.options,
                        min: hint.min,
                        max: hint.max,
                        description: hint.description
                    });
                });
            }
        }

        return {
            runtime,
            creation
        };
    }
}
