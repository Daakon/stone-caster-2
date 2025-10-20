/**
 * AWF Injection Map Schema Validation
 * Zod schemas for injection map rules and documents
 */

import { z } from "zod";

export const InjectionRuleV1Schema = z.object({
  from: z.string().min(1),
  to: z.string().regex(/^\/.*$/, "to must be an absolute JSON Pointer"),
  skipIfEmpty: z.boolean().optional(),
  fallback: z.object({ ifMissing: z.any().optional() }).optional(),
  limit: z.object({
    units: z.enum(["tokens","count"]),
    max: z.number().int().min(1).max(100000)
  }).optional()
}).strict();

export const InjectionMapDocV1Schema = z.object({
  rules: z.array(InjectionRuleV1Schema).min(1),
  notes: z.string().max(2000).optional()
}).strict();

export const DryRunRequestSchema = z.object({
  game_id: z.string().optional(),
  game_snapshot: z.any().optional()
}).strict();

export const BundleDiffRequestSchema = z.object({
  left: z.object({
    mapRef: z.string().optional(),
    rawMap: InjectionMapDocV1Schema.optional(),
    game_id: z.string().optional(),
    game_snapshot: z.any().optional()
  }).strict(),
  right: z.object({
    mapRef: z.string().optional(),
    rawMap: InjectionMapDocV1Schema.optional(),
    game_id: z.string().optional(),
    game_snapshot: z.any().optional()
  }).strict()
}).strict();
