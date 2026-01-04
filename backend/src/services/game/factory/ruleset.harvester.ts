
export interface HarvestResult {
    globals: Record<string, any>;        // Environmental / System globals
    entityDefaults: Record<string, any>; // Mechanical Entity Properties
    visualDefaults: Record<string, any>; // Narrative Entity Visuals
}

export class RulesetHarvester {
    /**
     * Harvests variables from a list of rulesets, sorting them into
     * Mechanical vs Narrative buckets based on heuristics.
     * 
     * @param rulesets List of active ruleset definitions (JSON inputs)
     */
    public harvest(rulesets: any[]): HarvestResult {
        const result: HarvestResult = {
            globals: {},
            entityDefaults: {},
            visualDefaults: {}
        };

        for (const ruleset of rulesets) {
            if (!ruleset) continue;

            // We look at 'defaults' for entity/game properties
            const defaults = ruleset.defaults || ruleset.ruleset?.defaults || {};

            this.processBag(defaults, result);

            // If there are specific 'globals' defined, process those too (generic fallback)
            if (ruleset.globals) {
                this.processBag(ruleset.globals, result, true);
            }
        }

        return result;
    }

    private processBag(bag: Record<string, any>, result: HarvestResult, forceGlobal = false): void {
        for (const [key, value] of Object.entries(bag)) {
            this.sortItem(key, value, result, forceGlobal);
        }
    }

    private sortItem(key: string, value: any, result: HarvestResult, forceGlobal: boolean): void {
        // 1. Explicit Scope Override
        // Check if value is an object with a 'scope' or '_scope' property
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            const scope = value.scope || value._scope;
            const realValue = value.value !== undefined ? value.value : value; // unwraps if needed

            if (scope === 'narrative') {
                result.visualDefaults[key] = realValue;
                return;
            }
            if (scope === 'mechanical') {
                if (forceGlobal) {
                    result.globals[key] = realValue;
                } else {
                    result.entityDefaults[key] = realValue;
                }
                return;
            }
            // If valid object but no scope, treat as Mechanical (complex block)
            if (value.value !== undefined) {
                // It was a wrapped object but didn't specify scope, assume mechanical default
                if (forceGlobal) result.globals[key] = realValue;
                else result.entityDefaults[key] = realValue;
                return;
            }
        }

        // 2. Type-based Heuristics
        const targetValue = value;

        if (typeof targetValue === 'number' || typeof targetValue === 'boolean') {
            // Mechanical
            if (forceGlobal) result.globals[key] = targetValue;
            else result.entityDefaults[key] = targetValue;
            return;
        }

        if (typeof targetValue === 'string') {
            // Narrative
            // Unless forceGlobal is true? Usually globals are mechanical params (time, danger).
            // But a global string could be "weather_description". 
            // For now, if it's a "default" for an entity, string = visual/narrative.
            // If it's a global, we might want to keep it in globals? 
            // The prompt says: "string -> Narrative".

            if (forceGlobal) {
                // If it's a global string, it's likely narrative context, but 'globals' bucket in MechanicalState
                // is 'Record<string, any>'. However, NarrativeFocus also has context.
                // Let's decide: Globals are usually Mechanical. 
                // But strict prompt says: "If type === 'string' -> Assign to Narrative".
                // We'll put it in visualDefaults (which might be a misnomer for 'narrative defaults').
                // Actually, let's assume 'visualDefaults' is strictly for *entities*.
                // If forceGlobal is true, maybe we put it in globals anyway?
                // Let's stick to the prompt's simplicity: "string -> Narrative".
                result.visualDefaults[key] = targetValue;
            } else {
                result.visualDefaults[key] = targetValue;
            }
            return;
        }

        if (Array.isArray(targetValue)) {
            if (targetValue.length > 0 && typeof targetValue[0] === 'string') {
                // Array<string> -> Narrative (tags, inventory names)
                result.visualDefaults[key] = targetValue;
            } else {
                // Array<number|object> or empty -> Mechanical
                if (forceGlobal) result.globals[key] = targetValue;
                else result.entityDefaults[key] = targetValue;
            }
            return;
        }

        // Object (Clean) -> Mechanical
        if (forceGlobal) result.globals[key] = targetValue;
        else result.entityDefaults[key] = targetValue;
    }
}
