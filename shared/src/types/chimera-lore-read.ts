import { z } from "zod";
import { EntityReadIdSchema } from "./chimera-entity-read.js";

export const LoreReadQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(50),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
});
export const LoreContextQuerySchema = LoreReadQuerySchema.extend({
  world_id: EntityReadIdSchema.optional(),
  entity_id: EntityReadIdSchema.optional(),
  story_id: z.string().uuid().optional(),
}).refine((q) => q.world_id || q.entity_id || q.story_id, {
  message: "Lore context is required",
});
export type LoreReadQuery = z.infer<typeof LoreReadQuerySchema>;
export type LoreContextQuery = z.infer<typeof LoreContextQuerySchema>;
export interface LoreReadContext {
  kind: "world" | "entity" | "story";
  id: string | null;
  key: string;
  namespace: string;
}
export interface LoreRead {
  id: string;
  content_key: string;
  owner_kind: "first_party" | "player";
  owner_namespace: string;
  owner_user_id: string | null;
  visibility: string;
  release_state: "internal" | "published";
  is_official: boolean;
  world_id: string | null;
  entity_id: string | null;
  story_id: string | null;
  fragment: Record<string, unknown>;
  keywords: string[];
  display_name: string | null;
  entry_text: string | null;
  content_chunk: string | null;
  type: string | null;
  embedding: null;
  tags: (string | { id: string; tag_name: string })[];
  created_at: string;
  updated_at: string;
}
