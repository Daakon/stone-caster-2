// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * [SERVICE] StateService
 * ----------------------------------------------------------------------
 * ROLE: Single Source of Truth for the active Game State during a Turn.
 * RESPONSIBILITY:
 * - Managing in-memory state mutations.
 * - Executing deep-writes with STRICT SCHEMA VALIDATION (no auto-vivification).
 * - Providing the authoritative snapshot for the database.
 *
 * CONSTRAINTS:
 * - All methods MUTATE the state in-place.
 * - Handles 'Tier1' (Entity) and 'Tier2' (System) data structures.
 * - STRICT SCHEMA ENFORCEMENT: Blocks writes to paths not in CompiledStory.schema
 * - NO AUTO-VIVIFICATION: Paths must exist in schema before modification
 * - Deep writes: Supports dot-notation traversal (e.g., "entities.enemy.stats.hp").
 */

import type { GameState } from '@shared/types/chimera-runtime';

/**
 * Extended GameState structure used in runtime
 * The runtime services use tier1_mechanical and tier0_narrative
 * even though the schema defines mechanical_state and narrative_focus
 */
type RuntimeGameState = GameState & {
  tier1_mechanical?: Record<string, unknown>;
  tier0_narrative?: Record<string, unknown>;
};

/**
 * Schema validation structure from CompiledStory
 */
interface StateSchema {
  tier1_allowlist?: string[];
  tier0_allowlist?: string[];
}

export class StateService {
  private state: RuntimeGameState;
  private schema: StateSchema | null;

  constructor(initialState: GameState, schema?: StateSchema) {
    // Deep clone to avoid external mutations
    this.state = JSON.parse(JSON.stringify(initialState)) as RuntimeGameState;
    
    // Store schema for validation (strict enforcement)
    this.schema = schema || null;
    
    // Ensure tier structures exist
    if (!this.state.tier1_mechanical) {
      this.state.tier1_mechanical = {};
    }
    if (!this.state.tier0_narrative) {
      this.state.tier0_narrative = {};
    }
  }

  /**
   * [METHOD] getState
   * ----------------------------------------------------------------
   * @sourceOfTruth - Returns the current mutable state reference
   * @logic_flow
   * 1. Returns the authoritative state snapshot
   * 2. For persistence, this is the source of truth (not engine deltas)
   */
  getState(): GameState {
    // Return a deep clone to prevent external mutations
    return JSON.parse(JSON.stringify(this.state)) as GameState;
  }

  /**
   * [METHOD] validatePath
   * ----------------------------------------------------------------
   * STRICT SCHEMA ENFORCEMENT: Validates path exists in schema OR already exists in state
   * @sourceOfTruth - CompiledStory.schema (tier1_allowlist, tier0_allowlist) + current state
   * @logic_flow
   * 1. Check if path already exists in state (backward compatibility)
   * 2. If not in state, check if field exists in schema allowlist
   * 3. Block only if path doesn't exist AND not in allowlist
   * 4. Return validation result
   */
  private validatePath(path: string): { valid: boolean; reason?: string } {
    // If no schema provided, allow all (backward compatibility)
    if (!this.schema) {
      return { valid: true };
    }

    // First check: Does the path already exist in state? (backward compatibility)
    const pathExists = this.pathExistsInState(path);
    if (pathExists) {
      return { valid: true };
    }

    // Second check: Is the field in the schema allowlist? (new fields must be in schema)
    const parts = path.split('.');
    const fieldName = parts[parts.length - 1];
    
    // Determine tier from path
    const isTier1 = path.includes('tier1_mechanical') || (!path.includes('tier0_narrative') && path.includes('entities'));
    const isTier0 = path.includes('tier0_narrative');
    
    // Check allowlist
    if (isTier1 && this.schema.tier1_allowlist) {
      if (!this.schema.tier1_allowlist.includes(fieldName)) {
        return {
          valid: false,
          reason: `Field "${fieldName}" not in tier1_allowlist and path does not exist in state. Path: ${path}`
        };
      }
    } else if (isTier0 && this.schema.tier0_allowlist) {
      if (!this.schema.tier0_allowlist.includes(fieldName)) {
        return {
          valid: false,
          reason: `Field "${fieldName}" not in tier0_allowlist and path does not exist in state. Path: ${path}`
        };
      }
    }
    
    return { valid: true };
  }

