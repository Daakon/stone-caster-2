/**
 * Chimera Lore Service
 * API client for Chimera V2 lore template endpoints
 */

import { apiFetch, apiPost, apiPut, apiDelete } from '@/lib/api';

export interface ChimeraTag {
  id: string;
  tag_name: string;
  is_approved: boolean;
}

export interface ChimeraLore {
  id: string;
  world_id: string | null; // SQL column for world scoping
  fragment: Record<string, unknown>; // JSONB containing full lore data
  embedding: number[] | null;
  created_at: string;
  updated_at: string;
  // Legacy fields (extracted from fragment for backward compatibility)
  owner_user_id?: string;
  visibility?: 'private' | 'pending' | 'public';
  is_system_asset?: boolean;
  version?: number;
  display_name?: string;
  content_chunk?: string;
  entry_text?: string;
  tags?: Array<{ id: string; tag_name: string }>;
}

export interface SelectableLore {
  id: string;
  display_name: string;
  version: number;
  visibility: 'private' | 'pending' | 'public';
  tags?: Array<{ id: string; tag_name: string }>;
}

export interface CreateLoreData {
  world_id: string;
  display_name: string;
  entry_text: string;
  tag_names: string[];
}

export interface UpdateLoreData extends Partial<CreateLoreData> {
  visibility?: 'private' | 'pending' | 'public';
}

export const chimeraLoreService = {
  /**
   * Get all approved tags
   */
  async getTags(): Promise<ChimeraTag[]> {
    const result = await apiFetch<ChimeraTag[]>('/api/v2/chimera/lore/tags');
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch tags');
    }
    return result.data || [];
  },

  /**
   * Get all selectable lore templates (public or owned by user)
   */
  async getSelectableLore(): Promise<SelectableLore[]> {
    const result = await apiFetch<SelectableLore[]>('/api/v2/chimera/lore/selectable');
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch selectable lore');
    }
    return result.data || [];
  },

  /**
   * Get all lore templates owned by the current user
   */
  async getMyLore(): Promise<ChimeraLore[]> {
    const result = await apiFetch<ChimeraLore[]>('/api/v2/chimera/lore/my-creations');
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch lore templates');
    }
    return result.data || [];
  },

  /**
   * Get a single lore template by ID
   */
  async getLore(id: string): Promise<ChimeraLore> {
    const result = await apiFetch<ChimeraLore>(`/api/v2/chimera/lore/${id}`);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch lore template');
    }
    return result.data!;
  },

  /**
   * Create a new lore template
   */
  async createLore(data: CreateLoreData): Promise<ChimeraLore> {
    const result = await apiPost<ChimeraLore>('/api/v2/chimera/lore', data);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to create lore template');
    }
    return result.data!;
  },

  /**
   * Update an existing lore template
   */
  async updateLore(id: string, data: UpdateLoreData): Promise<ChimeraLore> {
    const result = await apiPut<ChimeraLore>(`/api/v2/chimera/lore/${id}`, data);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to update lore template');
    }
    return result.data!;
  },

  /**
   * Delete a lore template
   */
  async deleteLore(id: string): Promise<void> {
    const result = await apiDelete(`/api/v2/chimera/lore/${id}`);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to delete lore template');
    }
  },
};

