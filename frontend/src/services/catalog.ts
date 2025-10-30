/**
 * Unified Catalog Service
 * Fetches entry points from the unified catalog API
 * 
 * Spec: docs/CATALOG_UNIFIED_DTO_SPEC.md
 */

import { apiGet } from '@/lib/api';
import type {
  CatalogEntryPoint,
  CatalogFilters,
  CatalogListResponse,
  CatalogDetailResponse
} from '@/types/catalog';
import { CatalogListResponseSchema, CatalogDetailResponseSchema } from '@/types/catalog';

/**
 * Build query string from filters
 */
function buildQueryString(filters: CatalogFilters): string {
  const params = new URLSearchParams();
  
  if (filters.world) params.append('world', filters.world);
  if (filters.q) params.append('q', filters.q);
  if (filters.tags) filters.tags.forEach(tag => params.append('tags', tag));
  if (filters.rating) filters.rating.forEach(rating => params.append('rating', rating));
  if (filters.visibility) filters.visibility.forEach(vis => params.append('visibility', vis));
  if (filters.activeOnly !== undefined) params.append('activeOnly', String(filters.activeOnly));
  if (filters.playableOnly !== undefined) params.append('playableOnly', String(filters.playableOnly));
  if (filters.sort) params.append('sort', filters.sort);
  if (filters.limit) params.append('limit', String(filters.limit));
  if (filters.offset) params.append('offset', String(filters.offset));
  
  return params.toString();
}

/**
 * List entry points with filters, sorting, and pagination
 */
export async function listEntryPoints(filters: CatalogFilters = {}): Promise<CatalogListResponse> {
  const queryString = buildQueryString(filters);
  const path = `/api/catalog/entry-points${queryString ? `?${queryString}` : ''}`;
  
  const result = await apiGet<CatalogListResponse>(path);
  
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to fetch entry points');
  }
  
  // Validate response
  const validated = CatalogListResponseSchema.safeParse(result.data);
  if (!validated.success) {
    console.error('Invalid catalog response:', validated.error);
    throw new Error('Invalid catalog response format');
  }
  
  return validated.data;
}

/**
 * Get single entry point by ID or slug
 */
export async function getEntryPoint(idOrSlug: string): Promise<CatalogEntryPoint> {
  const result = await apiGet<CatalogDetailResponse>(`/api/catalog/entry-points/${idOrSlug}`);
  
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to fetch entry point');
  }
  
  // Validate response
  const validated = CatalogDetailResponseSchema.safeParse(result.data);
  if (!validated.success) {
    console.error('Invalid catalog detail response:', validated.error);
    throw new Error('Invalid catalog detail response format');
  }
  
  return validated.data.data;
}