  /**
   * [METHOD] pathExistsInState
   * ----------------------------------------------------------------
   * Checks if a path exists in the current state (for backward compatibility)
   */
  private pathExistsInState(path: string): boolean {
    const parts = path.split('.');
    let current: unknown = this.state;
    
    // Handle tier prefix
    if (parts[0] === 'tier1_mechanical' || parts[0] === 'tier0_narrative') {
      const tier = parts[0];
      if (!this.state[tier]) {
        return false;
      }
      current = this.state[tier];
      parts.shift();
    } else if (path.includes('entities')) {
      // Default to tier1_mechanical for entity paths
      if (!this.state.tier1_mechanical) {
        return false;
      }
      current = this.state.tier1_mechanical;
    }
    
    // Navigate path
    for (const part of parts) {
      if (current === null || current === undefined) {
        return false;
      }
      if (typeof current !== 'object' || Array.isArray(current)) {
        return false;
      }
      if (!(part in current)) {
        return false;
      }
      current = (current as Record<string, unknown>)[part];
    }
    
    return true;
  }

  /**
   * [METHOD] setValue
   * ----------------------------------------------------------------
   * @mutates context.state - Sets a value at the specified path
   * STRICT SCHEMA ENFORCEMENT: Blocks writes to paths not in schema
   * @sourceOfTruth - The internal state object
   * @logic_flow
   * 1. Validate path against schema (STRICT ENFORCEMENT)
   * 2. If invalid, log LOGIC_ERROR and block write
   * 3. If valid, navigate to path (NO AUTO-VIVIFICATION - path must exist)
   * 4. Set the final value at the target path
   */
  setValue(path: string, value: unknown): void {
    // STRICT SCHEMA VALIDATION
    const validation = this.validatePath(path);
    if (!validation.valid) {
      console.error(`[LOGIC_ERROR] [StateService] Schema validation failed: ${validation.reason}`);
      return;
    }
    const parts = path.split('.');
    // Handle paths that start with tier1_mechanical or tier0_narrative
    let current: Record<string, unknown>;
    
    // If path starts with tier1_mechanical or tier0_narrative, navigate there first
    if (parts[0] === 'tier1_mechanical' || parts[0] === 'tier0_narrative') {
      const tier = parts[0];
      if (!this.state[tier]) {
        console.error(`[LOGIC_ERROR] [StateService] Tier "${tier}" does not exist in state. Path: ${path}`);
        return;
      }
      current = this.state[tier]!;
      parts.shift(); // Remove the tier prefix
    } else {
      // Default to tier1_mechanical if no tier specified
      if (!this.state.tier1_mechanical) {
        console.error(`[LOGIC_ERROR] [StateService] tier1_mechanical does not exist in state. Path: ${path}`);
        return;
      }
      current = this.state.tier1_mechanical;
    }

    // Navigate to path (NO AUTO-VIVIFICATION - path must exist)
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object' || Array.isArray(current[part])) {
        console.error(`[LOGIC_ERROR] [StateService] Path segment "${parts.slice(0, i + 1).join('.')}" does not exist. Path: ${path}`);
        return;
      }
      current = current[part] as Record<string, unknown>;
    }

    // Set the final value
    const finalKey = parts[parts.length - 1];
    current[finalKey] = value;
  }

  /**
   * [METHOD] modifyValue
   * ----------------------------------------------------------------
   * @mutates context.state - Modifies a numeric value at the specified path
   * STRICT SCHEMA ENFORCEMENT: Blocks writes to paths not in schema
   * @sourceOfTruth - The internal state object
   * @logic_flow
   * 1. Validate path against schema (STRICT ENFORCEMENT)
   * 2. If invalid, log LOGIC_ERROR and block write
   * 3. Navigate to path (NO AUTO-VIVIFICATION - path must exist)
   * 4. Get current value (must exist - no treating undefined as 0)
   * 5. Apply modification (current + amount)
   * 6. Set the new value
   */
  modifyValue(path: string, amount: number): void {
    // STRICT SCHEMA VALIDATION
    const validation = this.validatePath(path);
    if (!validation.valid) {
      console.error(`[LOGIC_ERROR] [StateService] Schema validation failed: ${validation.reason}`);
      return;
    }
    const parts = path.split('.');
    // Handle paths that start with tier1_mechanical or tier0_narrative
    let current: Record<string, unknown>;
    
    // If path starts with tier1_mechanical or tier0_narrative, navigate there first
    if (parts[0] === 'tier1_mechanical' || parts[0] === 'tier0_narrative') {
      const tier = parts[0];
      if (!this.state[tier]) {
        console.error(`[LOGIC_ERROR] [StateService] Tier "${tier}" does not exist in state. Path: ${path}`);
        return;
      }
      current = this.state[tier]!;
      parts.shift(); // Remove the tier prefix
    } else {
      // Default to tier1_mechanical if no tier specified
      if (!this.state.tier1_mechanical) {
        console.error(`[LOGIC_ERROR] [StateService] tier1_mechanical does not exist in state. Path: ${path}`);
        return;
      }
      current = this.state.tier1_mechanical;
    }

    // Navigate to path (NO AUTO-VIVIFICATION - path must exist)
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object' || Array.isArray(current[part])) {
        console.error(`[LOGIC_ERROR] [StateService] Path segment "${parts.slice(0, i + 1).join('.')}" does not exist. Path: ${path}`);
        return;
      }
      current = current[part] as Record<string, unknown>;
    }

    // Get current value (MUST EXIST - no auto-vivification)
    const finalKey = parts[parts.length - 1];
    const currentValue = current[finalKey];

    if (currentValue === undefined || currentValue === null) {
      console.error(`[LOGIC_ERROR] [StateService] Cannot modify missing value at path: ${path}. Value must exist in schema.`);
      return;
    }

    if (typeof currentValue !== 'number') {
      console.error(`[LOGIC_ERROR] [StateService] Cannot modify non-numeric value at ${path}: ${typeof currentValue}`);
      return;
    }

    // Apply modification
    const newValue = currentValue + amount;
    current[finalKey] = newValue;
  }

  /**
   * [METHOD] getValue
   * ----------------------------------------------------------------
   * @sourceOfTruth - The internal state object
   * @logic_flow
   * 1. Resolve path segments (supports dot-notation)
   * 2. Navigate to target path
   * 3. Return value or undefined if path doesn't exist
   */
  getValue(path: string): unknown {
    const parts = path.split('.');
    // Handle paths that start with tier1_mechanical or tier0_narrative
    let current: Record<string, unknown>;
    
    // If path starts with tier1_mechanical or tier0_narrative, navigate there first
    if (parts[0] === 'tier1_mechanical' || parts[0] === 'tier0_narrative') {
      const tier = parts[0];
      const tierState = this.state[tier];
      if (!tierState) {
        return undefined;
      }
      current = tierState;
      parts.shift(); // Remove the tier prefix
    } else {
      // Default to tier1_mechanical if no tier specified
      const tier1State = this.state.tier1_mechanical;
      if (!tier1State) {
        return undefined;
      }
      current = tier1State;
    }

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (current[part] === undefined) {
        return undefined;
      }
      if (i < parts.length - 1) {
        if (typeof current[part] !== 'object' || current[part] === null || Array.isArray(current[part])) {
          return undefined;
        }
        current = current[part] as Record<string, unknown>;
      } else {
        return current[part];
      }
    }

    return undefined;
  }

  /**
   * [METHOD] applyDeltas
   * ----------------------------------------------------------------
   * @mutates context.state - Applies multiple numeric deltas to state paths
   * @sourceOfTruth - The internal state object
   * @logic_flow
   * 1. Iterate through all delta paths
   * 2. For each path, call modifyValue to apply the delta
   * 3. Supports both simple paths and deep dot-notation paths
   */
  applyDeltas(deltas: Record<string, number>): void {
    for (const [path, delta] of Object.entries(deltas)) {
      if (typeof delta === 'number') {
        this.modifyValue(path, delta);
      }
    }
  }
}
