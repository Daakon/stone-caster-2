/**
 * TurnPacketV3 Types and Schemas
 * Slot-driven wrapper for AWF/V3 prompt builders
 */

import { z } from 'zod';

/**
 * TurnPacketV3 Schema
 */
export const TurnPacketV3Schema = z.object({
  tp_version: z.literal('3'),
  contract: z.literal('awf.v1'),
  core: z.object({
    style: z.string().optional(),
    safety: z.array(z.string()).optional().default([]),
    output_rules: z.string().optional(),
  }),
  ruleset: z.object({
    id: z.string().min(1),
    version: z.string().min(1),
    params: z.record(z.unknown()).optional(),
    slots: z.record(z.string()).optional().default({}),
  }),
  modules: z.array(z.object({
    id: z.string().min(1),
    version: z.string().min(1),
    params: z.record(z.unknown()).nullable(),
    slots: z.record(z.string()).default({}),
    state: z.record(z.unknown()).nullable(),
  })).optional().default([]),
  world: z.object({
    id: z.string().min(1),
    version: z.string().min(1),
    slots: z.record(z.string()).optional().default({}),
  }),
  scenario: z.object({
    id: z.string().min(1),
    version: z.string().min(1),
    slots: z.record(z.string()).optional().default({}),
    reachability: z.object({
      reachableNodes: z.array(z.string()),
    }).optional(),
  }).optional(),
  npcs: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    slots: z.record(z.string()).optional().default({}),
  })).optional().default([]),
  state: z.record(z.unknown()).optional(),
  input: z.object({
    kind: z.string().min(1),
    text: z.string().min(1),
  }),
  meta: z.object({
    budgets: z.object({
      max_ctx_tokens: z.number().int().positive().optional(),
    }).optional(),
    seed: z.string().optional(),
    buildId: z.string().optional(),
  }).optional(),
}).strict();

export type TurnPacketV3 = z.infer<typeof TurnPacketV3Schema>;

/**
 * AwfV1 Schema (AWF v1 output format)
 */
export const AwfV1Schema = z.object({
  scn: z.object({
    id: z.string().min(1),
    ph: z.string().min(1),
  }),
  txt: z.string().min(1),
  choices: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
  })).optional().default([]),
  acts: z.array(z.record(z.unknown())).optional().default([]),
  val: z.object({
    ok: z.boolean(),
    errors: z.array(z.unknown()).optional().default([]),
    repairs: z.array(z.unknown()).optional().default([]),
  }),
}).strict();

export type AwfV1 = z.infer<typeof AwfV1Schema>;

