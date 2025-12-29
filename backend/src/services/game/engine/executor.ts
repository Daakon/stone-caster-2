/**
 * Engine Executor
 * Deterministic logic runner for Chimera V3
 */

import { get } from 'lodash-es';
import { set } from 'lodash-es';

// Helper to deep clone to avoid mutation side-effects
function deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
}

export class EngineExecutor {

    /**
     * Execute a discrete action definition against the current state
     * @param currentState The full game state (tier1_entities, tier1_world, etc.)
     * @param actionDef The action definition from the cartridge (e.g. { logic: [...] })
     * @param schema The state schema from the cartridge (for min/max clamping)
     */
    static executeAction(currentState: any, actionDef: any, schema: any = {}) {
        let newState = deepClone(currentState);
        const steps = actionDef.logic || [];

        for (const step of steps) {
            try {
                switch (step.function) {
                    case 'state.modify':
                        this.handleStateModify(newState, step.args, schema);
                        break;
                    case 'state.set':
                        this.handleStateSet(newState, step.args);
                        break;
                    case 'logic.thresholds':
                        this.handleLogicThresholds(newState, step.args);
                        break;
                    case 'resolution.resolve':
                        // No-op for state mutation, used for signaling result
                        break;
                    default:
                        console.warn(`[Engine] Unknown function: ${step.function}`);
                }
            } catch (err) {
                console.error(`[Engine] Error executing step ${step.function}:`, err);
                // Decide: throw or continue? For robustness, maybe continue but log.
                // For MVP, throwing might be safer to expose issues.
                throw err;
            }
        }

        return newState;
    }

    private static handleStateModify(state: any, args: any, schema: any) {
        // args: { path: "tier1_entities[0].current_stamina", amount: -10 }
        // We need to resolve path.
        // NOTE: Arrays in path might need careful handling if using simple lodash get/set.
        // lodash 'get' supports 'tier1_entities[0].current_stamina'.

        const currentVal = get(state, args.path);

        if (typeof currentVal !== 'number') {
            console.warn(`[Engine] state.modify: Target ${args.path} is not a number (${currentVal})`);
            return;
        }

        let newVal = currentVal + (args.amount || 0);

        // Clamping based on schema
        // Schema structure assumption: schema[path_key] = { min: 0, max: 100 }
        // We need to find the specific schema rule for this path.
        // If path is "tier1_entities[0].current_stamina", the schema key might be "current_stamina" (if it's checking entity props).
        // A simple heuristic: check the last part of the path.
        const pathParts = args.path.split('.');
        const propName = pathParts[pathParts.length - 1];

        // Locate rule in schema (assuming schema is a flat or nested object of rules)
        // Schema might be passed as config_engine.state_schema
        // If schema is object keyed by property name:
        const rule = schema[propName];

        if (rule) {
            if (typeof rule.min === 'number') newVal = Math.max(rule.min, newVal);
            if (typeof rule.max === 'number') newVal = Math.min(rule.max, newVal);
        }

        set(state, args.path, newVal);
    }

    private static handleStateSet(state: any, args: any) {
        set(state, args.path, args.value);
    }

    private static handleLogicThresholds(state: any, args: any) {
        // args: { source_path: "...", thresholds: { "0": "Collapsed", "10": "Weak", "50": "Fine" }, output_path: "..." }
        const sourceVal = get(state, args.source_path);
        if (typeof sourceVal !== 'number') return;

        // Sort thresholds descending to find the highest match
        // Assuming thresholds are keys as strings representing numbers
        const thresholdKeys = Object.keys(args.thresholds || {})
            .map(Number)
            .sort((a, b) => b - a); // Descending

        let matchedValue = null;
        for (const t of thresholdKeys) {
            if (sourceVal >= t) {
                matchedValue = args.thresholds[String(t)];
                break;
            }
        }

        if (matchedValue !== null) {
            set(state, args.output_path, matchedValue);
        }
    }
}
