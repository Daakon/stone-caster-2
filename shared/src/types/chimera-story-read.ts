import { z } from "zod";

export const StoryReadIdSchema = z.string().uuid();
export const StoryReadQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(50),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
  search: z.string().trim().max(100).optional(),
});
export type StoryReadQuery = z.infer<typeof StoryReadQuerySchema>;
export const StorySourceReadSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  owner_user_id: z.string().uuid(),
  owner_kind: z.literal("player"),
  owner_namespace: z.string().uuid(),
  content_key: z.string(),
  release_state: z.enum(["internal", "published"]),
  visibility: z.string(),
  version: z.number().int(),
  content_rating: z.string(),
  is_system_asset: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  last_edited_at: z.string().nullable(),
  story_definition: z.record(z.unknown()).nullable(),
  configuration: z.record(z.unknown()).nullable(),
  genesis_config: z.record(z.unknown()).nullable(),
  description_short: z.string().nullable(),
  description: z.string().nullable(),
  title: z.string().nullable(),
  primary_image_url: z.string().nullable(),
  image_url: z.string().nullable(),
  opening_text: z.string().nullable(),
  world_id: z.string().uuid().nullable(),
  protagonist_id: z.string().uuid().nullable(),
  cast_ids: z.array(z.string().uuid()).nullable(),
  entity_ids: z.array(z.string().uuid()).nullable(),
  active_ruleset_ids: z.array(z.string()).nullable(),
  status: z.string().nullable(),
  compile_status: z.string().nullable(),
  current_compiled_id: z.string().uuid().nullable(),
});
export type StorySourceRead = z.infer<typeof StorySourceReadSchema>;
export interface StoryRead extends StorySourceRead {
  world: { id: string; name: string; description_short: string | null } | null;
}
export interface StoryCatalogRead {
  id: string;
  slug: string;
  type: "story";
  title: string;
  subtitle: null;
  description: string | null;
  synopsis: string | null;
  tags: string[];
  world_id: string | null;
  world_name: string | null;
  world_slug: string | null;
  content_rating: string;
  is_playable: boolean;
  has_prompt: boolean;
  cover_media: { id: null; provider_key: string; url: string } | null;
  rulesets: string[];
  created_at: string;
  updated_at: string;
}
