import { useState, useEffect } from 'react';
import { NPC } from '@/services/admin.npcs';

export function useNPCs() {
  const [npcs, setNPCs] = useState<NPC[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadNPCs = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/npcs');
        
        if (!response.ok) {
          throw new Error('Failed to load NPCs');
        }
        
        const data = await response.json();
        setNPCs(data.items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    
    loadNPCs();
  }, []);
  
  return { npcs, loading, error };
}
