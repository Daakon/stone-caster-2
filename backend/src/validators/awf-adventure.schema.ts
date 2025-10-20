import { z } from "zod";

export const AdventureDocV1Schema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  world_ref: z.string().min(1),

  // Optional authoring helpers
  synopsis: z.string().max(280).optional(),
  cast: z.array(z.object({ npc_ref: z.string().min(1) })).max(24).optional(),
  slices: z.array(z.string().min(1)).max(24).optional(),
  i18n: z.record(z.object({
    name: z.string().max(80).optional(),
    synopsis: z.string().max(280).optional()
  })).optional()
})
.passthrough();
