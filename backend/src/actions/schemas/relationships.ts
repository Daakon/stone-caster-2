/**
 * Relationship Action Schemas
 */

import { z } from 'zod';

export const RelationshipDeltaSchema = z.object({
  npcId: z.string().min(1),
  stat: z.enum(['warmth', 'trust', 'respect', 'desire', 'awe']),
  delta: z.number().int(),
});

export const RelationshipSetSchema = z.object({
  npcId: z.string().min(1),
  stat: z.enum(['warmth', 'trust', 'respect', 'desire', 'awe']),
  value: z.number().int().min(0).max(10),
});

export type RelationshipDelta = z.infer<typeof RelationshipDeltaSchema>;
export type RelationshipSet = z.infer<typeof RelationshipSetSchema>;

