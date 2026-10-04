import { z } from "zod";
import { EntityReadIdSchema } from "./chimera-entity-read.js";

export const NpcCatalogQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  search: z.string().trim().max(100).optional(),
  world: EntityReadIdSchema.optional(),
  activeOnly: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
});
export type NpcCatalogQuery = z.infer<typeof NpcCatalogQuerySchema>;
export interface NpcCatalogRead {
  id: string;
  name: string | null;
  slug: string;
  description: string | null;
  worldId: string | null;
  status: string | null;
  visibility: string;
  archetype: string | null;
  roleTags: string[];
  portraitUrl: string | null;
  cover_media: { id: string | null; provider_key: string | null } | null;
  doc: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface NpcCatalogPage {
  items: NpcCatalogRead[];
  total: number;
  limit: number;
  offset: number;
}
