import { useState, useEffect } from 'react';
import { PromptSegment } from '@/services/admin.segments';

export function usePromptSegments() {
  const [segments, setSegments] = useState<PromptSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadSegments = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/prompt-segments');
        
        if (!response.ok) {
          throw new Error('Failed to load prompt segments');
        }
        
        const data = await response.json();
        setSegments(data.items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    
    loadSegments();
  }, []);
  
  return { segments, loading, error };
}
