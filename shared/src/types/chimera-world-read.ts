import { z } from "zod";

export const WorldReadQuerySchema = z.object({
  tag: z.string().trim().min(1).max(100).optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
});
export const WorldReadIdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[\w.:-]+$/);
export type WorldReadQuery = z.infer<typeof WorldReadQuerySchema>;
export type WorldReadLane = "first_party" | "public" | "owner";

export interface WorldRead {
  id: string;
  key: string;
  content_key: string;
  owner_kind: "first_party" | "player";
  owner_namespace: string;
  owner_user_id: string | null;
  release_state: "internal" | "published";
  visibility: string;
  is_official: boolean;
  name: string;
  display_name: string;
  slug: string;
  definition: Record<string, unknown>;
  description_short: string | null;
  description_long: string | null;
  character_schema_contributions: Record<string, unknown>;
  tags: string[];
  genre_tags: string[];
  images: unknown[];
  genre: string | null;
  setting: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorldCatalogRead {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  short_desc: string;
  hero_quote: string;
  status: "active";
  cover_media: { id: string | null; provider_key: string | null } | null;
  created_at: string;
  updated_at: string;
}
