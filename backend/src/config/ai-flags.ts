// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Central switch for the dev-time mock AI mode.
 *
 * ENABLE_MOCK_AI=true routes every AI stage (Director, Narrator, Genesis)
 * to deterministic mock output so the full turn pipeline can be exercised
 * without LLM costs. Read at call time (a function, not a module constant)
 * so the flag can be flipped per-process without stale captures.
 */
let warnedDeprecatedFlag = false;

export function isMockAiEnabled(): boolean {
  if (process.env.ENABLE_MOCK_AI === 'true') {
    return true;
  }
  if (process.env.USE_MOCK_LLM === 'true') {
    if (!warnedDeprecatedFlag) {
      console.warn('[ai-flags] USE_MOCK_LLM is deprecated; use ENABLE_MOCK_AI instead.');
      warnedDeprecatedFlag = true;
    }
    return true;
  }
  return false;
}

/**
 * The `test_*` scenario bypass (docs/07 §4): scripted inputs stay deterministic
 * even when real AI is enabled, so scenario checks never burn tokens.
 */
export function isTestScenarioInput(input: string | undefined | null): boolean {
  return !!input && input.toLowerCase().trim().startsWith('test_');
}
