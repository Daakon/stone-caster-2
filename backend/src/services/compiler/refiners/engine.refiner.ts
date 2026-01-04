import { ENGINE_FUNCTION_MAP } from '../../../engine/registry.js';
import { EngineConfig, RuntimeConfig } from '../types';
import { InterpreterRefiner } from './interpreter.refiner';
import { RulesetDTO } from '../schemas';

/**
 * Engine Refiner
 * Extracts deterministic data for the Client/Server Engine.
 */
export class EngineRefiner {
    /**
     * Parse raw rulesets into a strict EngineConfig (Runtime only, no UI)
     */
    static refine(rulesets: RulesetDTO[]): EngineConfig {
        // 1. Initialize Runtime Config
        const runtime: RuntimeConfig = {
            logic: InterpreterRefiner.extractConfig(rulesets),
            actions: {},
            state_defaults: {}
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

            // B. Extract State Defaults (Runtime)
            // Extract ONLY the 'value' from definitions. Ignore labels, descriptions, target_kind.
            if (definition.state_contributions) {
                Object.entries(definition.state_contributions).forEach(([entityKey, contribution]) => {
                    const definitions = (contribution as any).definitions || {};

                    if (!runtime.state_defaults[entityKey]) {
                        runtime.state_defaults[entityKey] = {};
                    }

                    Object.entries(definitions).forEach(([fieldKey, fieldDef]: [string, any]) => {
                        // We only care about the default value at runtime
                        if (fieldDef.value !== undefined) {
                            runtime.state_defaults[entityKey][fieldKey] = fieldDef.value;
                        }
                    });
                });
            }
        }

        return {
            runtime
        };
    }
}
