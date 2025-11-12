/**
 * Guard DSL Types
 * Minimal, composable guard language for scenario graph edges
 */

/**
 * Guard operators
 */
export type GuardOperator =
  | 'all'
  | 'any'
  | 'not'
  | 'eq'
  | 'neq'
  | 'gte'
  | 'gt'
  | 'lte'
  | 'lt'
  | 'in'
  | 'includes'
  | 'flag';

/**
 * Guard value (literal or path)
 */
export type GuardValue = string | number | boolean | GuardPath | GuardValue[];

/**
 * Guard path (LHS for operators)
 * Format: <prefix>.<...segments>
 */
export type GuardPath =
  | `rel.${string}.${'warmth' | 'trust' | 'respect' | 'desire' | 'awe'}`
  | `inv.player.${string}.qty`
  | `currency.player.coin`
  | `flag.${'story' | 'player' | 'world'}.${string}`
  | `state.story.timeTicks`;

/**
 * Guard expression
 */
export type Guard =
  | { all: Guard[] }
  | { any: Guard[] }
  | { not: Guard }
  | { eq: [GuardPath | GuardValue, GuardValue] }
  | { neq: [GuardPath | GuardValue, GuardValue] }
  | { gte: [GuardPath | GuardValue, GuardValue] }
  | { gt: [GuardPath | GuardValue, GuardValue] }
  | { lte: [GuardPath | GuardValue, GuardValue] }
  | { lt: [GuardPath | GuardValue, GuardValue] }
  | { in: [GuardPath | GuardValue, GuardValue[]] }
  | { includes: [GuardPath | GuardValue, GuardValue] }
  | { flag: [string, string, boolean] }; // [scope, key, value]

/**
 * Scenario Graph Node
 */
export interface ScenarioNode {
  id: string;
  label: string;
  kind: 'scene' | 'choice' | 'event' | 'end';
  metadata?: Record<string, unknown>;
}

/**
 * Scenario Graph Edge
 */
export interface ScenarioEdge {
  from: string;
  to: string;
  guard?: Guard;
  label?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Scenario Graph
 */
export interface ScenarioGraph {
  nodes: ScenarioNode[];
  edges: ScenarioEdge[];
  entry_node?: string;
}

