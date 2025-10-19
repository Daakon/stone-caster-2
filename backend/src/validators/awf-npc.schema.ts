import { z } from "zod";

export const NPCDocV1Schema = z.object({
  npc: z.object({
    display_name: z.string().min(1).max(64),
    archetype: z.string().max(48).optional(),
    summary: z.string().min(1).max(160),
    tags: z.array(z.string().min(1)).max(16).optional(),
    traits: z.record(z.number().min(0).max(100)).optional(),
    skills: z.record(z.number().min(0).max(100)).optional(),
    style: z.object({
      voice: z.string().max(120).optional(),
      register: z.string().max(32).optional(),
      taboos: z.array(z.string().min(1)).max(12).optional()
    }).optional(),
    links: z.object({
      world_ref: z.string().optional(),
      adventure_refs: z.array(z.string().min(1)).optional()
    }).optional(),
    slices: z.array(z.string().min(1)).optional(),
    i18n: z.record(z.object({
      display_name: z.string().max(64).optional(),
      summary: z.string().max(160).optional(),
      style: z.object({
        voice: z.string().max(120).optional(),
        register: z.string().max(32).optional(),
        taboos: z.array(z.string().min(1)).max(12).optional()
      }).optional()
    })).optional()
  }).strict()
}).strict();
