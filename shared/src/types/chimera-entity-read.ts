import { z } from "zod";

export const EntityReadIdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[\w.:-]+$/);
export const EntityReadQuerySchema = z.object({
  world_id: EntityReadIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
});
export type EntityReadQuery = z.infer<typeof EntityReadQuerySchema>;
export type EntityReadLane = "first_party" | "public" | "owner";
export type EntityReadMode = "library" | "owned" | "rawOwned";
export interface EntityReadCard {
  id: string;
  slug: string;
  display_name: string | null;
  entity_type: "NPC" | "ITEM" | "FACTION" | "LOCATION";
  primary_image_url: string | null;
  updated_at: string;
  visibility: string;
  is_official: boolean;
  owner_user_id: string | null;
  world_id: string | null;
}
export interface EntityRead extends EntityReadCard {
  key: string;
  content_key: string;
  owner_kind: "first_party" | "player";
  owner_namespace: string;
  release_state: "internal" | "published";
  kind: string;
  raw_data: Record<string, unknown>;
  icon_image_url: string | null;
  description_short: string | null;
  description_long: string | null;
  images: unknown[];
  tags: (string | { id: string; tag_name: string })[];
  base_state_json?: Record<string, unknown>;
  created_at: string;
}
