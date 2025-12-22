/**
 * STORY COMPILER REGISTRY
 * 
 * STRICT SOURCE OF TRUTH
 * The Story Compiler will enforce these names.
 * Legacy names (cat_XX_...) are NOT supported here.
 */

export const ENGINE_FUNCTION_MAP: Record<string, string> = {
    // Domain: Resolution
    "resolution.resolve": "Standard Skill Check (Roll vs Target)",
    "resolution.contest": "Contested Roll (Actor vs Target)",
    "resolution.compare": "Evaluate Roll Outcome (Crit/Success/Fail/Fumble)",

    // Domain: State
    "state.modify": "Modify a numerical value (add/sub)",
    "state.set": "Set a specific value/string (overwrite)",
    "state.list_op": "Add/Remove tags or items",
    "state.lookup": "Find a value in the state tree (Cascade)",
    "state.stop": "Halt execution flow",

    // Domain: Logic
    "logic.thresholds": "Check value against ranges",
    "logic.map": "Map inputs to values",
    "logic.filter": "Filter lists based on criteria",
    "logic.intersection": "Find common elements between two lists",
    "logic.compare": "Generic comparison (>, <, =, !=)",

    // Domain: Math & Physics
    "math.add": "Basic addition/subtraction helper",
    "rng.roll": "Generate random numbers",

    // Domain: Output
    "output.emit": "Send structured payload to Narrator"
};

/**
 * Standard Library AllowList (Array Format)
 * Used by Validators and Frontend to enforce V2 compliance.
 */
export const STANDARD_LIBRARY_AllowList = Object.keys(ENGINE_FUNCTION_MAP);
