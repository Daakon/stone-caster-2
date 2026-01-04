
import { apiGet, apiPost } from '@/lib/api';

/**
 * Fetches the Compiled Story (Game Ready) by ID.
 * This includes the merged schema, world data, and engine configuration.
 * Endpoint: /api/chimera/game/stories/:id
 */
export async function getCompiledStory(id: string) {
    // The previous implementation pointed to /api/chimera/compile/:id which was for the Compiler triggers.
    // The correct endpoint for consuming the *result* is the Game Stories endpoint.
    return apiGet<any>(`/api/chimera/game/stories/${id}`);
}

/**
 * Fetches characters for the current user.
 * Supports filtering by world_id if needed, but for the gateway we usually want all or filtered by compatibility.
 */
export async function getMyCharacters(worldId?: string) {
    // Phase 1 Migration: Use new Chimera Player Characters table
    // Ignore worldId filter for now on the endpoint if it doesn't support it, or add it as query param
    const url = worldId ? `/api/v2/chimera/player-characters?world_id=${worldId}` : '/api/v2/chimera/player-characters';
    return apiGet<any[]>(url);
}

export async function getPremades() {
    return apiGet<any[]>('/api/chimera/game/premades');
}
