import { useState, useEffect } from 'react';
import { Entry } from '@/services/admin.entries';

export function useEntry(id: string) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    
    const loadEntry = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/entries/${id}`);
        
        if (!response.ok) {
          throw new Error('Failed to load entry');
        }
        
        const data = await response.json();
        setEntry(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    
    loadEntry();
  }, [id]);
  
  return { entry, loading, error };
}
