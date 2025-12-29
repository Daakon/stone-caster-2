
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
    // Legacy mapping: The legacy API `getCharacters` uses /api/characters
    // We'll stick to that or /api/me/characters if it exists.
    // existing api.ts uses /api/characters with query params.
    const url = worldId ? `/api/me/characters?world=${worldId}` : '/api/me/characters';
    return apiGet<any[]>(url);
}

export async function getPremades() {
    return apiGet<any[]>('/api/chimera/game/premades');
}
