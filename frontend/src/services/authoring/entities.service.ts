import type { EntityTemplate } from '@/types/chimera-domain';
import * as chimeraApi from '@/services/chimera-api';
import { useQuery } from '@tanstack/react-query';

interface GetEntitiesParams {
    world_id?: string;
    kind?: ('npc' | 'item' | 'location')[];
    source?: 'my' | 'system';
    query?: string;
}

export const useEntities = (params: GetEntitiesParams) => {
    return useQuery({
        // Use primitives for stable query key
        queryKey: ['entities', params.world_id, params.kind?.sort().join(','), params.query, params.source],
        queryFn: () => entitiesService.getEntities(params),
        enabled: !!params.world_id, // Only fetch if world_id is present
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const entitiesService = {
    /**
     * Get entities with filtering
     * Note: Currently fetches all and filters client-side until backend supports query params
     */
    getEntities: async (params: GetEntitiesParams): Promise<EntityTemplate[]> => {
        try {
            // Fetch all entities from backend
            const apiResult = await chimeraApi.getEntities();
            let results = apiResult as unknown as EntityTemplate[];

            // Filter by World ID (Strict Requirement)
            if (params.world_id) {
                results = results.filter(e => e.world_id === params.world_id);
            }

            // Filter by Kind
            if (params.kind && params.kind.length > 0) {
                results = results.filter(e => params.kind?.includes(e.kind as any));
            }

            // Filter by Search Query
            if (params.query) {
                const q = params.query.toLowerCase();
                results = results.filter(e =>
                    e.name.toLowerCase().includes(q) ||
                    e.tags.some(t => t.toLowerCase().includes(q))
                );
            }

            // Filter by Source (TODO: Add 'system' vs 'user' flag to EntityTemplate if needed)
            // For now, assume all entities are 'my' entities unless they have a specific system flag
            // if (params.source === 'system') { ... }

            return results;
        } catch (error) {
            console.error('[entitiesService] Failed to fetch entities:', error);
            throw error;
        }
    },

    /**
     * Create a new entity
     */
    createEntity: async (entity: Omit<EntityTemplate, 'entity_id'>): Promise<EntityTemplate> => {
        try {
            // Create via API
            // Note: API returns ID, we need to construct the full object or refetch
            // For MVP, simplistic construction + ID assignment
            const newId = await chimeraApi.createEntity(entity as any); // API expects EntityTemplate but usually ignores ID on create

            return {
                ...entity,
                entity_id: newId
            };
        } catch (error) {
            console.error('[entitiesService] Failed to create entity:', error);
            throw error;
        }
    }
};

