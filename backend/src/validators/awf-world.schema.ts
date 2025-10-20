import { z } from "zod";

export const TimeworldSchema = z.object({
  timezone: z.string().min(1),
  calendar: z.string().min(1),
  seasons: z.array(z.string().min(1)).max(12).optional()
}).partial({ seasons: true });

export const WorldDocV1Schema = z.object({
  id: z.string().min(1),            // used by admin only; DB key is separate
  name: z.string().min(1),
  version: z.string().min(1),
  timeworld: TimeworldSchema.optional(),

  // OPTIONAL authoring helpers
  slices: z.array(z.string().min(1)).max(24).optional(),
  i18n: z.record(z.object({
    name: z.string().max(80).optional(),
  })).optional()
})
// allow arbitrary extra keys for each world to be custom
.passthrough();