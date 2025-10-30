/**
 * Unified Catalog Hooks
 * React Query hooks for catalog data
 * 
 * Spec: docs/CATALOG_UNIFIED_DTO_SPEC.md
 */

import { useQuery } from '@tanstack/react-query';
import { listEntryPoints, getEntryPoint } from '@/services/catalog';
import type { CatalogFilters } from '@/types/catalog';
import { DEFAULT_FILTERS } from '@/types/catalog';

/**
 * Hook to list entry points with filters
 */
export function useEntryPoints(filters: CatalogFilters = DEFAULT_FILTERS) {
  return useQuery({
    queryKey: ['catalog', 'entry-points', filters],
    queryFn: () => listEntryPoints(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to get single entry point by ID or slug
 */
export function useEntryPoint(idOrSlug: string) {
  return useQuery({
    queryKey: ['catalog', 'entry-point', idOrSlug],
    queryFn: () => getEntryPoint(idOrSlug),
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!idOrSlug,
  });
}

