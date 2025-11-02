/**
 * Phase 2: Types for strict-ordering prompt assembler with budget policy
 */

export type Scope = 'core' | 'ruleset' | 'world' | 'scenario' | 'entry' | 'npc';

export interface AssembleInput {
  worldId: string;
  rulesetSlug?: string;
  scenarioSlug?: string | null;
  entryStartSlug: string;
  npcHints?: string[];
  model?: string;
  budgetTokens?: number;
}

export interface AssemblePiece {
  scope: Scope;
  slug: string;
  version?: string;
  tokens: number;
}

export interface AssembleOutput {
  prompt: string;
  pieces: AssemblePiece[];
  meta: {
    included: string[]; // Format: "scope:slug@version"
    dropped: string[]; // Same format for removed pieces
    policy?: string[]; // Warnings/actions: "SCENARIO_POLICY_UNDECIDED", "SCENARIO_DROPPED", "NPC_DROPPED", etc.
    model: string;
    worldId: string;
    rulesetSlug: string;
    scenarioSlug?: string | null;
    entryStartSlug: string;
    tokenEst: {
      input: number;
      budget: number;
      pct: number; // Percentage of budget used (0-1)
    };
  };
}

/**
 * Policy action constants
 */
export const POLICY_ACTIONS = {
  SCENARIO_POLICY_UNDECIDED: 'SCENARIO_POLICY_UNDECIDED',
  SCENARIO_DROPPED: 'SCENARIO_DROPPED',
  NPC_DROPPED: 'NPC_DROPPED',
} as const;

export type PolicyAction = typeof POLICY_ACTIONS[keyof typeof POLICY_ACTIONS];

/**
 * Scope priority order (lower number = higher priority)
 */
export const SCOPE_PRIORITY: Record<Scope, number> = {
  core: 0,
  ruleset: 1,
  world: 2,
  scenario: 3,
  entry: 4,
  npc: 5,
};

/**
 * Scopes that can never be dropped
 */
export const PROTECTED_SCOPES: Set<Scope> = new Set(['core', 'ruleset', 'world']);

