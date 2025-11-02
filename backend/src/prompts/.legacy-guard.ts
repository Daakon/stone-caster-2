/**
 * Legacy Guard - Prevents reintroduction of legacy prompt code
 * 
 * This file serves as a guardrail. If any of these patterns are detected
 * in non-test code, the build should fail.
 * 
 * Run this check in CI or as a pre-commit hook.
 */

/**
 * Patterns that should NOT appear in non-test code:
 * - prompt_segments_for_context (legacy SQL function)
 * - prompting.prompts (legacy table)
 * - DatabasePromptAssembler (v2 legacy assembler)
 * - PromptRepository (legacy repository)
 * - createInitialPromptWithApproval (legacy approval flow)
 * - /api/games/:id/initial-prompt (legacy route)
 * - /api/games/:id/approve-prompt (legacy route)
 */

// This file exists to document the guardrails.
// Actual enforcement should be via lint rules or grep checks in CI.

export const LEGACY_PATTERNS = [
  'prompt_segments_for_context',
  'prompting.prompts',
  'DatabasePromptAssembler',
  'PromptRepository',
  'createInitialPromptWithApproval',
  '/api/games/:id/initial-prompt',
  '/api/games/:id/approve-prompt',
] as const;

