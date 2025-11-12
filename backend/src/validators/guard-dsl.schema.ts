/**
 * Guard DSL JSON Schema
 * Validates guard expressions using Zod
 */

import { z } from 'zod';

// Guard path pattern
const guardPathPattern = z.union([
  z.string().regex(/^rel\.[^.]+\.(warmth|trust|respect|desire|awe)$/),
  z.string().regex(/^inv\.player\.[^.]+\.qty$/),
  z.literal('currency.player.coin'),
  z.string().regex(/^flag\.(story|player|world)\.[^.]+$/),
  z.literal('state.story.timeTicks'),
]);

// Guard value (literal or path)
const guardValue: z.ZodType<any> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  guardPathPattern,
  z.array(z.any()),
]);

// Guard expression (recursive)
const guardSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.object({
      all: z.array(guardSchema),
    }),
    z.object({
      any: z.array(guardSchema),
    }),
    z.object({
      not: guardSchema,
    }),
    z.object({
      eq: z.tuple([z.union([guardPathPattern, guardValue]), guardValue]),
    }),
    z.object({
      neq: z.tuple([z.union([guardPathPattern, guardValue]), guardValue]),
    }),
    z.object({
      gte: z.tuple([z.union([guardPathPattern, guardValue]), guardValue]),
    }),
    z.object({
      gt: z.tuple([z.union([guardPathPattern, guardValue]), guardValue]),
    }),
    z.object({
      lte: z.tuple([z.union([guardPathPattern, guardValue]), guardValue]),
    }),
    z.object({
      lt: z.tuple([z.union([guardPathPattern, guardValue]), guardValue]),
    }),
    z.object({
      in: z.tuple([z.union([guardPathPattern, guardValue]), z.array(guardValue)]),
    }),
    z.object({
      includes: z.tuple([z.union([guardPathPattern, guardValue]), guardValue]),
    }),
    z.object({
      flag: z.tuple([z.string(), z.string(), z.boolean()]),
    }),
  ])
);

// Scenario node schema
export const ScenarioNodeSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  kind: z.enum(['scene', 'choice', 'event', 'end']),
  metadata: z.record(z.any()).optional(),
});

// Scenario edge schema
export const ScenarioEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  guard: guardSchema.optional(),
  label: z.string().max(200).optional(),
  metadata: z.record(z.any()).optional(),
});

// Scenario graph schema
export const ScenarioGraphSchema = z.object({
  nodes: z.array(ScenarioNodeSchema),
  edges: z.array(ScenarioEdgeSchema),
  entry_node: z.string().optional(),
});

// Guard schema export
export const GuardSchema = guardSchema;

// Validation helpers
export function validateGuard(guard: unknown): { ok: boolean; error?: z.ZodError } {
  const result = GuardSchema.safeParse(guard);
  if (result.success) {
    return { ok: true };
  }
  return { ok: false, error: result.error };
}

export function validateScenarioGraph(graph: unknown): { ok: boolean; error?: z.ZodError } {
  const result = ScenarioGraphSchema.safeParse(graph);
  if (result.success) {
    return { ok: true };
  }
  return { ok: false, error: result.error };
}

