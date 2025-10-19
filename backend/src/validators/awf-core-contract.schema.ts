/**
 * AWF Core Contract Schema V2
 * Framework/invariants only - narrative/pacing moved to rulesets
 */

import { z } from "zod";

const Act = z.object({
  type: z.string().min(1),
  mode: z.string().min(1),
  target: z.string().min(1)
});

export const CoreContractV2Schema = z.object({
  contract: z.object({
    name: z.string().min(1),
    awf_return: z.string().min(1),
    keys: z.object({
      required: z.array(z.string().min(1)).min(1),
      optional: z.array(z.string().min(1)).optional().default([])
    }),
    language: z.object({
      one_language_only: z.boolean().optional()
    }).optional(),
    acts: z.object({ policy: z.string().optional() }).optional(),
    time: z.object({
      first_turn_time_advance_allowed: z.boolean(),
      require_time_advance_on_nonfirst_turn: z.boolean(),
      ticks_min_step: z.number().int().positive()
    }).optional(),
    menus: z.object({
      min: z.number().int().nonnegative(),
      max: z.number().int().positive(),
      label_max_chars: z.number().int().positive()
    }).optional(),
    validation: z.object({ policy: z.string().optional() }).optional()
  }).strict(),

  core: z.object({
    acts_catalog: z.array(Act).min(1),   // <<— non-empty array
    scales: z.object({
      skill: z.object({ min: z.number(), baseline: z.number(), max: z.number() }),
      relationship: z.object({ min: z.number(), baseline: z.number(), max: z.number() })
    }),
    budgets: z.object({
      input_max_tokens: z.number().int().positive().optional(),
      output_max_tokens: z.number().int().positive().optional()
    }).optional()
  }).strict()
}).strict();

// Type export
export type CoreContractV2 = z.infer<typeof CoreContractV2Schema>;