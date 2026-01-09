/**
 * Resolution Service - Deterministic Engine Core
 * Implements the Generic Action Interpreter with Safety Layer protocols
 * 
 * Safety Protocols:
 * - Ghost Modification: Skip state.modify if path missing (unless value override)
 * - Ghost Creation: Auto-create paths for state.set
 * - Missing Stats: Default to 50 for contests
 * - Missing Thresholds: Default to 100 (Optimal/Safe)
 */

import { get, set, merge } from 'lodash-es';
import { LogicTracer } from '../../utils/logic-tracer.js';

export interface Mas1Intent {
    type: 'COMBAT' | 'NARRATIVE' | 'OTHER';
    intent: string;
    skill_id: string;
    difficulty_mod: number;
    duration_tag: string;
    confidence: number;
    analysis: string;
    parameters: Record<string, unknown>;
}

export interface ResolutionResult {
    success: boolean;
    logs: string[];
    mechanicalDelta: Record<string, any>;
    intent: Mas1Intent;
    state?: any;
}

/**
 * Action Definition Structure
 */
export interface ActionDefinition {
    logic: ActionStep[];
    [key: string]: unknown;
}

/**
 * Action Step Structure
 */
export interface ActionStep {
    function: string;
    args: Record<string, unknown>;
    conditions?: Condition[];
    output_to?: string; // Store result in context
}

/**
 * Condition Structure
 */
export interface Condition {
    op: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte';
    left: string | number; // Can be a path or literal
    right: string | number; // Can be a path or literal
}

/**
 * Execution Context
 * Stores intermediate results from steps
 */
interface ExecutionContext {
    [key: string]: unknown;
}

/**
 * State Helpers with Safety Layer
 */
class StateHelpers {
    /**
     * Resolve path with variable substitution
     * Supports patterns like:
     * - "entities[player_id].properties.stamina" (bracket notation)
     * - "relationships.{target_id}.stats.{target_stat_key}" (brace notation)
     * Variables are resolved from context/inputContext
     */
    static resolvePath(
        path: string,
        context: ExecutionContext = {},
        inputContext: Record<string, unknown> = {}
    ): string {
        // Replace variables in bracket notation: [variable_name]
        let resolved = path.replace(/\[(\w+)\]/g, (match, varName) => {
            const value = context[varName] ?? inputContext[varName];
            return value !== undefined ? String(value) : match;
        });

        // Replace variables in brace notation: {variable_name}
        resolved = resolved.replace(/\{(\w+)\}/g, (match, varName) => {
            const value = context[varName] ?? inputContext[varName];
            return value !== undefined ? String(value) : match;
        });

        return resolved;
    }

    /**
     * Resolve a value that may be a context reference
     * Supports patterns like:
     * - "@variable_name" (context reference with @ prefix)
     * - "variable_name" (direct context key)
     * - Literal values (numbers, strings, etc.)
     */
    static resolveValue(
        value: unknown,
        context: ExecutionContext = {},
        inputContext: Record<string, unknown> = {}
    ): unknown {
        if (typeof value === 'string') {
            // Check for @ prefix (context reference)
            if (value.startsWith('@')) {
                const key = value.slice(1);
                return context[key] ?? inputContext[key] ?? value;
            }
            // Check if it's a context key
            if (value in context) {
                return context[value];
            }
            if (value in inputContext) {
                return inputContext[value];
            }
        }
        return value;
    }

    /**
     * Safe get with default value support
     * Supports dot-notation paths (e.g., "tier1_entity.current_stamina")
     * Supports variable substitution in paths
     * Tries multiple path patterns for entity lookups (tier1_mechanical.entities[ID] and entities[ID])
     */
    static safeGet(
        state: any,
        path: string,
        defaultValue: unknown = undefined,
        context: ExecutionContext = {},
        inputContext: Record<string, unknown> = {}
    ): unknown {
        const resolvedPath = this.resolvePath(path, context, inputContext);
        let value = get(state, resolvedPath);
        
        // If value is undefined and path contains entities[ID], try alternative patterns
        if (value === undefined && resolvedPath.includes('entities[')) {
            // Try mechanical_state.entities[ID] if path was tier1_mechanical.entities[ID]
            if (resolvedPath.startsWith('tier1_mechanical.entities[')) {
                const altPath = resolvedPath.replace(/^tier1_mechanical\./, 'mechanical_state.');
                value = get(state, altPath);
                if (value === undefined) {
                    // Also try mechanical.entities[ID]
                    const altPath2 = resolvedPath.replace(/^tier1_mechanical\./, 'mechanical.');
                    value = get(state, altPath2);
                }
            }
            // Try tier1_mechanical.entities[ID] if path was mechanical_state.entities[ID]
            else if (resolvedPath.startsWith('mechanical_state.entities[')) {
                const altPath = resolvedPath.replace(/^mechanical_state\./, 'tier1_mechanical.');
                value = get(state, altPath);
            }
            // Try mechanical_state.entities[ID] if path was entities[ID]
            else if (resolvedPath.startsWith('entities[')) {
                const altPath = `mechanical_state.${resolvedPath}`;
                value = get(state, altPath);
                if (value === undefined) {
                    const altPath2 = `tier1_mechanical.${resolvedPath}`;
                    value = get(state, altPath2);
                }
                if (value === undefined) {
                    const altPath3 = `mechanical.${resolvedPath}`;
                    value = get(state, altPath3);
                }
            }
        }
        
        return value !== undefined ? value : defaultValue;
    }

