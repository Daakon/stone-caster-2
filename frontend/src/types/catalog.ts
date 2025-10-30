/**
 * Unified Catalog Types
 * Mirrors admin source of truth with user-facing DTO
 * 
 * Spec: docs/CATALOG_UNIFIED_DTO_SPEC.md
 */

import { z } from 'zod';

// ============================================================================
// CATALOG ENTRY POINT DTO
// ============================================================================

export const CatalogEntryPointSchema = z.object({
  // Identity
  id: z.string(),
  slug: z.string(),
  type: z.enum(['adventure', 'scenario', 'sandbox', 'quest']),
  
  // Content
  title: z.string(),
  subtitle: z.string().nullable(),
  description: z.string(),
  synopsis: z.string().nullable(),
  tags: z.array(z.string()),
  
  // Classification
  world_id: z.string().nullable(),
  world_name: z.string().nullable(),
  content_rating: z.enum(['safe', 'mature', 'explicit']),
  
  // Computed flags
  is_playable: z.boolean(),
  has_prompt: z.boolean(),
  
  // Metadata
  created_at: z.string(),
  updated_at: z.string(),
  
  // Detail page only (optional)
  hero_quote: z.string().nullable().optional(),
  rulesets: z.array(z.object({
    id: z.string(),
    name: z.string(),
    sort_order: z.number()
  })).optional()
});

export type CatalogEntryPoint = z.infer<typeof CatalogEntryPointSchema>;

// ============================================================================
// LIST RESPONSE
// ============================================================================

export const CatalogListMetaSchema = z.object({
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  filters: z.object({
    world: z.string().optional(),
    q: z.string().optional(),
    tags: z.array(z.string()).optional(),
    rating: z.array(z.string()).optional(),
    visibility: z.array(z.string()).optional(),
    activeOnly: z.boolean().optional(),
    playableOnly: z.boolean().optional()
  }),
  sort: z.string()
});

export type CatalogListMeta = z.infer<typeof CatalogListMetaSchema>;

export const CatalogListResponseSchema = z.object({
  ok: z.literal(true),
  data: z.array(CatalogEntryPointSchema),
  meta: CatalogListMetaSchema
});

export type CatalogListResponse = z.infer<typeof CatalogListResponseSchema>;

// ============================================================================
// DETAIL RESPONSE
// ============================================================================

export const CatalogDetailResponseSchema = z.object({
  ok: z.literal(true),
  data: CatalogEntryPointSchema
});

export type CatalogDetailResponse = z.infer<typeof CatalogDetailResponseSchema>;

// ============================================================================
// FILTER OPTIONS
// ============================================================================

export interface CatalogFilters {
  world?: string;
  q?: string;
  tags?: string[];
  rating?: string[];
  visibility?: string[];
  activeOnly?: boolean;
  playableOnly?: boolean;
  sort?: string;
  limit?: number;
  offset?: number;
}

export const DEFAULT_FILTERS: CatalogFilters = {
  activeOnly: true,
  playableOnly: true,
  sort: '-updated',
  limit: 20,
  offset: 0
};

// ============================================================================
// SORT OPTIONS
// ============================================================================

export const SORT_OPTIONS = [
  { value: '-updated', label: 'Recently Updated' },
  { value: '-created', label: 'Newly Added' },
  { value: '-popularity', label: 'Most Popular' },
  { value: 'alpha', label: 'A-Z' },
  { value: 'custom', label: 'Featured' }
] as const;

// ============================================================================
// CONTENT RATING OPTIONS
// ============================================================================

export const CONTENT_RATING_OPTIONS = [
  { value: 'safe', label: 'Safe', description: 'Family-friendly content' },
  { value: 'mature', label: 'Mature', description: 'May contain mature themes' },
  { value: 'explicit', label: 'Explicit', description: 'Adult content' }
] as const;

// ============================================================================
// VISIBILITY OPTIONS
// ============================================================================

export const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'unlisted', label: 'Unlisted' },
  { value: 'private', label: 'Private' }
] as const;

