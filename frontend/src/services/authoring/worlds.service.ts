import type { WorldDefinition } from '@/types/chimera-domain';
import * as chimeraApi from '@/services/chimera-api';
import { useQuery } from '@tanstack/react-query';

export const useWorlds = (genre?: string) => {
    return useQuery({
        queryKey: ['worlds', genre],
        queryFn: () => worldsService.getWorlds(genre),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const worldsService = {
    /**
     * Get all worlds from Backend API with optional genre filter
     */
    getWorlds: async (genre?: string): Promise<WorldDefinition[]> => {
        try {
            // Use API Proxy implementation (Chimera API)
            // Backend handles auth and filtering
            return await chimeraApi.getWorlds(genre);
        } catch (error) {
            console.error('[worldsService] Failed to fetch worlds:', error);
            throw error;
        }
    },

    /**
     * Create a new world
     */
    createWorld: async (world: Omit<WorldDefinition, 'world_id'>): Promise<WorldDefinition> => {
        try {
            // Use Chimera API for consistent creation logic
            const newId = await chimeraApi.createWorld(world as any);
            return {
                ...world,
                world_id: newId
            };
        } catch (error) {
            console.error('[worldsService] Failed to create world:', error);
            throw error;
        }
    }
};

