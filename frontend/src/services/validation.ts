/**
 * Validation Service
 * Server-side validation for segment scopes and other constraints
 */

export const ALLOWED_SEGMENT_SCOPES = new Set([
  'core',
  'ruleset', 
  'world',
  'entry',
  'entry_start',
  'npc'
]);

export const DEPRECATED_SCOPES = new Set([
  'game_state',
  'player',
  'rng',
  'input'
]);

/**
 * Assert that a scope is allowed
 * @param scope - The scope to validate
 * @throws Error with code 'SEGMENT_SCOPE_INVALID' if scope is not allowed
 */
export function assertAllowedScope(scope: string): void {
  if (!ALLOWED_SEGMENT_SCOPES.has(scope)) {
    const allowedScopes = Array.from(ALLOWED_SEGMENT_SCOPES).join(', ');
    const msg = `Scope '${scope}' is deprecated. Allowed scopes: ${allowedScopes}.`;
    const error: any = new Error(msg);
    error.code = 'SEGMENT_SCOPE_INVALID';
    throw error;
  }
}

/**
 * Check if a scope is deprecated
 * @param scope - The scope to check
 * @returns true if the scope is deprecated
 */
export function isDeprecatedScope(scope: string): boolean {
  return DEPRECATED_SCOPES.has(scope);
}

/**
 * Get contextual help text for scope reference fields
 * @param scope - The scope to get help for
 * @returns Help text for the scope
 */
export function getScopeReferenceHelp(scope: string): string {
  switch (scope) {
    case 'core':
      return 'Core segments apply globally and do not require a reference.';
    case 'ruleset':
      return 'Pick a Ruleset to associate this segment with.';
    case 'world':
      return 'Pick a World to associate this segment with.';
    case 'entry':
      return 'Pick an Entry to associate this segment with.';
    case 'entry_start':
      return 'Pick an Entry for the starting segment (first turn only).';
    case 'npc':
      return 'Pick an NPC to associate this segment with.';
    default:
      return 'Select a reference target for this scope.';
  }
}

/**
 * Assert that a scope has the correct reference ID
 * @param scope - The scope to validate
 * @param refId - The reference ID to validate
 * @throws Error with code 'SEGMENT_REF_REQUIRED' if ref_id is missing
 */
export function assertScopeRef(scope: string, refId?: string): void {
  // ref_id required for: ruleset, world, entry, entry_start, npc
  const needsRef = scope !== 'core';
  if (!needsRef) return;

  if (!refId) {
    const error: any = new Error(`Scope '${scope}' requires a reference id.`);
    error.code = 'SEGMENT_REF_REQUIRED';
    throw error;
  }
}

/**
 * Get the expected reference table for a scope
 * @param scope - The scope to check
 * @returns The table name that should contain the reference ID
 */
export function expectedRefTable(scope: string): 'worlds' | 'rulesets' | 'entries' | 'npcs' | null {
  switch (scope) {
    case 'world': return 'worlds';
    case 'ruleset': return 'rulesets';
    case 'entry':
    case 'entry_start': return 'entries';
    case 'npc': return 'npcs';
    case 'core': return null;
    default: return null;
  }
}

/**
 * Validate segment creation data
 * @param data - The segment data to validate
 * @throws Error if validation fails
 */
export function validateSegmentData(data: {
  scope: string;
  ref_id?: string;
  content: string;
}): void {
  // Validate scope
  assertAllowedScope(data.scope);
  
  // Validate ref_id requirement
  assertScopeRef(data.scope, data.ref_id);
  
  // Validate content
  if (!data.content || data.content.trim().length === 0) {
    throw new Error('Content is required');
  }
  
  if (data.content.length > 10000) {
    throw new Error('Content must be less than 10,000 characters');
  }
  
  // Validate ref_id based on scope
  if (data.scope !== 'core' && (!data.ref_id || data.ref_id.trim().length === 0)) {
    throw new Error(`Reference ID is required for scope '${data.scope}'`);
  }
  
  if (data.scope === 'core' && data.ref_id) {
    throw new Error('Core segments should not have a reference ID');
  }
}
