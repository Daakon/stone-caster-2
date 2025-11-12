/**
 * Guard Evaluator
 * Evaluates guard expressions against a state context
 */

import type { Guard, GuardPath } from '../types/guard-dsl.js';

/**
 * State context for guard evaluation
 */
export interface GuardContext {
  rel?: Record<string, Record<string, number>>; // rel.<npcId>.<stat>
  inv?: {
    player?: Record<string, { qty: number }>;
  };
  currency?: {
    player?: {
      coin?: number;
    };
  };
  flag?: {
    story?: Record<string, boolean>;
    player?: Record<string, boolean>;
    world?: Record<string, boolean>;
  };
  state?: {
    story?: {
      timeTicks?: number;
    };
  };
}

/**
 * Resolve a path to a value from context
 */
export function resolvePath(path: string, ctx: GuardContext): unknown {
  const parts = path.split('.');

  if (parts[0] === 'rel' && parts.length === 3) {
    const npcId = parts[1];
    const stat = parts[2];
    return ctx.rel?.[npcId]?.[stat] ?? 0;
  }

  if (parts[0] === 'inv' && parts.length === 4 && parts[1] === 'player') {
    const itemId = parts[2];
    return ctx.inv?.player?.[itemId]?.qty ?? 0;
  }

  if (path === 'currency.player.coin') {
    return ctx.currency?.player?.coin ?? 0;
  }

  if (parts[0] === 'flag' && parts.length === 3) {
    const scope = parts[1] as 'story' | 'player' | 'world';
    const key = parts[2];
    return ctx.flag?.[scope]?.[key] ?? false;
  }

  if (path === 'state.story.timeTicks') {
    return ctx.state?.story?.timeTicks ?? 0;
  }

  return undefined;
}

/**
 * Evaluate a guard expression
 */
export function evalGuard(guard: Guard, ctx: GuardContext): boolean {
  // Safety: cap nesting depth
  return evalGuardRecursive(guard, ctx, 0, 4);
}

function evalGuardRecursive(
  guard: Guard,
  ctx: GuardContext,
  depth: number,
  maxDepth: number
): boolean {
  if (depth > maxDepth) {
    console.warn('[guard-eval] Max nesting depth exceeded');
    return false;
  }

  if ('all' in guard) {
    return guard.all.every((g) => evalGuardRecursive(g, ctx, depth + 1, maxDepth));
  }

  if ('any' in guard) {
    return guard.any.some((g) => evalGuardRecursive(g, ctx, depth + 1, maxDepth));
  }

  if ('not' in guard) {
    return !evalGuardRecursive(guard.not, ctx, depth + 1, maxDepth);
  }

  if ('eq' in guard) {
    const [lhs, rhs] = guard.eq;
    const lhsVal = typeof lhs === 'string' && lhs.includes('.') ? resolvePath(lhs, ctx) : lhs;
    const rhsVal = typeof rhs === 'string' && rhs.includes('.') ? resolvePath(rhs, ctx) : rhs;
    return lhsVal === rhsVal;
  }

  if ('neq' in guard) {
    const [lhs, rhs] = guard.neq;
    const lhsVal = typeof lhs === 'string' && lhs.includes('.') ? resolvePath(lhs, ctx) : lhs;
    const rhsVal = typeof rhs === 'string' && rhs.includes('.') ? resolvePath(rhs, ctx) : rhs;
    return lhsVal !== rhsVal;
  }

  if ('gte' in guard) {
    const [lhs, rhs] = guard.gte;
    const lhsVal = typeof lhs === 'string' && lhs.includes('.') ? resolvePath(lhs, ctx) : lhs;
    const rhsVal = typeof rhs === 'string' && rhs.includes('.') ? resolvePath(rhs, ctx) : rhs;
    return Number(lhsVal) >= Number(rhsVal);
  }

  if ('gt' in guard) {
    const [lhs, rhs] = guard.gt;
    const lhsVal = typeof lhs === 'string' && lhs.includes('.') ? resolvePath(lhs, ctx) : lhs;
    const rhsVal = typeof rhs === 'string' && rhs.includes('.') ? resolvePath(rhs, ctx) : rhs;
    return Number(lhsVal) > Number(rhsVal);
  }

  if ('lte' in guard) {
    const [lhs, rhs] = guard.lte;
    const lhsVal = typeof lhs === 'string' && lhs.includes('.') ? resolvePath(lhs, ctx) : lhs;
    const rhsVal = typeof rhs === 'string' && rhs.includes('.') ? resolvePath(rhs, ctx) : rhs;
    return Number(lhsVal) <= Number(rhsVal);
  }

  if ('lt' in guard) {
    const [lhs, rhs] = guard.lt;
    const lhsVal = typeof lhs === 'string' && lhs.includes('.') ? resolvePath(lhs, ctx) : lhs;
    const rhsVal = typeof rhs === 'string' && rhs.includes('.') ? resolvePath(rhs, ctx) : rhs;
    return Number(lhsVal) < Number(rhsVal);
  }

  if ('in' in guard) {
    const [lhs, rhs] = guard.in;
    const lhsVal = typeof lhs === 'string' && lhs.includes('.') ? resolvePath(lhs, ctx) : lhs;
    return Array.isArray(rhs) && rhs.includes(lhsVal);
  }

  if ('includes' in guard) {
    const [lhs, rhs] = guard.includes;
    const lhsVal = typeof lhs === 'string' && lhs.includes('.') ? resolvePath(lhs, ctx) : lhs;
    const rhsVal = typeof rhs === 'string' && rhs.includes('.') ? resolvePath(rhs, ctx) : rhs;
    return Array.isArray(lhsVal) && lhsVal.includes(rhsVal);
  }

  if ('flag' in guard) {
    const [scope, key, value] = guard.flag;
    const flagVal = ctx.flag?.[scope as 'story' | 'player' | 'world']?.[key] ?? false;
    return flagVal === value;
  }

  return false;
}

