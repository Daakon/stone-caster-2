/**
 * Guard Evaluator Tests
 * Test guard expression evaluation
 */

import { describe, it, expect } from 'vitest';
import { evalGuard, resolvePath, type GuardContext } from '../src/services/guard-eval.js';
import type { Guard } from '../src/types/guard-dsl.js';

describe('Guard Evaluator', () => {
  const ctx: GuardContext = {
    rel: {
      kiera: { trust: 8, warmth: 5 },
      alice: { trust: 3 },
    },
    inv: {
      player: {
        sword: { qty: 1 },
        potion: { qty: 0 },
      },
    },
    currency: {
      player: {
        coin: 100,
      },
    },
    flag: {
      story: {
        heard_crystal_rumor: true,
        met_guardian: false,
      },
      player: {
        has_quest: true,
      },
    },
    state: {
      story: {
        timeTicks: 42,
      },
    },
  };

  it('should resolve relationship paths', () => {
    expect(resolvePath('rel.kiera.trust', ctx)).toBe(8);
    expect(resolvePath('rel.kiera.warmth', ctx)).toBe(5);
    expect(resolvePath('rel.alice.trust', ctx)).toBe(3);
    expect(resolvePath('rel.unknown.trust', ctx)).toBe(0);
  });

  it('should resolve inventory paths', () => {
    expect(resolvePath('inv.player.sword.qty', ctx)).toBe(1);
    expect(resolvePath('inv.player.potion.qty', ctx)).toBe(0);
  });

  it('should resolve currency paths', () => {
    expect(resolvePath('currency.player.coin', ctx)).toBe(100);
  });

  it('should resolve flag paths', () => {
    expect(resolvePath('flag.story.heard_crystal_rumor', ctx)).toBe(true);
    expect(resolvePath('flag.story.met_guardian', ctx)).toBe(false);
    expect(resolvePath('flag.player.has_quest', ctx)).toBe(true);
  });

  it('should resolve state paths', () => {
    expect(resolvePath('state.story.timeTicks', ctx)).toBe(42);
  });

  it('should evaluate eq operator', () => {
    const guard: Guard = { eq: ['rel.kiera.trust', 8] };
    expect(evalGuard(guard, ctx)).toBe(true);

    const guard2: Guard = { eq: ['rel.kiera.trust', 7] };
    expect(evalGuard(guard2, ctx)).toBe(false);
  });

  it('should evaluate gte operator', () => {
    const guard: Guard = { gte: ['rel.kiera.trust', 8] };
    expect(evalGuard(guard, ctx)).toBe(true);

    const guard2: Guard = { gte: ['rel.kiera.trust', 9] };
    expect(evalGuard(guard2, ctx)).toBe(false);
  });

  it('should evaluate flag operator', () => {
    const guard: Guard = { flag: ['story', 'heard_crystal_rumor', true] };
    expect(evalGuard(guard, ctx)).toBe(true);

    const guard2: Guard = { flag: ['story', 'met_guardian', true] };
    expect(evalGuard(guard2, ctx)).toBe(false);
  });

  it('should evaluate all operator', () => {
    const guard: Guard = {
      all: [
        { gte: ['rel.kiera.trust', 8] },
        { flag: ['story', 'heard_crystal_rumor', true] },
      ],
    };
    expect(evalGuard(guard, ctx)).toBe(true);

    const guard2: Guard = {
      all: [
        { gte: ['rel.kiera.trust', 8] },
        { flag: ['story', 'met_guardian', true] },
      ],
    };
    expect(evalGuard(guard2, ctx)).toBe(false);
  });

  it('should evaluate any operator', () => {
    const guard: Guard = {
      any: [
        { gte: ['rel.kiera.trust', 10] },
        { flag: ['story', 'heard_crystal_rumor', true] },
      ],
    };
    expect(evalGuard(guard, ctx)).toBe(true);

    const guard2: Guard = {
      any: [
        { gte: ['rel.kiera.trust', 10] },
        { flag: ['story', 'met_guardian', true] },
      ],
    };
    expect(evalGuard(guard2, ctx)).toBe(false);
  });

  it('should evaluate not operator', () => {
    const guard: Guard = { not: { flag: ['story', 'met_guardian', true] } };
    expect(evalGuard(guard, ctx)).toBe(true);

    const guard2: Guard = { not: { flag: ['story', 'heard_crystal_rumor', true] } };
    expect(evalGuard(guard2, ctx)).toBe(false);
  });

  it('should evaluate in operator', () => {
    const guard: Guard = { in: ['rel.kiera.trust', [7, 8, 9]] };
    expect(evalGuard(guard, ctx)).toBe(true);

    const guard2: Guard = { in: ['rel.kiera.trust', [1, 2, 3]] };
    expect(evalGuard(guard2, ctx)).toBe(false);
  });

  it('should respect max nesting depth', () => {
    const guard: Guard = {
      all: [
        {
          all: [
            {
              all: [
                {
                  all: [
                    { eq: ['rel.kiera.trust', 8] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    // Should return false due to depth limit
    expect(evalGuard(guard, ctx)).toBe(false);
  });
});