    /**
     * Safe set with auto-creation of missing paths
     * Recursively creates objects if they are undefined
     * Supports variable substitution in paths
     * Tries multiple path patterns for entity lookups (tier1_mechanical.entities[ID] and entities[ID])
     */
    static safeSet(
        state: any,
        path: string,
        value: unknown,
        context: ExecutionContext = {},
        inputContext: Record<string, unknown> = {}
    ): void {
        const resolvedPath = this.resolvePath(path, context, inputContext);
        
        // Import LogicTracer
        const { LogicTracer } = require('../../utils/logic-tracer.js');
        
        // Determine which path pattern to use based on state structure
        let targetPath = resolvedPath;
        
        if (resolvedPath.includes('entities[')) {
            // Check which structure exists in state
            const hasMechanicalState = state.mechanical_state?.entities !== undefined;
            const hasTier1Mech = state.tier1_mechanical?.entities !== undefined;
            const hasMechanical = state.mechanical?.entities !== undefined;
            
            if (resolvedPath.startsWith('tier1_mechanical.entities[')) {
                // Convert to mechanical_state if that's what exists
                if (hasMechanicalState && !hasTier1Mech) {
                    targetPath = resolvedPath.replace(/^tier1_mechanical\./, 'mechanical_state.');
                } else if (hasMechanical && !hasTier1Mech && !hasMechanicalState) {
                    targetPath = resolvedPath.replace(/^tier1_mechanical\./, 'mechanical.');
                }
            } else if (resolvedPath.startsWith('mechanical_state.entities[')) {
                // Keep as is if it exists, otherwise try alternatives
                if (!hasMechanicalState && hasTier1Mech) {
                    targetPath = resolvedPath.replace(/^mechanical_state\./, 'tier1_mechanical.');
                } else if (!hasMechanicalState && !hasTier1Mech && hasMechanical) {
                    targetPath = resolvedPath.replace(/^mechanical_state\./, 'mechanical.');
                }
            } else if (resolvedPath.startsWith('entities[')) {
                // Prefer mechanical_state, then tier1_mechanical, then mechanical
                if (hasMechanicalState) {
                    targetPath = `mechanical_state.${resolvedPath}`;
                } else if (hasTier1Mech) {
                    targetPath = `tier1_mechanical.${resolvedPath}`;
                } else if (hasMechanical) {
                    targetPath = `mechanical.${resolvedPath}`;
                }
            }
        }
        
        // Auto-vivification: Create missing parent objects recursively
        const pathParts = targetPath.split('.');
        if (pathParts.length > 1) {
            // Traverse path and create missing segments
            let current = state;
            let currentPath = '';
            
            for (let i = 0; i < pathParts.length - 1; i++) {
                const segment = pathParts[i];
                currentPath = currentPath ? `${currentPath}.${segment}` : segment;
                
                // Handle bracket notation (e.g., entities[player_id])
                const bracketMatch = segment.match(/^(.+)\[([^\]]+)\]$/);
                if (bracketMatch) {
                    const objKey = bracketMatch[1];
                    const arrayKey = bracketMatch[2];
                    
                    // Ensure parent object exists
                    if (current[objKey] === undefined || current[objKey] === null) {
                        current[objKey] = {};
                        LogicTracer.trace(`Auto-created missing path segment: ${objKey}`, {
                            path: targetPath,
                            segment: objKey,
                            current_path: currentPath,
                        });
                    }
                    
                    // Move to nested object
                    current = current[objKey];
                    
                    // Ensure nested object exists (for entities[ID].properties)
                    if (current[arrayKey] === undefined || current[arrayKey] === null) {
                        // Check if next segment suggests this should be an array
                        const nextSegment = pathParts[i + 1];
                        const isNextSegmentNumeric = /^\d+$/.test(nextSegment);
                        current[arrayKey] = isNextSegmentNumeric ? [] : {};
                        LogicTracer.trace(`Auto-created missing path segment: ${objKey}[${arrayKey}]`, {
                            path: targetPath,
                            segment: `${objKey}[${arrayKey}]`,
                            current_path: currentPath,
                            created_as: isNextSegmentNumeric ? 'array' : 'object',
                        });
                    }
                    
                    // Move to the nested object/array
                    current = current[arrayKey];
                } else {
                    // Regular dot notation
                    if (current[segment] === undefined || current[segment] === null) {
                        // Check if next segment suggests this should be an array
                        const nextSegment = pathParts[i + 1];
                        const isNextSegmentNumeric = /^\d+$/.test(nextSegment);
                        current[segment] = isNextSegmentNumeric ? [] : {};
                        LogicTracer.trace(`Auto-created missing path segment: ${segment}`, {
                            path: targetPath,
                            segment: segment,
                            current_path: currentPath,
                            created_as: isNextSegmentNumeric ? 'array' : 'object',
                        });
                    }
                    
                    // Ensure it's an object (not a primitive)
                    if (typeof current[segment] !== 'object' || current[segment] === null || Array.isArray(current[segment])) {
                        // Overwrite if it's not an object (unless it's an array and we need an array)
                        const nextSegment = pathParts[i + 1];
                        const isNextSegmentNumeric = /^\d+$/.test(nextSegment);
                        if (!Array.isArray(current[segment]) || !isNextSegmentNumeric) {
                            current[segment] = isNextSegmentNumeric ? [] : {};
                            LogicTracer.trace(`Overwrote non-object path segment: ${segment}`, {
                                path: targetPath,
                                segment: segment,
                                previous_type: typeof current[segment],
                            });
                        }
                    }
                    
                    current = current[segment];
                }
            }
        }
        
        // Now set the value (lodash set will handle the final segment)
        set(state, targetPath, value);
    }

    /**
     * Check if a path exists in state
     */
    static pathExists(
        state: any,
        path: string,
        context: ExecutionContext = {},
        inputContext: Record<string, unknown> = {}
    ): boolean {
        const resolvedPath = this.resolvePath(path, context, inputContext);
        const value = get(state, resolvedPath);
        return value !== undefined;
    }
}

/**
 * Step Dispatcher
 * Handles all step types with Safety Layer protocols
 */
class StepDispatcher {
    /**
     * Execute a single step
     */
    static executeStep(
        state: any,
        step: ActionStep,
        context: ExecutionContext,
        inputContext: Record<string, unknown> = {}
    ): void {
        const { function: funcName, args } = step;
        const stepId = (step as any).step_id || (step as any).id || 'unknown';
        
        // Log step start
        LogicTracer.stepStart(stepId, funcName, args as Record<string, unknown>);

        try {
            switch (funcName) {
            // Category A: State Mutators
            case 'state.modify':
                this.handleStateModify(state, args, context, inputContext);
                break;
            case 'state.set':
                this.handleStateSet(state, args, context, inputContext);
                break;
            case 'state.list_op':
                this.handleStateListOp(state, args, context, inputContext);
                break;
            case 'state.transition':
                this.handleStateTransition(state, args, context, inputContext);
                break;

            // Category B: Logic & Math
            case 'logic.map':
                this.handleLogicMap(state, args, context, inputContext);
                break;
            case 'logic.thresholds':
                this.handleLogicThresholds(state, args, context, inputContext);
                break;
            case 'logic.complex_check':
                this.handleLogicComplexCheck(state, args, context, inputContext);
                break;
            case 'resolution.contest':
                this.handleResolutionContest(state, args, context, inputContext);
                break;

            default:
                LogicTracer.warning(`Unknown function`, {
                    step_id: stepId,
                    function: funcName,
                });
            }
            
            // Store output if specified
            if (step.output_to && context[funcName] !== undefined) {
                context[step.output_to] = context[funcName];
                LogicTracer.stepResult(stepId, { output_to: step.output_to, value: context[funcName] });
            } else {
                LogicTracer.stepResult(stepId, { completed: true });
            }
        } catch (error) {
            LogicTracer.error(`Step execution failed`, error, {
                step_id: stepId,
                function: funcName,
            });
            throw error;
        }
    }

