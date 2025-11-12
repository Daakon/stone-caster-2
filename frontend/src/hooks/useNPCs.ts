/**
 * @deprecated Use useNPCsQuery from @/lib/queries instead. This hook will be removed in Phase 2.
 */
import { useNPCsQuery as useNPCsQueryNew } from '@/lib/queries';

export function useNPCs() {
  const { data, isLoading, error } = useNPCsQueryNew({});
  
  // Extract NPCs array from various possible response structures
  // Network response: { ok: true, data: { items: [...], total, limit, offset } }
  // apiFetch returns: { ok: true, data: { items: [...], total, limit, offset } }
  // React Query data = { ok: true, data: { items: [...], total, limit, offset } }
  let npcs: any[] = [];
  
  if (data) {
    // Primary case: { ok: true, data: { items: [...] } } - catalog endpoint structure
    if (data.ok && data.data) {
      const responseData = data.data;
      // Check for items array (catalog endpoint with pagination)
      if (responseData && typeof responseData === 'object' && 'items' in responseData && Array.isArray(responseData.items)) {
        npcs = responseData.items;
      }
      // Check if data itself is an array (admin endpoint)
      else if (Array.isArray(responseData)) {
        npcs = responseData;
      }
    }
    // Fallback: direct array
    else if (Array.isArray(data)) {
      npcs = data;
    }
    // Fallback: { data: { items: [...] } } without ok wrapper
    else if (data.data) {
      const innerData = data.data;
      if (innerData && typeof innerData === 'object' && 'items' in innerData && Array.isArray(innerData.items)) {
        npcs = innerData.items;
      } else if (Array.isArray(innerData)) {
        npcs = innerData;
      }
    }
    // Fallback: { items: [...] } direct
    else if (data.items && Array.isArray(data.items)) {
      npcs = data.items;
    }
  }
  
  return { 
    npcs, 
    loading: isLoading, 
    error: error?.message || null 
  };
}
