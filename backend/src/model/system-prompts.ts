/**
 * System Prompts for AWF Model
 * Phase 5: Turn Pipeline Integration - Minimal system prompt constants
 */

/**
 * Minimal system prompt for AWF runtime
 * This prompt instructs the model to return exactly one JSON object named "AWF"
 * with the required keys and follows the contract rules.
 */
export const SYSTEM_AWF_RUNTIME = 
  "You will be given one JSON object `awf_bundle`. Return exactly one JSON object named `AWF` with keys `scn`, `txt`, and optional `choices`, `acts`, `val`. No markdown, no code fences, no extra keys. Follow `awf_bundle.contract` and `awf_bundle.core.ruleset`.";

/**
 * System prompt for AWF runtime with tool support
 * Includes tool policy and usage guidelines
 */
export const SYSTEM_AWF_RUNTIME_WITH_TOOLS = 
  "You will be given one JSON object `awf_bundle`. Return exactly one JSON object named `AWF` with keys `scn`, `txt`, and optional `choices`, `acts`, `val`. No markdown, no code fences, no extra keys. Follow `awf_bundle.contract` and `awf_bundle.core.ruleset`.\n\n" +
  "You may use the GetLoreSlice tool to retrieve specific lore slices when needed. Tool policy: At most 2 GetLoreSlice calls per turn; request smallest slices first; avoid duplicates; do not echo retrieved text verbatim into txt; integrate naturally.";

/**
 * Create locale-aware system prompt for AWF runtime
 * @param locale - Target locale (e.g., 'en-US', 'fr-FR', 'es-ES')
 * @param includeTools - Whether to include tool support
 * @returns Localized system prompt
 */
export function createLocaleAwareSystemPrompt(locale: string, includeTools: boolean = false): string {
  const basePrompt = includeTools ? SYSTEM_AWF_RUNTIME_WITH_TOOLS : SYSTEM_AWF_RUNTIME;
  
  if (locale === 'en-US') {
    return basePrompt;
  }
  
  const localeInstruction = `Write all natural language in ${locale}. Do not mix languages. Use second-person.`;
  
  return `${basePrompt}\n\n${localeInstruction}`;
}

/**
 * System prompt with repair hint injection
 * This is used when the model output is invalid and needs repair guidance
 */
export function createSystemPromptWithRepairHint(repairHint: string): string {
  return `${SYSTEM_AWF_RUNTIME}\n\nRepair hint: ${repairHint}`;
}

/**
 * Default repair hint for common validation failures
 */
export const DEFAULT_REPAIR_HINT = 
  "Output must include exactly one top-level object named AWF; include scn and txt; choices <= 5; acts <= 8; do not include extra keys.";