    /**
     * state.modify: Modify a numeric value at path
     * Safety: If path missing & no value override, SKIP (Ghost Modification)
     */
    private static handleStateModify(
        state: any,
        args: Record<string, unknown>,
        context: ExecutionContext = {},
        inputContext: Record<string, unknown> = {}
    ): void {
        const path = StateHelpers.resolvePath(args.path as string, context, inputContext);
        // Resolve amount - may be a context reference like "@delta_amount"
        const amountRaw = StateHelpers.resolveValue(args.amount, context, inputContext);
        const amount = typeof amountRaw === 'number' ? amountRaw : 0;
        const value = args.value as number | undefined;
        const clampMin = args.clamp_min as number | undefined;
        const clampMax = args.clamp_max as number | undefined;

        const current = StateHelpers.safeGet(state, path, undefined, context, inputContext);

        // Debug logging for stamina changes
        if (path.includes('stamina') || path.includes('satiety')) {
            const resolvedPath = StateHelpers.resolvePath(path, context, inputContext);
            console.log(`[StateModify] 🔍 Path: ${path} -> ${resolvedPath}`);
            console.log(`[StateModify] 🔍 Current value: ${current} (type: ${typeof current})`);
            const playerId = inputContext.player_id as string;
            console.log(`[StateModify] 🔍 State structure check:`, {
                hasMechanicalState: !!state.mechanical_state?.entities,
                hasTier1Mech: !!state.tier1_mechanical?.entities,
                hasMechanical: !!state.mechanical?.entities,
                playerId: playerId,
                playerEntityExists: !!(state.mechanical_state?.entities?.[playerId] || 
                                      state.tier1_mechanical?.entities?.[playerId] ||
                                      state.mechanical?.entities?.[playerId])
            });
        }

        // Auto-vivification for math operations: Treat null/undefined as 0
        let numericCurrent: number;
        if (current === undefined || current === null) {
            // Auto-create path and treat as 0 for math operations
            numericCurrent = 0;
            LogicTracer.trace(`Auto-vivifying missing path for math operation (treating as 0)`, {
                path: path,
                amount: amount,
            });
        } else if (typeof current === 'number') {
            numericCurrent = current;
        } else {
            // Current is not a number and no value override, skip
            LogicTracer.warning(`Cannot modify non-numeric value`, {
                path: path,
                current_type: typeof current,
                current_value: current,
            });
            return;
        }

        let newValue: number;

        if (value !== undefined) {
            // Absolute value override
            newValue = value;
        } else {
            // Modify existing value (or 0 if it was missing)
            newValue = numericCurrent + amount;
        }

        // Apply clamping
        if (clampMin !== undefined) {
            newValue = Math.max(clampMin, newValue);
        }
        if (clampMax !== undefined) {
            newValue = Math.min(clampMax, newValue);
        }

        if (path.includes('stamina') || path.includes('satiety')) {
            console.log(`[StateModify] ✅ Setting ${path}: ${current} -> ${newValue}`);
        }

        StateHelpers.safeSet(state, path, newValue, context, inputContext);
    }

    /**
     * state.set: Set a value at path (always creates if missing)
     * Safety: Auto-creates path (Ghost Creation)
     */
    private static handleStateSet(
        state: any,
        args: Record<string, unknown>,
        context: ExecutionContext = {},
        inputContext: Record<string, unknown> = {}
    ): void {
        const path = StateHelpers.resolvePath(args.path as string, context, inputContext);
        const value = StateHelpers.resolveValue(args.value, context, inputContext);

        StateHelpers.safeSet(state, path, value, context, inputContext);
    }

    /**
     * state.list_op: Add or remove items from an array
     * Safety: Initializes array if missing
     */
    private static handleStateListOp(
        state: any,
        args: Record<string, unknown>,
        context: ExecutionContext = {},
        inputContext: Record<string, unknown> = {}
    ): void {
        const path = StateHelpers.resolvePath(args.path as string, context, inputContext);
        const op = args.op as 'add' | 'remove';
        const item = StateHelpers.resolveValue(args.item, context, inputContext);

        let array = StateHelpers.safeGet(state, path, undefined, context, inputContext) as unknown[] | undefined;

        // Initialize if missing
        if (!Array.isArray(array)) {
            array = [];
            StateHelpers.safeSet(state, path, array, context, inputContext);
        }

        if (op === 'add') {
            array.push(item);
        } else if (op === 'remove') {
            const index = array.findIndex((el) => JSON.stringify(el) === JSON.stringify(item));
            if (index !== -1) {
                array.splice(index, 1);
            }
        }

        StateHelpers.safeSet(state, path, array, context, inputContext);
    }

    /**
     * state.transition: Transition a value based on a map
     * Safety: If current undefined, use first key in map (Implied State Protocol)
     */
    private static handleStateTransition(
        state: any,
        args: Record<string, unknown>,
        context: ExecutionContext = {},
        inputContext: Record<string, unknown> = {}
    ): void {
        const originalPath = args.target as string;
        const targetPath = StateHelpers.resolvePath(originalPath, context, inputContext);
        const map = args.map as Record<string, string>;


        if (!map || typeof map !== 'object') {
            console.warn('[StepDispatcher] ⚠️ Invalid map provided to state.transition');
            return;
        }

        const current = StateHelpers.safeGet(state, targetPath, undefined, context, inputContext);
        const currentStr = String(current ?? '');

        // Implied State Protocol: If undefined, use first key
        const keys = Object.keys(map);
        const lookupKey = current === undefined ? keys[0] : currentStr;

        if (lookupKey in map) {
            const newValue = map[lookupKey];
            StateHelpers.safeSet(state, targetPath, newValue, context, inputContext);
            
            // Verify the value was set (check all possible paths)
            const verifyValue = StateHelpers.safeGet(state, targetPath, undefined, context, inputContext);
            if (verifyValue !== newValue) {
                console.warn(`[StepDispatcher] ⚠️ Value mismatch after set: expected ${newValue}, got ${verifyValue}`);
            }
        }
    }

    /**
     * logic.map: Map an input value to an output using a map
     * Safety: Returns default if input not found
     */
    private static handleLogicMap(
        state: any,
        args: Record<string, unknown>,
        context: ExecutionContext,
        inputContext: Record<string, unknown>
    ): void {
        const inputPath = args.input as string;
        const map = args.map as Record<string, unknown>;
        const defaultValue = args.default ?? null;

        // Resolve input: can be a path in state (dot notation), context, or inputContext
        // First try as a state path (if it contains dots)
        let inputValue: unknown;
        if (inputPath.includes('.')) {
            // Try as state path first
            inputValue = StateHelpers.safeGet(state, inputPath, undefined, context, inputContext);
        }
        
        // Fallback to context/inputContext lookup
        if (inputValue === undefined) {
            inputValue = context[inputPath];
        }
        if (inputValue === undefined) {
            inputValue = inputContext[inputPath];
        }

        const inputStr = String(inputValue ?? '');
        const result = map[inputStr] ?? defaultValue;

        // Store in context for potential use by output_to
        context['logic.map'] = result;
    }

    /**
     * logic.thresholds: Find threshold label for a numeric value
     * Safety: Defaults to 100 if source missing (Missing Thresholds Protocol)
     */
    private static handleLogicThresholds(
        state: any,
        args: Record<string, unknown>,
        context: ExecutionContext,
        inputContext: Record<string, unknown> = {}
    ): void {
        const sourcePath = StateHelpers.resolvePath(args.source as string, context, inputContext);
        const map = args.map as Record<string, string>;
        const outputPath = StateHelpers.resolvePath(args.output_path as string, context, inputContext);

        // Missing Thresholds Protocol: Default to 100
        let sourceValue = StateHelpers.safeGet(state, sourcePath, undefined, context, inputContext) as number | undefined;
        if (typeof sourceValue !== 'number') {
            sourceValue = 100;
        }

        if (!map || typeof map !== 'object') {
            return;
        }

        // Sort threshold keys descending to find largest match
        const thresholdKeys = Object.keys(map)
            .map(Number)
            .filter((n) => !isNaN(n))
            .sort((a, b) => b - a);

        let matchedLabel: string | undefined;
        for (const threshold of thresholdKeys) {
            if (sourceValue >= threshold) {
                matchedLabel = map[String(threshold)];
                break;
            }
        }

        if (matchedLabel && outputPath) {
            StateHelpers.safeSet(state, outputPath, matchedLabel, context, inputContext);
            context['logic.thresholds'] = matchedLabel;
        }
    }

