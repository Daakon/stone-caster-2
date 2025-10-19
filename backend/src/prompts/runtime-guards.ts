/**
 * Runtime guardrails to prevent file-based prompt usage in DB-only mode
 */

// Configuration flag for prompt source strategy
export const PROMPT_SOURCE_STRATEGY = process.env.PROMPT_SOURCE_STRATEGY || 'database';

/**
 * Assert that the system is running in database-only mode
 */
export function assertDatabaseOnlyMode(): void {
  if (PROMPT_SOURCE_STRATEGY !== 'database') {
    throw new Error(
      `PROMPT_SOURCE_STRATEGY must be 'database'. Current value: ${PROMPT_SOURCE_STRATEGY}. ` +
      'DB-only mode is mandatory. Update your environment configuration.'
    );
  }
}

/**
 * Guard against file-based prompt loader imports
 */
export function guardAgainstFileBasedLoaders(): void {
  // This function should be called at module initialization
  // to prevent any file-based prompt loaders from being imported
  assertDatabaseOnlyMode();
}

/**
 * Guard against filesystem prompt path references
 */
export function guardAgainstFileSystemPaths(path: string): void {
  const forbiddenPatterns = [
    /AI API Prompts/i,
    /\.prompt\.json$/i,
    /adventure\.start\.prompt\.json$/i,
    /adventure\.prompt\.json$/i,
    /index\.prompt\.json$/i,
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(path)) {
      throw new Error(
        `DB-only mode: File system prompt path detected: ${path}. ` +
        'Remove file-based loader. Use DatabasePromptAssembler instead.'
      );
    }
  }
}

/**
 * Guard against legacy prompt assembler usage
 */
export function guardAgainstLegacyAssemblers(): void {
  // This should be called in any legacy prompt assembler constructors
  throw new Error(
    'DB-only mode: Legacy prompt assemblers are disabled. ' +
    'Use DatabasePromptAssembler instead.'
  );
}

/**
 * Initialize runtime guards at startup
 */
export function initializeRuntimeGuards(): void {
  console.log(`[RUNTIME_GUARDS] Initializing DB-only mode with strategy: ${PROMPT_SOURCE_STRATEGY}`);
  
  // Assert database-only mode
  assertDatabaseOnlyMode();
  
  // Log configuration
  console.log('[RUNTIME_GUARDS] File-based prompt loading is disabled');
  console.log('[RUNTIME_GUARDS] All prompts must come from database');
  
  // Note: Filesystem guards are handled at the code level through
  // guardAgainstFileSystemPaths() calls in critical paths
}
