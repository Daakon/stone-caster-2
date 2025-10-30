/**
 * @deprecated Use useStoryQuery from @/lib/queries instead. This hook will be removed in Phase 2.
 */
import { useStoryQuery as useStoryQueryNew } from '@/lib/queries';

export function useEntry(id: string) {
  const { data, isLoading, error } = useStoryQueryNew(id);
  
  return { 
    entry: data?.data || null, 
    loading: isLoading, 
    error: error?.message || null 
  };
}

// Export the new hook as well
export { useStoryQueryNew as useStory };