    /**
     * logic.complex_check: Check if all requirements are met
     * Requirements: Array of { stat_path, min_value }
     */
    private static handleLogicComplexCheck(
        state: any,
        args: Record<string, unknown>,
        context: ExecutionContext,
        inputContext: Record<string, unknown> = {}
    ): void {
        const requirements = args.requirements as Array<{ stat_path: string; min_value: number }> | undefined;

        if (!Array.isArray(requirements)) {
            context['logic.complex_check'] = false;
            return;
        }

        const allMet = requirements.every((req) => {
            const resolvedPath = StateHelpers.resolvePath(req.stat_path, context, inputContext);
            const statValue = StateHelpers.safeGet(state, resolvedPath, 50, context, inputContext) as number;
            return statValue >= req.min_value;
        });

        context['logic.complex_check'] = allMet;
    }

    /**
     * resolution.contest: Roll D100 contest between two stats
     * Safety: Defaults to 50 if stat missing (Average Joe Protocol)
     */
    private static handleResolutionContest(
        state: any,
        args: Record<string, unknown>,
        context: ExecutionContext,
        inputContext: Record<string, unknown> = {}
    ): void {
        const actorStatPath = StateHelpers.resolvePath(args.actor_stat_path as string, context, inputContext);
        const targetStatPath = StateHelpers.resolvePath(args.target_stat_path as string, context, inputContext);
        // Resolve actor_mod - may be a context reference like "tactic_modifier"
        const actorModRaw = StateHelpers.resolveValue(args.actor_mod, context, inputContext);
        const actorMod = typeof actorModRaw === 'number' ? actorModRaw : 0;

        // Average Joe Protocol: Default to 50 if missing
        const actorStat = (StateHelpers.safeGet(state, actorStatPath, 50, context, inputContext) as number) + actorMod;
        const targetStat = StateHelpers.safeGet(state, targetStatPath, 50, context, inputContext) as number;

        // Roll D100 for each
        const actorRoll = Math.floor(Math.random() * 100) + 1;
        const targetRoll = Math.floor(Math.random() * 100) + 1;

        const actorTotal = actorStat + actorRoll;
        const targetTotal = targetStat + targetRoll;

        const result = actorTotal > targetTotal ? 'actor_win' : 'target_win';
        context['resolution.contest'] = result;
    }
}

/**
 * Condition Evaluator
 */
class ConditionEvaluator {
    /**
     * Evaluate a condition
     * Supports path resolution in left/right values
     */
    static evaluate(
        condition: Condition,
        state: any,
        context: ExecutionContext,
        inputContext: Record<string, unknown> = {}
    ): boolean {
        const { op, left, right } = condition;

        // Resolve left value (can be path or literal)
        const leftValue = this.resolveValue(left, state, context, inputContext);
        const rightValue = this.resolveValue(right, state, context, inputContext);

        switch (op) {
            case 'eq':
                return leftValue === rightValue;
            case 'ne':
                return leftValue !== rightValue;
            case 'gt':
                return Number(leftValue) > Number(rightValue);
            case 'lt':
                return Number(leftValue) < Number(rightValue);
            case 'gte':
                return Number(leftValue) >= Number(rightValue);
            case 'lte':
                return Number(leftValue) <= Number(rightValue);
            default:
                return false;
        }
    }

    /**
     * Resolve a value (path or literal)
     * Supports variable substitution in paths
     */
    private static resolveValue(
        value: string | number,
        state: any,
        context: ExecutionContext,
        inputContext: Record<string, unknown>
    ): unknown {
        if (typeof value === 'number') {
            return value;
        }

        // Resolve path with variable substitution first
        const resolvedPath = StateHelpers.resolvePath(value, context, inputContext);

        // Try as path in state (if it contains dots or looks like a path)
        if (resolvedPath.includes('.') || resolvedPath.includes('[') || resolvedPath.includes('{')) {
            const stateValue = StateHelpers.safeGet(state, resolvedPath, undefined, context, inputContext);
            if (stateValue !== undefined) {
                return stateValue;
            }
        }

        // Try as context key (original value, not resolved path)
        if (value in context) {
            return context[value];
        }

        // Try as inputContext key
        if (value in inputContext) {
            return inputContext[value];
        }

        // Return as literal string
        return value;
    }

    /**
     * Evaluate multiple conditions (all must pass)
     */
    static evaluateAll(
        conditions: Condition[],
        state: any,
        context: ExecutionContext,
        inputContext: Record<string, unknown> = {}
    ): boolean {
        if (!conditions || conditions.length === 0) {
            return true;
        }

        return conditions.every((cond) => this.evaluate(cond, state, context, inputContext));
    }
}

/**
 * Delta Calculator
 */
class DeltaCalculator {
    /**
     * Calculate the difference between two states
     * Returns a nested object showing only changed values
     * Ensures ALL entities are scanned (not just player)
     */
    static calculateDiff(original: any, modified: any): Record<string, any> {
        const delta: Record<string, any> = {};

        // Ensure we scan all entities from both original and modified states
        // Check all possible state structure patterns
        const originalEntities = original?.mechanical_state?.entities || 
                                 original?.tier1_mechanical?.entities || 
                                 original?.mechanical?.entities || 
                                 original?.entities || {};
        const modifiedEntities = modified?.mechanical_state?.entities || 
                                 modified?.tier1_mechanical?.entities || 
                                 modified?.mechanical?.entities || 
                                 modified?.entities || {};
        
        // Get all unique entity IDs from both states
        const allEntityIds = new Set([
            ...Object.keys(originalEntities),
            ...Object.keys(modifiedEntities)
        ]);

        // Log entity scanning for debugging
        if (allEntityIds.size > 0) {
            console.log(`[DeltaCalculator] 🔍 Scanning ${allEntityIds.size} entities:`, Array.from(allEntityIds));
        }

        // Verify: Explicitly check that we're comparing all entities, not just tier1_entity
        // The recursive diff will handle this, but we log for verification
        for (const entityId of allEntityIds) {
            const origEntity = originalEntities[entityId];
            const modEntity = modifiedEntities[entityId];
            if (origEntity !== modEntity) {
                // Entity exists and may have changes - recursive diff will catch them
                console.log(`[DeltaCalculator] 🔍 Entity ${entityId} has potential changes`);
            }
        }

        // Recursively calculate diff for entire state
        // This will scan ALL entities in state.entities (plural), not just state.tier1_entity
        this.calculateDiffRecursive(original, modified, '', delta);

        return delta;
    }

