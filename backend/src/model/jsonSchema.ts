import { z } from "zod";

export const NpcRelationshipDelta = z.object({
  npcId: z.string().min(1),
  trust: z.number().optional(),
  warmth: z.number().optional(),
  respect: z.number().optional(),
  romance: z.number().optional(),
  awe: z.number().optional(),
  fear: z.number().optional(),
  desire: z.number().optional(),
});

export const LlmResultV1 = z.object({
  version: z.literal("1"),
  narrator: z.object({
    text: z.string().min(1),
  }),
  deltas: z.object({
    npcRelationships: z.array(NpcRelationshipDelta).optional(),
    flags: z.record(z.boolean()).optional(),
  }).partial().optional(),
  hints: z.object({
    requestedTierRecalc: z.boolean().optional(),
  }).optional(),
  meta: z.object({
    locale: z.string().optional(),
  }).optional(),
});

export type LlmResultV1 = z.infer<typeof LlmResultV1>;
