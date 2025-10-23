import { useState, useEffect } from 'react';
import { Ruleset } from '@/services/admin.rulesets';

export function useRulesets() {
  const [rulesets, setRulesets] = useState<Ruleset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadRulesets = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/rulesets');
        
        if (!response.ok) {
          throw new Error('Failed to load rulesets');
        }
        
        const data = await response.json();
        setRulesets(data.items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    
    loadRulesets();
  }, []);
  
  return { rulesets, loading, error };
}