    private static calculateDiffRecursive(
        original: any,
        modified: any,
        path: string,
        delta: Record<string, any>
    ): void {
        if (original === modified) {
            return;
        }

        if (typeof original !== 'object' || typeof modified !== 'object' || original === null || modified === null) {
            // Primitive change
            if (path) {
                this.setNestedValue(delta, path, modified);
            }
            return;
        }

        // Check all keys in modified
        for (const key in modified) {
            const newPath = path ? `${path}.${key}` : key;
            const origValue = original[key];
            const modValue = modified[key];

            if (!(key in original)) {
                // New key
                this.setNestedValue(delta, newPath, modValue);
            } else if (JSON.stringify(origValue) !== JSON.stringify(modValue)) {
                // Changed value
                if (typeof modValue === 'object' && modValue !== null && !Array.isArray(modValue)) {
                    this.calculateDiffRecursive(origValue, modValue, newPath, delta);
                } else {
                    this.setNestedValue(delta, newPath, modValue);
                }
            }
        }
    }

    private static setNestedValue(obj: any, path: string, value: unknown): void {
        const parts = path.split('.');
        let current = obj;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!(part in current)) {
                current[part] = {};
            }
            current = current[part];
        }

        current[parts[parts.length - 1]] = value;
    }
}

/**
 * Main Action Executor
 */
export class DeterministicEngine {
    /**
     * Execute an action definition against the current state
     * @param currentState The full game state
     * @param actionDef The action definition with logic steps
     * @param inputContext Optional input context (e.g., from MAS1)
     * @returns Modified state and delta of changes
     */
    static executeAction(
        currentState: any,
        actionDef: ActionDefinition,
        inputContext: Record<string, unknown> = {}
    ): { state: any; delta: Record<string, any> } {
        const actionId = (actionDef as any).id || (actionDef as any).action_id || 'unknown';
        LogicTracer.trace(`DeterministicEngine.executeAction started`, {
            action_id: actionId,
            logic_steps: actionDef.logic?.length || 0,
            input_context_keys: Object.keys(inputContext),
        });
        
        // Verify entities in state
        const entities = currentState.tier1_mechanical?.entities || 
                       currentState.mechanical?.entities ||
                       currentState.entities ||
                       {};

        // Deep clone state for immutability
        const newState = structuredClone(currentState);
        const originalState = structuredClone(currentState);

        // Execution context for intermediate results
        const context: ExecutionContext = {};

        // Iterate through logic steps
        const steps = actionDef.logic || [];
        LogicTracer.trace(`Executing ${steps.length} logic steps`, {
            action_id: actionId,
            step_count: steps.length,
        });
        
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const stepId = step.step_id || step.function || `step_${i}`;
            
            // Evaluate conditions if present
            if (step.conditions && step.conditions.length > 0) {
                const conditionsMet = ConditionEvaluator.evaluateAll(
                    step.conditions,
                    newState,
                    context,
                    inputContext
                );

                if (!conditionsMet) {
                    LogicTracer.warning(`Step skipped - conditions not met`, {
                        step_id: stepId,
                        action_id: actionId,
                        condition_count: step.conditions.length,
                    });
                    continue; // Skip this step
                }
            }

            // Execute step
            try {
                StepDispatcher.executeStep(newState, step, context, inputContext);
            } catch (error) {
                LogicTracer.error(`Error executing step`, error, {
                    step_id: stepId,
                    action_id: actionId,
                    function: step.function,
                });
                // Continue execution (robustness)
            }
        }
        
        // Log contest result for debugging
        if (context['resolution.contest']) {
            LogicTracer.trace(`Contest result`, {
                action_id: actionId,
                contest_result: context['resolution.contest'],
            });
        }

        // Calculate delta
        const delta = DeltaCalculator.calculateDiff(originalState, newState);
        
        LogicTracer.trace(`DeterministicEngine.executeAction completed`, {
            action_id: actionId,
            delta_keys: Object.keys(delta),
            delta_size: Object.keys(delta).length,
        });
        
        return { state: newState, delta };
    }
}

/**
 * Resolution Service
 * Main entry point for action resolution
 */

// Hardcoded Guard ID for consistent testing (Mock Intent Resolver)
const GUARD_ID = '39757d45-2426-4377-a5d0-e99e9681d1ff';

export class ResolutionService {
    /**
     * Resolve an action (legacy interface for backward compatibility)
     * TODO: This should eventually receive actionDef from MAS1/compiled story
     */
    async resolve(input: string, state: any): Promise<ResolutionResult> {
        const lower = input.toLowerCase();

        // 1. Mock MAS-1 Interpretation (temporary until MAS1 integration)
        let mas1: Mas1Intent = {
            type: 'NARRATIVE',
            intent: 'attempt_action',
            skill_id: 'root_finesse',
            difficulty_mod: 0,
            duration_tag: 'moment',
            confidence: 1.0,
            analysis: 'Heuristic Default',
            parameters: {},
        };

        if (lower.includes('attack') || lower.includes('hit') || lower.includes('strike') || lower.includes('fight')) {
            mas1 = {
                type: 'COMBAT',
                intent: 'combat_action',
                skill_id: 'root_force',
                difficulty_mod: 0,
                duration_tag: 'moment',
                confidence: 1.0,
                analysis: 'Combat Intent',
                parameters: {},
            };
        } else if (lower.includes('look') || lower.includes('search')) {
            mas1 = {
                type: 'NARRATIVE',
                intent: 'attempt_action',
                skill_id: 'root_awareness',
                difficulty_mod: 0,
                duration_tag: 'scene',
                confidence: 1.0,
                analysis: 'Observation Intent',
                parameters: {},
            };
        }

        const logs: string[] = [];
        logs.push(`[SYSTEM] MAS-1 Intent: ${mas1.intent}`);

        // 2. Get player ID for path substitution
        const playerId = state.mechanical?.index?.player_id;
        if (!playerId) {
            logs.push('[ENGINE] Error: Player ID not found in state');
            return {
                success: false,
                logs,
                mechanicalDelta: {},
                intent: mas1,
            };
        }

        // 3. For now, use a simple mock action definition
        // TODO: Replace with actual action lookup from compiled story
        const mockActionDef: ActionDefinition = {
            logic: [
                {
                    function: 'state.modify',
                    args: {
                        path: `mechanical.entities[${playerId}].properties.current_stamina`,
                        amount: mas1.type === 'COMBAT' ? -5 : -1,
                        clamp_min: 0,
                    },
                },
                {
                    function: 'state.modify',
                    args: {
                        path: `mechanical.entities[${playerId}].properties.satiety`,
                        amount: -1,
                        clamp_min: 0,
                    },
                },
            ],
        };

        // 4. Force Target Injection: Ensure target_id is present for combat/social actions
        // This acts as a "Mock Intent Resolver" to handle cases where MAS1 doesn't provide target_id
        const context: Record<string, unknown> = {
            player_id: playerId,
        };
        
        // Inject target_id for combat/social intents
        if (mas1.intent === 'combat_action' || mas1.intent === 'social_action') {
            if (!mas1.parameters?.target_id) {
                context.target_id = GUARD_ID;
                console.log('[Resolution] 🛡️ Mock Injection: Targeting Guard (39757d...) for intent:', mas1.intent);
            } else {
                context.target_id = mas1.parameters.target_id;
            }
        }

        // Execute action using Deterministic Engine
        try {
            const { state: newState, delta } = DeterministicEngine.executeAction(state, mockActionDef, context);

            logs.push(`[ENGINE] Action executed successfully`);
            logs.push(`[ENGINE] Delta: ${JSON.stringify(delta)}`);

            // Transform nested delta to flat entity-keyed format for frontend
            const { transformDeltaToEntityKeyed } = await import('./delta-transformer.js');
            const flatDelta = transformDeltaToEntityKeyed(delta);

            return {
                success: true,
                logs,
                mechanicalDelta: flatDelta,
                intent: mas1,
                state: newState,
            };
        } catch (error) {
            logs.push(`[ENGINE] Error: ${error instanceof Error ? error.message : String(error)}`);
            return {
                success: false,
                logs,
                mechanicalDelta: {},
                intent: mas1,
            };
        }
    }

