import { z } from "zod";

// Compiled into this build. Increasing this range requires implemented parsers.
export const SUPPORTED_CONTENT_FORMAT = Object.freeze({ min: 1, max: 1 });
export const ContentRuntimeIdentitySchema = z
  .object({
    app_name: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/),
    machine_id: z.string().regex(/^[a-z0-9]{1,64}$/),
    machine_version: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    image_ref: z
      .string()
      .min(1)
      .max(512)
      .regex(/^[^\p{Cc}]+$/u),
  })
  .strict();
export type ContentRuntimeIdentity = z.infer<
  typeof ContentRuntimeIdentitySchema
>;
const format = z.number().int().positive().nullable();
export const ContentFormatInventorySchema = z
  .object({
    catalog_generation: z
      .string()
      .regex(/^(0|[1-9][0-9]*)$/)
      .refine((value) => BigInt(value) <= 9223372036854775807n),
    source_min: format,
    source_max: format,
    blob_min: format,
    blob_max: format,
  })
  .strict()
  .refine((value) =>
    [
      [value.source_min, value.source_max],
      [value.blob_min, value.blob_max],
    ].every(
      ([min, max]) =>
        (min === null && max === null) ||
        (typeof min === "number" && typeof max === "number" && min <= max),
    ),
  );
export const ContentReadinessSchema = z
  .object({
    status: z.enum(["ready", "not_ready"]),
    checks: z.object({ db: z.boolean(), contentFormats: z.boolean() }).strict(),
    timestamp: z.string().datetime(),
  })
  .strict();
export type ContentReadiness = z.infer<typeof ContentReadinessSchema>;
