/**
 * Chimera Content Packs Service
 * API client for Chimera V2 content pack endpoints
 */

import { apiFetch, apiPost, apiPut, apiDelete } from '@/lib/api';

export interface ChimeraContentPack {
  id: string;
  owner_user_id: string;
  visibility: 'private' | 'pending_approval' | 'public';
  is_system_asset: boolean;
  version: number;
  display_name: string;
  description_short: string | null;
  pack_type: 'NPC' | 'ITEM' | 'LORE' | 'MIXED';
  inter_entity_state: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  entity_links?: Array<{ entity_template_id: string }>;
  ruleset_links?: Array<{ ruleset_template_id: string }>;
  lore_links?: Array<{ lore_template_id: string }>;
  dependencies?: Array<{ depends_on_pack_id: string }>;
}

export interface SelectablePack {
  id: string;
  display_name: string;
  version: number;
  pack_type: 'NPC' | 'ITEM' | 'LORE' | 'MIXED';
  visibility: 'private' | 'pending_approval' | 'public';
}

export interface CreatePackData {
  display_name: string;
  description_short?: string | null;
  pack_type: 'NPC' | 'ITEM' | 'LORE' | 'MIXED';
  entity_template_ids: string[];
  ruleset_template_ids: string[];
  lore_template_ids: string[];
  depends_on_pack_ids: string[];
  inter_entity_state?: Record<string, unknown> | null;
}

export interface UpdatePackData extends Partial<CreatePackData> {
  visibility?: 'private' | 'pending_approval' | 'public';
}

export const chimeraPacksService = {
  /**
   * Get all selectable packs (public or owned by user)
   * @param excludePackId Optional pack ID to exclude from results (prevents self-dependencies)
   */
  async getSelectablePacks(excludePackId?: string): Promise<SelectablePack[]> {
    const url = excludePackId
      ? `/api/v2/chimera/packs/selectable?exclude=${encodeURIComponent(excludePackId)}`
      : '/api/v2/chimera/packs/selectable';
    const result = await apiFetch<SelectablePack[]>(url);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch selectable packs');
    }
    return result.data || [];
  },

  /**
   * Get all packs owned by the current user
   */
  async getMyPacks(): Promise<ChimeraContentPack[]> {
    const result = await apiFetch<ChimeraContentPack[]>('/api/v2/chimera/packs/my-creations');
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch packs');
    }
    return result.data || [];
  },

  /**
   * Get a single pack by ID
   */
  async getPack(id: string): Promise<ChimeraContentPack> {
    const result = await apiFetch<ChimeraContentPack>(`/api/v2/chimera/packs/${id}`);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch pack');
    }
    return result.data!;
  },

  /**
   * Create a new pack
   */
  async createPack(data: CreatePackData): Promise<ChimeraContentPack> {
    const result = await apiPost<ChimeraContentPack>('/api/v2/chimera/packs', data);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to create pack');
    }
    return result.data!;
  },

  /**
   * Update an existing pack
   */
  async updatePack(id: string, data: UpdatePackData): Promise<ChimeraContentPack> {
    const result = await apiPut<ChimeraContentPack>(`/api/v2/chimera/packs/${id}`, data);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to update pack');
    }
    return result.data!;
  },

  /**
   * Delete a pack
   */
  async deletePack(id: string): Promise<void> {
    const result = await apiDelete(`/api/v2/chimera/packs/${id}`);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to delete pack');
    }
  },
};