    /**
     * Execute action with full action definition (new interface)
     */
    async executeAction(
        state: any,
        actionDef: ActionDefinition,
        inputContext: Record<string, unknown> = {}
    ): Promise<{ state: any; delta: Record<string, any> }> {
        return DeterministicEngine.executeAction(state, actionDef, inputContext);
    }

    /**
     * Execute action from MAS1 intent (proper game loop interface)
     * Converts Mas1Intent to action definition and executes it deterministically
     * Supports multiple targets via target_ids array
     */
    async executeActionFromMas1(
        state: any,
        intent: { trigger_id: string; target_ids: string[]; parameters: Record<string, unknown> },
        actionsMap: Record<string, unknown>
    ): Promise<{ success: boolean; state: any; delta: Record<string, any> }> {
        // Log action start
        LogicTracer.actionStart(intent.trigger_id, intent.target_ids, intent.parameters);
        
        // Map trigger_id to action slug (ruleset matching)
        const triggerMap: Record<string, string> = {
            combat_action: 'resolve_clash',
            social_action: 'apply_relationship_delta',
            rest_action: 'take_rest',
            attempt_action: 'attempt_action',
            navigate: 'navigate',
        };
        
        const actionSlug = triggerMap[intent.trigger_id] || intent.trigger_id;
        LogicTracer.trace(`Mapped trigger to action slug`, {
            trigger_id: intent.trigger_id,
            action_slug: actionSlug,
        });
        const { ACTION_LIBRARY } = await import('./ruleset.library.js');
        
        // Get action definition from ACTION_LIBRARY (preferred) or actionsMap (fallback)
        let actionDef = ACTION_LIBRARY[actionSlug] as ActionDefinition | undefined;
        if (!actionDef && actionsMap[actionSlug]) {
            // Parse from actionsMap if needed
            const actionData = actionsMap[actionSlug];
            if (typeof actionData === 'object' && actionData !== null) {
                actionDef = actionData as ActionDefinition;
            }
        }

        if (!actionDef) {
            LogicTracer.error(`Action not found`, new Error(`Action "${actionSlug}" not found`), {
                action_slug: actionSlug,
                trigger_id: intent.trigger_id,
            });
            return {
                success: false,
                state,
                delta: {}
            };
        }
        
        LogicTracer.trace(`Action definition found`, {
            action_slug: actionSlug,
            has_logic: !!actionDef.logic,
            logic_steps: Array.isArray(actionDef.logic) ? actionDef.logic.length : 0,
        });

        // Get player ID
        const playerId =
            state.mechanical_state?.tier1_mechanical?.index?.player_id ||
            state.tier1_mechanical?.index?.player_id ||
            state.mechanical?.index?.player_id ||
            state.player_id;

        if (!playerId) {
            throw new Error('Player ID not found in state');
        }

        // Handle multiple targets: iterate through target_ids array
        let currentState = state;
        let combinedDelta: Record<string, any> = {};
        let allSuccess = true;
        
        const targetIds = intent.target_ids.length > 0 ? intent.target_ids : ['default'];
        
        for (const targetId of targetIds) {
            // Clone actionDef for each target to avoid mutations
            let targetActionDef = JSON.parse(JSON.stringify(actionDef)) as ActionDefinition;
            
            // Fallback to hardcoded Guard ID for combat actions if no target
            const isCombatAction = actionSlug === 'resolve_clash' || actionSlug.includes('combat');
            const resolvedTargetId = targetId === 'default' 
                ? (isCombatAction ? GUARD_ID : undefined)
                : targetId;
            
            // Special logging for relationship delta actions
            if (actionSlug === 'apply_relationship_delta') {
                LogicTracer.relationshipDeltaTarget(
                    resolvedTargetId || targetId,
                    targetId === 'default' ? 'default' : targetId,
                    intent.parameters.verb as string || 'unknown'
                );
            }
            
            if (isCombatAction && !resolvedTargetId) {
                LogicTracer.trace(`Auto-injecting Guard target for combat action`, {
                    action_slug: actionSlug,
                });
            }
            
            LogicTracer.trace(`Processing target`, {
                target_id: resolvedTargetId || targetId,
                original_target_id: targetId,
                is_combat: isCombatAction,
            });

            // Runtime patch for resolve_clash to fix target path
            if (isCombatAction && actionSlug === 'resolve_clash' && targetActionDef && resolvedTargetId) {
                // A. Redirect Outcome to Target
                const woundStep = targetActionDef.logic?.find((s: any) => s.step_id === 'escalate_wound_target');
                if (woundStep) {
                    woundStep.args.target = 'tier1_mechanical.entities.{target_id}.properties.combat_condition';
                }

                // B. Remove Dice Roll (Force Deterministic Win for Testing)
                // We remove the random roll so we can inject 'clash_result' = 'actor_win'
                targetActionDef.logic = targetActionDef.logic.filter((s: any) => s.step_id !== 'roll_contest');
            }

            // Resolve entity paths
            targetActionDef = ResolutionService.resolveEntityPaths(
                targetActionDef,
                playerId,
                resolvedTargetId,
                isCombatAction
            );

            // Create context from intent parameters
            const context: Record<string, unknown> = {
                player_id: playerId,
                ...intent.parameters,
                target_id: resolvedTargetId || intent.parameters?.target_id,
                tactic_tag: intent.parameters?.tactic_tag || (isCombatAction ? 'aggressive' : undefined),
                // Force the Cinematic Win condition (for testing)
                clash_result: isCombatAction ? 'actor_win' : undefined,
                tactic_modifier: isCombatAction ? 0 : undefined,
            };

            // Execute action against current state (so subsequent targets see updated state)
            LogicTracer.trace(`Executing action for target`, {
                target_id: resolvedTargetId || targetId,
                action_slug: actionSlug,
                context_keys: Object.keys(context),
                target_index: targetIds.indexOf(targetId) + 1,
                total_targets: targetIds.length,
            });
            
            // Log state snapshot before execution (for debugging lost updates)
            const stateSnapshot = JSON.parse(JSON.stringify(currentState));
            const playerStaminaBefore = StateHelpers.safeGet(
                currentState,
                `tier1_mechanical.entities[${playerId}].properties.current_stamina`,
                0,
                {},
                { player_id: playerId }
            );
            
            LogicTracer.trace(`State snapshot before target execution`, {
                target_id: resolvedTargetId || targetId,
                player_stamina: playerStaminaBefore,
            });
            
            try {
                // CRITICAL: Pass currentState (which may have been modified by previous targets)
                // DeterministicEngine.executeAction clones the state internally, so we need the returned newState
                const { state: newState, delta } = await DeterministicEngine.executeAction(
                    currentState,
                    targetActionDef,
                    context
                );
                
                // Log state after execution
                const playerStaminaAfter = StateHelpers.safeGet(
                    newState,
                    `tier1_mechanical.entities[${playerId}].properties.current_stamina`,
                    0,
                    {},
                    { player_id: playerId }
                );
                
                LogicTracer.trace(`Action execution completed`, {
                    target_id: resolvedTargetId || targetId,
                    delta_keys: Object.keys(delta),
                    delta_size: Object.keys(delta).length,
                    player_stamina_before: playerStaminaBefore,
                    player_stamina_after: playerStaminaAfter,
                    stamina_change: playerStaminaAfter - playerStaminaBefore,
                });
                
                // Transform delta
                const { transformDeltaToEntityKeyed } = await import('./delta-transformer.js');
                const flatDelta = transformDeltaToEntityKeyed(delta);
                
                // Merge deltas
                combinedDelta = this.mergeDeltas(combinedDelta, flatDelta);
                
                // CRITICAL: Update currentState to the modified state from this iteration
                // This ensures the next target sees the changes from this target
                currentState = newState;
                
                LogicTracer.trace(`State updated for next iteration`, {
                    target_id: resolvedTargetId || targetId,
                    next_target_index: targetIds.indexOf(targetId) + 2,
                    player_stamina: playerStaminaAfter,
                });
            } catch (error) {
                LogicTracer.error(`Action execution failed for target`, error, {
                    target_id: resolvedTargetId || targetId,
                    action_slug: actionSlug,
                });
                throw error;
            }
        }
        
        LogicTracer.trace(`All targets processed`, {
            target_count: targetIds.length,
            combined_delta_keys: Object.keys(combinedDelta),
            combined_delta_size: Object.keys(combinedDelta).length,
        });

        return {
            success: allSuccess,
            state: currentState,
            delta: combinedDelta
        };
    }

