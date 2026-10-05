import { z } from "zod";

const fields = {
  display_name: z.string().min(1).max(200),
  entry_text: z.string().min(1).max(100000),
  keywords: z.array(z.string().max(200)).max(100),
  type: z.string().max(200),
  tag_names: z.array(z.string().min(1).max(160)).max(100),
};
export const LoreCreateSchema = z
  .object({
    ...fields,
    keywords: fields.keywords.default([]),
    type: fields.type.optional(),
    tag_names: fields.tag_names.optional(),
    world_id: z.string().uuid().optional(),
    entity_id: z.string().uuid().optional(),
    story_id: z.string().uuid().optional(),
  })
  .strict()
  .refine((v) => v.world_id || v.entity_id || v.story_id, {
    message: "Lore context is required",
  });
export const LoreUpdateSchema = z
  .object(fields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: "Lore changes are required",
  });
export const LoreWriteIdSchema = z.string().uuid();
export type LoreCreate = z.infer<typeof LoreCreateSchema>;
export type LoreUpdate = z.infer<typeof LoreUpdateSchema>;
export type LoreWriteAction = "create" | "update" | "delete";
export const LoreWriteResultSchema = z.object({
  id: z.string().uuid(),
  content_key: z.string(),
  owner_kind: z.literal("player"),
  owner_namespace: z.string().uuid(),
  owner_user_id: z.string().uuid(),
  visibility: z.enum(["private", "pending", "public"]),
  release_state: z.enum(["internal", "published"]),
  is_official: z.literal(false),
  world_id: z.string().uuid().nullable(),
  entity_id: z.string().uuid().nullable(),
  story_id: z.string().uuid().nullable(),
  fragment: z.record(z.unknown()),
  keywords: z.array(z.string()),
  display_name: z.string().nullable(),
  entry_text: z.string().nullable(),
  content_chunk: z.string().nullable(),
  type: z.string().nullable(),
  embedding: z.null(),
  tags: z.array(z.object({ id: z.string().uuid(), tag_name: z.string() })),
  created_at: z.string(),
  updated_at: z.string(),
});
export const LoreDeleteResultSchema = z.object({
  id: z.string().uuid(),
  deleted: z.literal(true),
});
export type LoreWriteResult = z.infer<typeof LoreWriteResultSchema>;
export type LoreDeleteResult = z.infer<typeof LoreDeleteResultSchema>;
