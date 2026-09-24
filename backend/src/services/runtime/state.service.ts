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
import {
  DEFAULT_CONDITION_RULES,
  type ConditionRules,
  type ConditionTransition,
} from './condition-rules.js';

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
  /**
   * Entity resource properties the engine may create on first write.
   * Values are the implied baseline the engine already assumes when the
   * property is absent (e.g. damage is computed against a base HP of 100).
   */
  private static readonly PROPERTY_BASELINES: Record<string, number> = {
    hp: 100,
    maxHp: 100,
    max_hp: 100,
    current_stamina: 100,
    stamina: 100,
    satiety: 100,
    saturation: 100,
  };

  /** Relationship axes live on a 0-20 scale with a neutral baseline of 5. */
  private static readonly RELATIONSHIP_BASELINE = 5;
  private static readonly RELATIONSHIP_MIN = 0;
  private static readonly RELATIONSHIP_MAX = 20;

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
   * STRICT SCHEMA ENFORCEMENT for arbitrary paths; entity resources
   * (entities.<id>.properties.<known resource> and
   * entities.<id>.relationships.<axis>) are initialized from their baseline
   * on first write so engine deltas are never silently dropped.
   * @returns The delta that actually landed (after baseline init + clamping),
   *          or null when the write was blocked.
   * @logic_flow
   * 1. Resolve tier root and relative path
   * 2. If the path is an entity resource on an EXISTING entity:
   *    vivify the container, seed the baseline, apply + clamp
   * 3. Otherwise: strict schema validation, path must exist, apply
   */
  modifyValue(path: string, amount: number): number | null {
    const parts = path.split('.');
    // Handle paths that start with tier1_mechanical or tier0_narrative
    let current: Record<string, unknown>;

    // If path starts with tier1_mechanical or tier0_narrative, navigate there first
    if (parts[0] === 'tier1_mechanical' || parts[0] === 'tier0_narrative') {
      const tier = parts[0];
      if (!this.state[tier]) {
        console.error(`[LOGIC_ERROR] [StateService] Tier "${tier}" does not exist in state. Path: ${path}`);
        return null;
      }
      current = this.state[tier]!;
      parts.shift(); // Remove the tier prefix
    } else {
      // Default to tier1_mechanical if no tier specified
      if (!this.state.tier1_mechanical) {
        console.error(`[LOGIC_ERROR] [StateService] tier1_mechanical does not exist in state. Path: ${path}`);
        return null;
      }
      current = this.state.tier1_mechanical;
    }

    // [ENTITY RESOURCE WRITE] entities.<id>.properties.<resource> or
    // entities.<id>.relationships.<axis> on an existing entity: these are
    // engine-computed deltas against implied baselines, so the leaf (and its
    // container) may be created on first write.
    const resourceWrite = this.resolveEntityResourceWrite(current, parts, path);
    if (resourceWrite) {
      const { container, leaf, baseline, min, max } = resourceWrite;
      const before = typeof container[leaf] === 'number' ? (container[leaf] as number) : baseline;
      let after = before + amount;
      if (min !== undefined) after = Math.max(min, after);
      if (max !== undefined) after = Math.min(max, after);
      container[leaf] = after;
      return after - before;
    }

    // STRICT SCHEMA VALIDATION for everything else
    const validation = this.validatePath(path);
    if (!validation.valid) {
      console.error(`[LOGIC_ERROR] [StateService] Schema validation failed: ${validation.reason}`);
      return null;
    }

    // Navigate to path (NO AUTO-VIVIFICATION - path must exist)
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object' || Array.isArray(current[part])) {
        console.error(`[LOGIC_ERROR] [StateService] Path segment "${parts.slice(0, i + 1).join('.')}" does not exist. Path: ${path}`);
        return null;
      }
      current = current[part] as Record<string, unknown>;
    }

    // Get current value (MUST EXIST - no auto-vivification)
    const finalKey = parts[parts.length - 1];
    const currentValue = current[finalKey];

    if (currentValue === undefined || currentValue === null) {
      console.error(`[LOGIC_ERROR] [StateService] Cannot modify missing value at path: ${path}. Value must exist in schema.`);
      return null;
    }

    if (typeof currentValue !== 'number') {
      console.error(`[LOGIC_ERROR] [StateService] Cannot modify non-numeric value at ${path}: ${typeof currentValue}`);
      return null;
    }

    // Apply modification
    const newValue = currentValue + amount;
    current[finalKey] = newValue;
    return amount;
  }

  /**
   * [METHOD] resolveEntityResourceWrite
   * ----------------------------------------------------------------
   * Detects writes to entity-scoped resources and prepares the target
   * container, vivifying it when the ENTITY itself already exists.
   * Returns null when the path is not an eligible entity resource write.
   */
  private resolveEntityResourceWrite(
    tierRoot: Record<string, unknown>,
    parts: string[],
    path: string
  ): { container: Record<string, unknown>; leaf: string; baseline: number; min?: number; max?: number } | null {
    if (parts.length !== 4 || parts[0] !== 'entities') {
      return null;
    }
    const [, entityId, containerKey, leaf] = parts;
    if (containerKey !== 'properties' && containerKey !== 'relationships') {
      return null;
    }

    const entities = tierRoot.entities;
    if (!entities || typeof entities !== 'object' || Array.isArray(entities)) {
      return null;
    }
    const entity = (entities as Record<string, unknown>)[entityId];
    if (!entity || typeof entity !== 'object' || Array.isArray(entity)) {
      // The entity must exist — resources are never attached to phantom entities
      console.error(`[LOGIC_ERROR] [StateService] Entity "${entityId}" does not exist. Path: ${path}`);
      return null;
    }
    const entityRecord = entity as Record<string, unknown>;

    if (containerKey === 'relationships') {
      if (!entityRecord.relationships || typeof entityRecord.relationships !== 'object' || Array.isArray(entityRecord.relationships)) {
        entityRecord.relationships = {};
      }
      return {
        container: entityRecord.relationships as Record<string, unknown>,
        leaf,
        baseline: StateService.RELATIONSHIP_BASELINE,
        min: StateService.RELATIONSHIP_MIN,
        max: StateService.RELATIONSHIP_MAX,
      };
    }

    // properties: only known resources may be created; anything else follows
    // the strict no-vivification rules
    const baseline = StateService.PROPERTY_BASELINES[leaf];
    const existingProps = entityRecord.properties;
    const propsExist = existingProps && typeof existingProps === 'object' && !Array.isArray(existingProps);
    const leafExists = propsExist && typeof (existingProps as Record<string, unknown>)[leaf] === 'number';

    if (baseline === undefined && !leafExists) {
      return null;
    }
    if (!propsExist) {
      entityRecord.properties = {};
    }
    return {
      container: entityRecord.properties as Record<string, unknown>,
      leaf,
      baseline: baseline ?? 0,
      // Vital resources never go negative; no upper clamp (max HP varies per
      // game). Other pre-existing numeric properties keep their full range.
      min: baseline !== undefined ? 0 : undefined,
    };
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
   * @returns Map of path -> delta that ACTUALLY landed in state. Blocked
   *          writes and no-op (fully clamped) deltas are omitted, so callers
   *          can report the truth to the client instead of the intent.
   * @logic_flow
   * 1. Iterate through all delta paths
   * 2. For each path, call modifyValue to apply the delta
   * 3. Collect the applied (possibly clamped) amounts
   */
  applyDeltas(deltas: Record<string, number>): Record<string, number> {
    const applied: Record<string, number> = {};
    for (const [path, delta] of Object.entries(deltas)) {
      if (typeof delta === 'number') {
        const result = this.modifyValue(path, delta);
        if (result !== null && result !== 0) {
          applied[path] = result;
        }
      }
    }
    return applied;
  }

  /**
   * [METHOD] deriveConditionChanges
   * ----------------------------------------------------------------
   * @mutates context.state - Recomputes each entity's combat_condition and
   * physical_condition from its vitals per the ACTIVE RULESET's bands and
   * writes them onto properties.
   *
   * The thresholds and labels come from the rules engine (CompiledStory via
   * resolveConditionRules); this method only evaluates them — no outcome is
   * hardcoded here. The returned transitions are narrative facts for the
   * Narrator (MAS2) and state for the HUD, never player-facing text.
   *
   * Only entities whose vitals exist as numbers are evaluated (untouched
   * Genesis NPCs stay implicit), and a default value is never written onto an
   * entity that had no condition — so the state and the client delta only
   * carry real transitions.
   *
   * @returns The list of condition transitions that occurred this call.
   */
  deriveConditionChanges(rules: ConditionRules = DEFAULT_CONDITION_RULES): ConditionTransition[] {
    const transitions: ConditionTransition[] = [];
    const mech = this.state.tier1_mechanical;
    const entities = mech?.entities;
    if (!entities || typeof entities !== 'object' || Array.isArray(entities)) {
      return transitions;
    }

    const playerId = (mech?.index as Record<string, unknown> | undefined)?.player_id;

    for (const [entityId, entityRaw] of Object.entries(entities as Record<string, unknown>)) {
      if (!entityRaw || typeof entityRaw !== 'object' || Array.isArray(entityRaw)) continue;
      const entity = entityRaw as Record<string, unknown>;
      const props = entity.properties;
      if (!props || typeof props !== 'object' || Array.isArray(props)) continue;
      const properties = props as Record<string, unknown>;

      const isPlayer = entityId === playerId ||
        String(entity.type || '').toLowerCase() === 'player';
      const isHostile = !isPlayer && (
        String(entity.type || '').toLowerCase() === 'enemy' ||
        String(entity.status || '').toLowerCase() === 'hostile'
      );

      // --- Combat condition from HP (first matching band, ascending) ---
      const hp = properties.hp;
      if (typeof hp === 'number') {
        const maxHp = typeof properties.maxHp === 'number' ? properties.maxHp
          : typeof properties.max_hp === 'number' ? properties.max_hp
            : 100;
        const ratio = maxHp > 0 ? hp / maxHp : 0;

        let combat = rules.health_default;
        for (const band of rules.health_bands) {
          if (ratio <= band.max_ratio) {
            combat = isHostile && band.hostile_condition ? band.hostile_condition : band.condition;
            break;
          }
        }

        const previous = properties.combat_condition;
        if (previous !== combat && !(previous === undefined && combat === rules.health_default)) {
          properties.combat_condition = combat;
          transitions.push({
            entity_id: entityId,
            property: 'combat_condition',
            from: typeof previous === 'string' ? previous : undefined,
            to: combat,
          });
        }
      }

      // --- Physical condition from stamina (first matching band, ascending) ---
      const stamina = properties.current_stamina;
      if (typeof stamina === 'number') {
        let physical = rules.stamina_default;
        for (const band of rules.stamina_bands) {
          if (stamina <= band.max_value) {
            physical = band.condition;
            break;
          }
        }

        const previous = properties.physical_condition;
        if (previous !== physical && !(previous === undefined && physical === rules.stamina_default)) {
          properties.physical_condition = physical;
          transitions.push({
            entity_id: entityId,
            property: 'physical_condition',
            from: typeof previous === 'string' ? previous : undefined,
            to: physical,
          });
        }
      }
    }

    return transitions;
  }
}
