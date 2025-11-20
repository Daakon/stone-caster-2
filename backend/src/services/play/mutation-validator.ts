/**
 * Mutation Validator Service (Security 1: The Narrative Guard)
 * Phase 4: The Play Engine
 * 
 * This service prevents the AI from breaking the game by only allowing
 * Tier 0 (narrative) mutations. It rejects all Tier 1 and Tier 2 mutations.
 */

import type { MutationDto } from './action-resolver.js';

/**
 * Validate mutations from MAS 2
 * Only allows mutations to tier0_tracked_state
 * 
 * @param mutations - The mutations from MAS 2
 * @returns Array of allowed mutations (Tier 0 only)
 */
export function validateMutations(mutations: MutationDto[]): MutationDto[] {
  const allowed: MutationDto[] = [];

  for (const mutation of mutations) {
    // Check if path starts with /tier0_tracked_state
    if (mutation.path.startsWith('/tier0_tracked_state')) {
      allowed.push(mutation);
    } else {
      // Reject non-tier0 mutations
      console.warn(
        `[MutationValidator] Rejected mutation to ${mutation.path}. Only tier0_tracked_state mutations are allowed.`
      );
    }
  }

  return allowed;
}

