import { z } from "zod";

export const ScenarioDocV1Schema = z.object({
  world_ref: z.string().min(1),
  adventure_ref: z.string().min(1).optional(),
  is_public: z.boolean().optional(),
  scenario: z.object({
    display_name: z.string().min(1).max(64),
    synopsis: z.string().max(160).optional(),
    start_scene: z.string().min(1),
    fixed_npcs: z.array(z.object({ npc_ref: z.string().min(1) })).max(12).optional(),
    starting_party: z.array(z.object({ npc_ref: z.string().min(1) })).max(6).optional(),
    starting_inventory: z.array(z.object({
      item_id: z.string().min(1),
      qty: z.number().int().min(1).max(999).optional()
    })).max(40).optional(),
    starting_resources: z.record(z.number()).optional(),
    starting_flags: z.record(z.boolean()).optional(),
    starting_objectives: z.array(z.object({
      id: z.string().min(1),
      label: z.string().min(1).max(80),
      status: z.enum(["active","completed","failed"]).optional()
    })).max(12).optional(),
    tags: z.array(z.string().min(1)).max(16).optional(),
    slices: z.array(z.string().min(1)).max(16).optional(),
    i18n: z.record(z.object({
      display_name: z.string().max(64).optional(),
      synopsis: z.string().max(160).optional(),
      start_scene: z.string().min(1).optional()
    })).optional()
  }).strict()
}).strict();
