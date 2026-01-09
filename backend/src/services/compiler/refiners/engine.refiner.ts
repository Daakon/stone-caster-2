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

        console.log(`\n[DEBUG] ===== ENGINE REFINER: ACTION MERGE DEBUG =====`);
        console.log(`[DEBUG] Processing ${rulesets.length} rulesets...`);
        console.log(`[DEBUG] Initial actions count: ${Object.keys(runtime.actions).length}`);
        console.log(`[DEBUG] Initial action keys:`, Object.keys(runtime.actions));

        for (const ruleset of rulesets) {
            const ruleName = ruleset.name || ruleset.key || 'Unknown Rule';
            const definition = ruleset.definition || {};

            console.log(`\n[DEBUG] --- Processing Ruleset: ${ruleName} (ID: ${ruleset.id}) ---`);

            // A. Merge Actions (Runtime)
            if (definition.actions) {
                const actionKeys = Object.keys(definition.actions);
                console.log(`[DEBUG] ✅ Actions found in definition.actions`);
                console.log(`[DEBUG] Action keys in definition:`, actionKeys);
                console.log(`[DEBUG] Action count: ${actionKeys.length}`);

                // ===== DEBUG: Action Extraction =====
                for (const actionKey of actionKeys) {
                    console.log(`[DEBUG]   - Extracting action: "${actionKey}"`);
                }

                // ===== DEBUG: Before Merge =====
                const actionsBeforeMerge = Object.keys(runtime.actions);
                console.log(`[DEBUG] Actions BEFORE merge:`, actionsBeforeMerge);
                console.log(`[DEBUG] Actions count BEFORE: ${actionsBeforeMerge.length}`);

                for (const [actionKey, actionSteps] of Object.entries(definition.actions)) {
                    console.log(`[DEBUG]   Processing action: "${actionKey}"`);
                    
                    // Validate every step in the action chain
                    if (Array.isArray(actionSteps)) {
                        console.log(`[DEBUG]     Action has ${actionSteps.length} steps`);
                        (actionSteps as any[]).forEach((step, index) => {
                            if (!step.function) {
                                console.log(`[DEBUG]     ⚠️ Step ${index} has no function, skipping validation`);
                                return;
                            }
                            // STRICT VALIDATION
                            // ⚠️ POTENTIAL ISSUE: If a function is not in ENGINE_FUNCTION_MAP, this throws an error
                            // This could cause the entire action to be skipped if there's error handling upstream
                            // Check if any actions are being silently dropped due to validation failures
                            if (!ENGINE_FUNCTION_MAP[step.function]) {
                                console.error(`[DEBUG]     ❌ Step ${index} uses unknown function: ${step.function}`);
                                console.error(`[DEBUG]     Available functions:`, Object.keys(ENGINE_FUNCTION_MAP));
                                throw new Error(
                                    `Compiler Error: Rule '${ruleName}' references unknown function '${step.function}' in action '${actionKey}' (step ${index}). See MIGRATION_GUIDE.md.`
                                );
                            }
                            console.log(`[DEBUG]     ✅ Step ${index}: ${step.function} (valid)`);
                        });
                    } else {
                        console.log(`[DEBUG]     ⚠️ Action steps is not an array:`, typeof actionSteps);
                    }
                    
                    // Merge into output
                    console.log(`[DEBUG]     Merging "${actionKey}" into runtime.actions...`);
                    runtime.actions[actionKey] = actionSteps;
                    console.log(`[DEBUG]     ✅ Merged "${actionKey}"`);
                }

                // ===== DEBUG: After Merge =====
                const actionsAfterMerge = Object.keys(runtime.actions);
                console.log(`[DEBUG] Actions AFTER merge:`, actionsAfterMerge);
                console.log(`[DEBUG] Actions count AFTER: ${actionsAfterMerge.length}`);
                
                // Check for specific actions we're tracking
                if (actionKeys.includes('apply_relationship_delta')) {
                    if (actionsAfterMerge.includes('apply_relationship_delta')) {
                        console.log(`[DEBUG] ✅ apply_relationship_delta successfully merged!`);
                    } else {
                        console.error(`[DEBUG] ❌ apply_relationship_delta was in source but NOT in merged result!`);
                    }
                }
                if (actionKeys.includes('propose_relationship_arc')) {
                    if (actionsAfterMerge.includes('propose_relationship_arc')) {
                        console.log(`[DEBUG] ✅ propose_relationship_arc successfully merged!`);
                    } else {
                        console.error(`[DEBUG] ❌ propose_relationship_arc was in source but NOT in merged result!`);
                    }
                }
            } else {
                console.log(`[DEBUG] ⚠️ No definition.actions found for ruleset ${ruleName}`);
                console.log(`[DEBUG] Definition keys:`, Object.keys(definition));
                // Check if actions might be nested elsewhere
                if (definition.config && definition.config.actions) {
                    console.log(`[DEBUG] ⚠️ Found actions in definition.config.actions instead!`);
                    console.log(`[DEBUG] This might be a schema mismatch issue.`);
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

        console.log(`\n[DEBUG] ===== FINAL MERGE RESULT =====`);
        console.log(`[DEBUG] Total actions in runtime.actions: ${Object.keys(runtime.actions).length}`);
        console.log(`[DEBUG] Final action keys:`, Object.keys(runtime.actions));
        console.log(`[DEBUG] ===== END ENGINE REFINER DEBUG =====\n`);

        return {
            runtime
        };
    }
}
