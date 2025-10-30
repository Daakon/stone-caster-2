/**
 * @deprecated Use useRulesetsQuery from @/lib/queries instead. This hook will be removed in Phase 2.
 */
import { useRulesetsQuery as useRulesetsQueryNew } from '@/lib/queries';

export function useRulesets() {
  const { data, isLoading, error } = useRulesetsQueryNew();
  
  return { 
    rulesets: data?.data || [], 
    loading: isLoading, 
    error: error?.message || null 
  };
}
