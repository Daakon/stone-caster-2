/**
 * Catalog Types
 * Types for catalog endpoints (worlds, NPCs, stories, etc.)
 */

export type CatalogWorldMini = {
  id: string;
  slug: string;
  name: string;
};

export type CatalogNpc = {
  id: string;
  name: string;
  status: 'active' | 'draft' | 'archived';
  world: CatalogWorldMini | null;
  portrait_url: string | null;
  short_desc?: string | null;
  tags?: string[];
  created_at?: string;
};

export type CatalogNpcListMeta = {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  sort: 'name' | 'created_at' | 'popularity';
  order: 'asc' | 'desc';
  q?: string;
  world?: string;
};

export type CatalogNpcListResponse = {
  ok: true;
  meta: CatalogNpcListMeta;
  data: CatalogNpc[];
};

export type ApiError = {
  ok: false;
  code: string;
  message?: string;
};

export type CatalogNpcDetail = CatalogNpc & {
  description?: string | null;
  doc?: Record<string, unknown> | null;
};

export type CatalogNpcDetailResponse =
  | { ok: true; data: CatalogNpcDetail }
  | { ok: false; code: 'NPC_NOT_FOUND'; message?: string };

