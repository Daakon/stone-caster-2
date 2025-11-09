/**
 * Relationships Module Parameters Schema
 */

import { z } from 'zod';

export const RelationshipsParamsSchema = z.object({
  romance: z.object({
    allowed: z.boolean(),
    sameSex: z.boolean(),
    poly: z.boolean(),
  }).optional(),
  minTrustToRomance: z.number().int().min(0).max(10).optional(),
  gainCurve: z.object({
    scale: z.number().min(0).max(3),
    softCap: z.number().int().min(0).max(20),
    hardCap: z.number().int().min(0).max(20),
  }).optional(),
  cooldowns: z.object({
    perNpcTurns: z.number().int().min(0),
    perTopicTurns: z.number().int().min(0),
  }).optional(),
  visibility: z.object({
    showNumbers: z.boolean(),
    showDescriptors: z.boolean(),
  }).optional(),
  consent: z.object({
    requireMutual: z.boolean(),
    powerDynamicsBlocked: z.boolean(),
  }).optional(),
});

export type RelationshipsParams = z.infer<typeof RelationshipsParamsSchema>;

