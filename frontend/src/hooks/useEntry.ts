/**
 * Hook to fetch an entry point for admin editing
 * Uses the admin API endpoint which returns full entry data with rulesets
 */
import { useQuery } from '@tanstack/react-query';
import { entryPointsService, type EntryPoint } from '@/services/admin.entryPoints';

export function useEntry(id: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-entry', id],
    queryFn: () => entryPointsService.getEntryPoint(id),
    enabled: !!id,
    staleTime: 0, // Always fetch fresh data for admin editing
  });
  
  // Transform the data: map title to name if name is missing
  const entry: EntryPoint | null = data ? {
    ...data,
    // If name is missing but title exists, use title as name
    name: data.name || data.title || '',
  } : null;
  
  return { 
    entry, 
    loading: isLoading, 
    error: error?.message || null 
  };
}
