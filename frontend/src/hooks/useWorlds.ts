import { useState, useEffect } from 'react';
import { World } from '@/services/admin.worlds';

export function useWorlds() {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadWorlds = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/worlds');
        
        if (!response.ok) {
          throw new Error('Failed to load worlds');
        }
        
        const data = await response.json();
        setWorlds(data.items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    
    loadWorlds();
  }, []);
  
  return { worlds, loading, error };
}