    /**
     * Merge two delta objects, combining nested structures
     */
    private mergeDeltas(delta1: Record<string, any>, delta2: Record<string, any>): Record<string, any> {
        const merged = { ...delta1 };
        
        for (const [key, value] of Object.entries(delta2)) {
            if (merged[key] && typeof merged[key] === 'object' && typeof value === 'object' && !Array.isArray(value)) {
                merged[key] = { ...merged[key], ...value };
            } else {
                merged[key] = value;
            }
        }
        
        return merged;
    }

    /**
     * Resolve entity paths - Expands shorthand references like tier1_entity and tier1_player
     * to actual state paths based on entity IDs
     * 
     * Rules:
     * - tier1_entity: Defaults to player, but in combat actions refers to target
     * - tier1_player: Always refers to player
     * - tier1_world: Refers to world/global state
     */
    private static resolveEntityPaths(
        actionDef: ActionDefinition,
        playerId: string,
        targetId?: string,
        isCombatAction: boolean = false
    ): ActionDefinition {
        // Deep clone to avoid mutation
        const resolved = JSON.parse(JSON.stringify(actionDef)) as ActionDefinition;

        // Determine state structure (support multiple formats)
        const getEntityPath = (entityId: string): string => {
            if (entityId) {
                // Support multiple state structure patterns
                // The path resolver will handle bracket notation
                return `tier1_mechanical.entities[${entityId}]`;
            }
            return '';
        };

        const playerPath = getEntityPath(playerId);
        const targetPath = targetId ? getEntityPath(targetId) : '';

        // Determine which entity tier1_entity refers to
        // In combat actions with a target, tier1_entity = target
        // Otherwise, tier1_entity = player
        const tier1EntityPath = isCombatAction && targetPath ? targetPath : playerPath;

        // Replace shorthand references in all step paths
        for (const step of resolved.logic) {
            if (step.args && typeof step.args === 'object') {
                // Replace tier1_entity (context-dependent)
                if (tier1EntityPath && 'path' in step.args && typeof step.args.path === 'string') {
                    step.args.path = step.args.path.replace(/^tier1_entity\./, `${tier1EntityPath}.`);
                }
                if (tier1EntityPath && 'target' in step.args && typeof step.args.target === 'string') {
                    step.args.target = step.args.target.replace(/^tier1_entity\./, `${tier1EntityPath}.`);
                }
                if (tier1EntityPath && 'actor_stat_path' in step.args && typeof step.args.actor_stat_path === 'string') {
                    step.args.actor_stat_path = step.args.actor_stat_path.replace(/^tier1_entity\./, `${tier1EntityPath}.`);
                }
                if (tier1EntityPath && 'target_stat_path' in step.args && typeof step.args.target_stat_path === 'string') {
                    step.args.target_stat_path = step.args.target_stat_path.replace(/^tier1_entity\./, `${tier1EntityPath}.`);
                }
                if (tier1EntityPath && 'source' in step.args && typeof step.args.source === 'string') {
                    step.args.source = step.args.source.replace(/^tier1_entity\./, `${tier1EntityPath}.`);
                }

                // Replace tier1_player (always player)
                // When replacing, ensure we add .properties for property accesses
                // Entity properties are stored under .properties in the state structure
                if (playerPath && 'path' in step.args && typeof step.args.path === 'string') {
                    const originalPath = step.args.path;
                    if (originalPath.startsWith('tier1_player.')) {
                        const propertyPath = originalPath.replace(/^tier1_player\./, '');
                        // Always add .properties unless the path already includes it
                        if (propertyPath && !propertyPath.startsWith('properties.')) {
                            step.args.path = `${playerPath}.properties.${propertyPath}`;
                        } else {
                            step.args.path = `${playerPath}.${propertyPath}`;
                        }
                    }
                }
                if (playerPath && 'target' in step.args && typeof step.args.target === 'string') {
                    const originalTarget = step.args.target;
                    if (originalTarget.startsWith('tier1_player.')) {
                        const propertyPath = originalTarget.replace(/^tier1_player\./, '');
                        if (propertyPath && !propertyPath.startsWith('properties.')) {
                            step.args.target = `${playerPath}.properties.${propertyPath}`;
                        } else {
                            step.args.target = `${playerPath}.${propertyPath}`;
                        }
                    }
                }
                // Also handle actor_stat_path for tier1_player
                if (playerPath && 'actor_stat_path' in step.args && typeof step.args.actor_stat_path === 'string') {
                    const originalPath = step.args.actor_stat_path;
                    if (originalPath.startsWith('tier1_player.')) {
                        const propertyPath = originalPath.replace(/^tier1_player\./, '');
                        if (propertyPath && !propertyPath.startsWith('properties.')) {
                            step.args.actor_stat_path = `${playerPath}.properties.${propertyPath}`;
                        } else {
                            step.args.actor_stat_path = `${playerPath}.${propertyPath}`;
                        }
                    }
                }

                // Replace tier1_world shorthand (world/global state)
                if ('path' in step.args && typeof step.args.path === 'string') {
                    step.args.path = step.args.path.replace(
                        /^tier1_world\./,
                        'tier1_mechanical.globals.'
                    );
                }
            }
        }

        return resolved;
    }

