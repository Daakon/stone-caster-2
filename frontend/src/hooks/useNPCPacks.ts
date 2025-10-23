import { useState, useEffect } from 'react';
import { NPCPack } from '@/services/admin.npcPacks';

export function useNPCPacks() {
  const [npcPacks, setNPCPacks] = useState<NPCPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadNPCPacks = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/npc-packs');
        
        if (!response.ok) {
          throw new Error('Failed to load NPC packs');
        }
        
        const data = await response.json();
        setNPCPacks(data.items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    
    loadNPCPacks();
  }, []);
  
  return { npcPacks, loading, error };
}
