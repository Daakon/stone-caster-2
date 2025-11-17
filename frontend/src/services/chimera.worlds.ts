/**
 * Chimera Worlds Service
 * API client for Chimera V2 world endpoints
 */

import { apiFetch, apiPost, apiPut, apiDelete } from '@/lib/api';

export interface ChimeraWorld {
  id: string;
  owner_user_id: string;
  visibility: 'private' | 'pending_approval' | 'public';
  display_name: string;
  description_short: string | null;
  description_long: string | null;
  created_at: string;
  updated_at: string;
  ruleset_links?: Array<{ ruleset_template_id: string }>;
  tags?: Array<{ id: string; tag_name: string }>;
}

export interface CreateWorldData {
  display_name: string;
  description_short?: string | null;
  description_long?: string | null;
  ruleset_template_ids?: string[];
  tag_names?: string[];
}

export interface UpdateWorldData extends Partial<CreateWorldData> {}

export const chimeraWorldsService = {
  /**
   * Get all selectable worlds (public or owned by user)
   */
  async getSelectableWorlds(): Promise<ChimeraWorld[]> {
    const result = await apiFetch<ChimeraWorld[]>('/api/v2/chimera/worlds/selectable');
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch selectable worlds');
    }
    return result.data || [];
  },

  /**
   * Get all worlds owned by the current user
   */
  async getMyWorlds(): Promise<ChimeraWorld[]> {
    const result = await apiFetch<ChimeraWorld[]>('/api/v2/chimera/worlds/my-creations');
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch worlds');
    }
    return result.data || [];
  },

  /**
   * Get a single world by ID
   */
  async getWorld(id: string): Promise<ChimeraWorld> {
    const result = await apiFetch<ChimeraWorld>(`/api/v2/chimera/worlds/${id}`);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch world');
    }
    return result.data!;
  },

  /**
   * Create a new world
   */
  async createWorld(data: CreateWorldData): Promise<ChimeraWorld> {
    const result = await apiPost<ChimeraWorld>('/api/v2/chimera/worlds', data);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to create world');
    }
    return result.data!;
  },

  /**
   * Update an existing world
   */
  async updateWorld(id: string, data: UpdateWorldData): Promise<ChimeraWorld> {
    const result = await apiPut<ChimeraWorld>(`/api/v2/chimera/worlds/${id}`, data);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to update world');
    }
    return result.data!;
  },

  /**
   * Delete a world
   */
  async deleteWorld(id: string): Promise<void> {
    const result = await apiDelete(`/api/v2/chimera/worlds/${id}`);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to delete world');
    }
  },
};

