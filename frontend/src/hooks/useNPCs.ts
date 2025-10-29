/**
 * @deprecated Use useNPCsQuery from @/lib/queries instead. This hook will be removed in Phase 2.
 */
import { useNPCsQuery as useNPCsQueryNew } from '@/lib/queries';

export function useNPCs() {
  const { data, isLoading, error } = useNPCsQueryNew({});
  
  return { 
    npcs: data?.data || [], 
    loading: isLoading, 
    error: error?.message || null 
  };
}
