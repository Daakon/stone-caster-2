/**
 * AWF Ruleset Resolver - Games-Only State
 * Phase 1: Resolves ruleset_ref and locale from games.state_snapshot.meta with optional session overrides
 */

export interface GameState {
  state_snapshot?: {
    meta?: {
      ruleset_ref?: string;
      locale?: string;
    };
  };
}

export interface SessionState {
  ruleset_ref?: string;
  locale?: string;
}

export interface ResolverInput {
  game?: GameState;
  session?: SessionState | null;
}

export interface ResolverOutput {
  ruleset_ref: string;
  locale: string;
}

/**
 * Resolves ruleset_ref and locale from games.state_snapshot.meta with optional session overrides
 * Priority: session override > game meta > defaults
 */
export function resolveRulesetRef(input: ResolverInput): ResolverOutput {
  const { game, session } = input;
  
  // Resolve ruleset_ref with priority: session > game meta > default
  const ruleset_ref = 
    session?.ruleset_ref ??
    game?.state_snapshot?.meta?.ruleset_ref ??
    "ruleset.core.default@1.0.0";
  
  // Resolve locale with priority: session > game meta > default
  const locale = 
    session?.locale ??
    game?.state_snapshot?.meta?.locale ??
    "en-US";
  
  return { ruleset_ref, locale };
}

/**
 * Parses a ruleset reference into id and version components
 * @param rulesetRef - Ruleset reference like "ruleset.core.default@1.0.0"
 * @returns Object with id and version, or defaults if parsing fails
 */
export function parseRulesetRef(rulesetRef: string): { id: string; version: string } {
  const parts = rulesetRef.split('@');
  if (parts.length === 2) {
    return { id: parts[0], version: parts[1] };
  }
  
  // Fallback to default if parsing fails
  return { id: "ruleset.core.default", version: "1.0.0" };
}

/**
 * Validates that a ruleset reference is properly formatted
 * @param rulesetRef - Ruleset reference to validate
 * @returns true if valid, false otherwise
 */
export function isValidRulesetRef(rulesetRef: string): boolean {
  return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+$/.test(rulesetRef);
}













