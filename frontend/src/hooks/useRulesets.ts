/**
 * Hook to fetch rulesets for admin editing
 * Uses the admin API endpoint which requires page and limit parameters
 */
import { useQuery } from '@tanstack/react-query';
// PHASE 1.7: Legacy service removed - will be replaced with Chimera V3 in Phase 2
// import { rulesetsService } from '@/services/admin.rulesets';

export function useRulesets() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-rulesets', { page: 1, limit: 100 }],
    queryFn: () => Promise.resolve({ data: [], count: 0, hasMore: false }), // Temporary - will be replaced in Phase 2
    // queryFn: () => rulesetsService.listRulesets({}, 1, 100),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
  });
  
  return { 
    rulesets: data?.data || [], 
    loading: isLoading, 
    error: error?.message || null 
  };
}
