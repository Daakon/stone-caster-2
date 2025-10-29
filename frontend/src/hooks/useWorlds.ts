/**
 * @deprecated Use useWorldsQuery from @/lib/queries instead. This hook will be removed in Phase 2.
 */
import { useWorldsQuery as useWorldsQueryNew } from '@/lib/queries';

export function useWorlds() {
  const { data, isLoading, error } = useWorldsQueryNew();
  
  return { 
    worlds: data?.data || [], 
    loading: isLoading, 
    error: error?.message || null 
  };
}