    /**
     * Resolve mock action - Maps user text to action definitions for manual testing
     * This is a pure string-matching mock dispatcher (no AI)
     * 
     * @param state - Full game state
     * @param userText - User input text
     * @returns Modified state and delta
     */
    async resolveMockAction(
        state: any,
        userText: string
    ): Promise<{ state: any; delta: Record<string, any> }> {
        console.log('[Resolution] ========== RESOLVE MOCK ACTION START ==========');
        console.log('[Resolution] 📥 Input:', { userText, stateKeys: Object.keys(state || {}) });

        const lower = userText.toLowerCase();

        // Get player ID from state
        const playerId =
            state.mechanical_state?.tier1_mechanical?.index?.player_id ||
            state.tier1_mechanical?.index?.player_id ||
            state.mechanical?.index?.player_id ||
            state.player_id;

        if (!playerId) {
            throw new Error('Player ID not found in state');
        }

        // Import action library
        const { ACTION_LIBRARY } = await import('./ruleset.library.js');

        // ============================================
        // 1. INTENT COLLECTION (Multi-Action Support)
        // ============================================
        const intents: Mas1Intent[] = [];
        const isCombatInput = lower.includes('attack') || lower.includes('fight') || lower.includes('hit');

        if (isCombatInput) {
            intents.push({
                type: 'COMBAT',
                intent: 'resolve_clash', // Cinematic Combat
                skill_id: 'root_force',
                difficulty_mod: 0,
                duration_tag: 'moment',
                confidence: 1.0,
                analysis: 'Cinematic Combat Intent',
                parameters: {},
            });
        } else if (lower.includes('rest') || lower.includes('camp')) {
            intents.push({
                type: 'NARRATIVE',
                intent: 'take_rest',
                skill_id: 'root_finesse',
                difficulty_mod: 0,
                duration_tag: 'moment',
                confidence: 1.0,
                analysis: 'Rest Intent',
                parameters: {},
            });
        } else if (lower.includes('flirt')) {
            intents.push({
                type: 'NARRATIVE',
                intent: 'social_action',
                skill_id: 'root_finesse',
                difficulty_mod: 0,
                duration_tag: 'moment',
                confidence: 1.0,
                analysis: 'Social Intent',
                parameters: { verb: 'flirt' },
            });
        } else if (lower.includes('insult')) {
            intents.push({
                type: 'NARRATIVE',
                intent: 'social_action',
                skill_id: 'root_finesse',
                difficulty_mod: 0,
                duration_tag: 'moment',
                confidence: 1.0,
                analysis: 'Social Intent',
                parameters: { verb: 'insult' },
            });
        }

        // Future proofing: Add more intents here (e.g., "shout" -> social_action)

        if (intents.length === 0) {
            throw new Error(`No action matched for input: "${userText}"`);
        }

        // ============================================
        // 2. EXECUTION LOOP (Process Each Intent)
        // ============================================
        let currentState = state;
        let combinedDelta: Record<string, any> = {};

        for (let i = 0; i < intents.length; i++) {
            const intent = intents[i];
            console.log(`[Resolution] 🔄 Processing Intent ${i + 1}/${intents.length}: ${intent.intent}`);

            // A. MOCK INJECTION (Target ID)
            const isCombat = ['combat_action', 'resolve_clash'].includes(intent.intent);
            const isSocial = intent.intent === 'social_action';
            
            if ((isCombat || isSocial) && !intent.parameters?.target_id) {
                console.warn('[Resolution] 🛡️ Mock Injection: Targeting Guard (39757d...)');
                intent.parameters = { 
                    ...intent.parameters, 
                    target_id: GUARD_ID
                };
            }

            const targetId = intent.parameters?.target_id as string | undefined;

            // B. FETCH & PATCH DEFINITION
            // Map intent to action slug
            let actionSlug: string;
            if (intent.intent === 'resolve_clash') {
                actionSlug = 'resolve_clash';
            } else if (intent.intent === 'take_rest') {
                actionSlug = 'take_rest';
            } else if (intent.intent === 'social_action') {
                actionSlug = 'apply_relationship_delta';
            } else {
                actionSlug = intent.intent; // Fallback
            }

            let actionDef = ACTION_LIBRARY[actionSlug];
            if (!actionDef) {
                // Fallback to resolve_clash if not found
                actionDef = ACTION_LIBRARY['resolve_clash'];
                console.warn(`[Resolution] ⚠️ Action "${actionSlug}" not found, using resolve_clash as fallback`);
            }

            // Apply Cinematic Patch for combat actions
            if (isCombat && actionDef) {
                actionDef = JSON.parse(JSON.stringify(actionDef)); // Deep clone
                
                // Patch Wound Path
                const woundStep = actionDef.logic?.find((s: any) => s.step_id === 'escalate_wound_target');
                if (woundStep) {
                    woundStep.args.target = 'tier1_mechanical.entities.{target_id}.properties.combat_condition';
                }
                
                // Force Cinematic Win (Remove RNG)
                actionDef.logic = actionDef.logic.filter((s: any) => s.step_id !== 'roll_contest');
            }

            // Resolve entity paths
            actionDef = this.resolveEntityPaths(actionDef, playerId, targetId, isCombat);

            // C. CONTEXT SETUP
            const context: Record<string, unknown> = {
                ...intent.parameters,
                target_id: intent.parameters?.target_id || targetId,
                tactic_tag: intent.parameters?.tactic_tag || (isCombat ? 'aggressive' : undefined),
                // Force the Cinematic Win condition (for testing)
                clash_result: isCombat ? 'actor_win' : undefined,
                tactic_modifier: isCombat ? 0 : undefined,
            };

            // D. EXECUTE
            console.log(`[Resolution] ⚙️ Executing action: ${actionSlug}`);
            const { state: nextState, delta } = await DeterministicEngine.executeAction(currentState, actionDef, context);
            
            // E. UPDATE STATE & MERGE DELTA
            currentState = nextState;
            // Deep merge deltas
            combinedDelta = merge(combinedDelta, delta);
            
            console.log(`[Resolution] ✅ Intent ${i + 1} complete. Delta keys:`, Object.keys(delta));
        }

        // ============================================
        // 3. TRANSFORM & RETURN
        // ============================================
        const { transformDeltaToEntityKeyed } = await import('./delta-transformer.js');
        const flatDelta = transformDeltaToEntityKeyed(combinedDelta);

        console.log('[Resolution] 🚀 Final Clean Delta:', JSON.stringify(flatDelta, null, 2));
        console.log('[Resolution] 🚀 Delta entities keys:', flatDelta.entities ? Object.keys(flatDelta.entities) : 'NO ENTITIES');
        console.log('[Resolution] ========== RESOLVE MOCK ACTION END ==========');

        return { state: currentState, delta: flatDelta };
    }
}
