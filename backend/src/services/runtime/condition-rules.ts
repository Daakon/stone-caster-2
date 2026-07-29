// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * [MODULE] ConditionRules
 * ----------------------------------------------------------------------
 * ROLE: Rules-engine definition of vitals-driven condition states.
 * RESPONSIBILITY:
 * - Declares the shape of condition rules (health/stamina bands).
 * - Resolves the active rules from the CompiledStory, falling back to
 *   engine defaults when the story doesn't define its own.
 *
 * CONSTRAINTS:
 * - Rules are DATA, not code: the deterministic engine evaluates whatever
 *   bands the story provides. Thresholds/labels are never hardcoded into
 *   the engine services.
 * - Derived conditions are narrative INPUT for the Narrator (MAS2) and
 *   state for the HUD — they are never printed to the player as raw
 *   game-result text.
 */

/** A health band matches when hp/maxHp ratio is <= max_ratio (lowest band wins). */
export interface HealthConditionBand {
  /** Inclusive upper bound on the hp/maxHp ratio for this band (0 = downed). */
  max_ratio: number;
  /** Condition for the player and non-hostile entities. */
  condition: string;
  /** Optional override for hostile entities (e.g. they surrender or die). */
  hostile_condition?: string;
}

/** A stamina band matches when current_stamina is <= max_value (lowest band wins). */
export interface StaminaConditionBand {
  max_value: number;
  condition: string;
}

export interface ConditionRules {
  /** Evaluated ascending by max_ratio; first match wins. */
  health_bands: HealthConditionBand[];
  /** Condition when no health band matches. */
  health_default: string;
  /** Evaluated ascending by max_value; first match wins. */
  stamina_bands: StaminaConditionBand[];
  /** Condition when no stamina band matches. */
  stamina_default: string;
}

/**
 * Engine defaults, used when the story's ruleset doesn't define its own
 * condition rules. Hostile entities yield instead of fighting to the death;
 * the player collapses rather than surrendering.
 */
export const DEFAULT_CONDITION_RULES: ConditionRules = {
  health_bands: [
    { max_ratio: 0, condition: 'Unconscious', hostile_condition: 'Defeated' },
    { max_ratio: 0.25, condition: 'Critical', hostile_condition: 'Surrendered' },
    { max_ratio: 0.5, condition: 'Wounded' },
  ],
  health_default: 'Healthy',
  stamina_bands: [
    { max_value: 0, condition: 'Collapsed' },
    { max_value: 19, condition: 'Exhausted' },
    { max_value: 49, condition: 'Fatigued' },
  ],
  stamina_default: 'Rested',
};

const isValidHealthBand = (band: unknown): band is HealthConditionBand =>
  !!band && typeof band === 'object' &&
  typeof (band as HealthConditionBand).max_ratio === 'number' &&
  typeof (band as HealthConditionBand).condition === 'string';

const isValidStaminaBand = (band: unknown): band is StaminaConditionBand =>
  !!band && typeof band === 'object' &&
  typeof (band as StaminaConditionBand).max_value === 'number' &&
  typeof (band as StaminaConditionBand).condition === 'string';

/**
 * Resolve the active condition rules from a compiled story.
 * Lookup chain mirrors the actionsMap resolution:
 *   config_mechanics.runtime.condition_rules
 *   → config_engine.runtime.condition_rules
 *   → master_schema.condition_rules
 *   → DEFAULT_CONDITION_RULES
 * Health and stamina rule groups are resolved independently, so a story can
 * override one and inherit the other.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveConditionRules(compiledStory?: any): ConditionRules {
  const candidate =
    compiledStory?.config_mechanics?.runtime?.condition_rules ??
    compiledStory?.config_engine?.runtime?.condition_rules ??
    compiledStory?.master_schema?.condition_rules;

  if (!candidate || typeof candidate !== 'object') {
    return DEFAULT_CONDITION_RULES;
  }

  const healthBands = Array.isArray(candidate.health_bands)
    ? candidate.health_bands.filter(isValidHealthBand)
    : null;
  const staminaBands = Array.isArray(candidate.stamina_bands)
    ? candidate.stamina_bands.filter(isValidStaminaBand)
    : null;

  return {
    health_bands: healthBands && healthBands.length > 0
      ? [...healthBands].sort((a, b) => a.max_ratio - b.max_ratio)
      : DEFAULT_CONDITION_RULES.health_bands,
    health_default: typeof candidate.health_default === 'string'
      ? candidate.health_default
      : DEFAULT_CONDITION_RULES.health_default,
    stamina_bands: staminaBands && staminaBands.length > 0
      ? [...staminaBands].sort((a, b) => a.max_value - b.max_value)
      : DEFAULT_CONDITION_RULES.stamina_bands,
    stamina_default: typeof candidate.stamina_default === 'string'
      ? candidate.stamina_default
      : DEFAULT_CONDITION_RULES.stamina_default,
  };
}

/**
 * A single condition transition produced by the deterministic engine.
 * These are narrative facts for MAS2 ("Garret: Healthy → Surrendered"),
 * plus state for the HUD — never player-facing text on their own.
 */
export interface ConditionTransition {
  entity_id: string;
  property: 'combat_condition' | 'physical_condition';
  from?: string;
  to: string;
}
