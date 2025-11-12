import { useState, useEffect } from 'react';
import { type NPCPack } from '@/services/admin.npcPacks';
import { npcPacksService } from '@/services/admin.npcPacks';

export function useNPCPacks() {
  const [npcPacks, setNPCPacks] = useState<NPCPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadNPCPacks = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await npcPacksService.listNPCPacks({}, 1, 100);
        setNPCPacks(response.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setNPCPacks([]); // Ensure we always have an array
      } finally {
        setLoading(false);
      }
    };
    
    loadNPCPacks();
  }, []);
  
  return { npcPacks, loading, error };
}
