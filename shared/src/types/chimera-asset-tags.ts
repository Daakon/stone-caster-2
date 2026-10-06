import { z } from "zod";

// Used during HTTP validation, before legacy parent writes begin. A name that
// normalizes to nothing is an error, never an instruction to drop a tag silently.
export const AssetTagNamesSchema = z
  .array(
    z
      .string()
      .min(1)
      .max(160)
      .transform((name) =>
        name
          .trim()
          .toUpperCase()
          .replace(/\s+/g, "_")
          .replace(/[^A-Z0-9_]/g, ""),
      )
      .pipe(z.string().min(1).max(160)),
  )
  .max(100)
  .transform((names) => [...new Set(names)].sort());
export const AssetTagTypeSchema = z.enum(["world", "entity_template"]);
export type AssetTagType = z.infer<typeof AssetTagTypeSchema>;
export const AssetTagResultSchema = z
  .array(
    z
      .object({
        id: z.string().uuid(),
        tag_name: z.string().min(1).max(160),
      })
      .strict(),
  )
  .max(100);
export type AssetTagResult = z.infer<typeof AssetTagResultSchema>;
