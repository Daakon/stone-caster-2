/**
 * Chimera Ruleset Definition Types
 * Single source of truth for ruleset definition (jsonb) structure
 */

/**
 * RulesetDefinitionV1
 * The standard structure for the definition column in chimera_ruleset_templates
 * This interface ensures type-safe parsing of JSON definitions across the application
 */
export interface RulesetDefinitionV1 {
  /**
   * UI Schema
   * Defines the structure and presentation of UI elements for this ruleset
   */
  ui_schema: Record<string, unknown>;

  /**
   * Action Prompt Rules
   * Rules governing how action prompts are constructed and processed
   */
  action_prompt_rules: Record<string, unknown>;

  /**
   * Narrative Prompt Rules
   * Rules governing how narrative prompts are constructed and processed
   */
  narrative_prompt_rules: Record<string, unknown>;
}

/**
 * Type guard to check if an object conforms to RulesetDefinitionV1
 */
export function isRulesetDefinitionV1(value: unknown): value is RulesetDefinitionV1 {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    'ui_schema' in obj &&
    'action_prompt_rules' in obj &&
    'narrative_prompt_rules' in obj &&
    typeof obj.ui_schema === 'object' &&
    typeof obj.action_prompt_rules === 'object' &&
    typeof obj.narrative_prompt_rules === 'object'
  );
}

