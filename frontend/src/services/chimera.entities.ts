/**
 * Chimera Entities Service
 * API client for Chimera V2 entity template endpoints
 */

import { apiFetch, apiPost, apiPut, apiDelete } from '@/lib/api';

export interface ChimeraEntity {
  id: string;
  key: string;
  kind: 'npc' | 'item' | 'location' | 'faction' | 'creature';
  owner_user_id: string | null; // SQL column for ownership tracking
  raw_data: Record<string, unknown>; // JSONB containing full entity definition
  created_at: string;
  updated_at: string;
  // Legacy fields (extracted from raw_data for backward compatibility)
  display_name?: string;
  description_short?: string | null;
  entity_type?: 'NPC' | 'ITEM' | 'FACTION' | 'LOCATION';
  base_state_json?: Record<string, unknown>;
  visibility?: 'private' | 'pending' | 'public';
  is_system_asset?: boolean;
  world_id?: string | null;
  is_quick_start_template?: boolean;
  tags?: Array<{ id: string; tag_name: string }>;
}

export interface CreateEntityData {
  display_name: string;
  description_short?: string | null;
  entity_type: 'NPC' | 'ITEM' | 'FACTION' | 'LOCATION';
  base_state_json: Record<string, unknown>;
  tag_names?: string[];
  images?: Array<{ id?: string; url: string; role?: string; label?: string }>;
}

export interface UpdateEntityData extends Partial<CreateEntityData> {
  visibility?: 'private' | 'pending' | 'public';
}

export interface SelectableEntity {
  id: string;
  display_name: string;
  entity_type: 'NPC' | 'ITEM' | 'FACTION' | 'LOCATION';
  version: number;
  visibility: 'private' | 'pending' | 'public';
}

export const chimeraEntitiesService = {
  /**
   * Get all selectable entities (public or owned by user)
   */
  async getSelectableEntities(): Promise<SelectableEntity[]> {
    const result = await apiFetch<SelectableEntity[]>('/api/v2/chimera/entities/selectable');
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch selectable entities');
    }
    return result.data || [];
  },

  /**
   * Get all entities owned by the current user
   */
  async getMyEntities(): Promise<ChimeraEntity[]> {
    const result = await apiFetch<ChimeraEntity[]>('/api/v2/chimera/entities/my-creations');
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch entities');
    }
    return result.data || [];
  },

  /**
   * Get a single entity by ID
   */
  async getEntity(id: string): Promise<ChimeraEntity> {
    const result = await apiFetch<ChimeraEntity>(`/api/v2/chimera/entities/${id}`);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch entity');
    }
    return result.data!;
  },

  /**
   * Create a new entity
   */
  async createEntity(data: CreateEntityData): Promise<ChimeraEntity> {
    const result = await apiPost<ChimeraEntity>('/api/v2/chimera/entities', data);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to create entity');
    }
    return result.data!;
  },

  /**
   * Update an existing entity
   */
  async updateEntity(id: string, data: UpdateEntityData): Promise<ChimeraEntity> {
    const result = await apiPut<ChimeraEntity>(`/api/v2/chimera/entities/${id}`, data);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to update entity');
    }
    return result.data!;
  },

  /**
   * Delete an entity
   */
  async deleteEntity(id: string): Promise<void> {
    const result = await apiDelete(`/api/v2/chimera/entities/${id}`);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to delete entity');
    }
  },

  /**
   * Create an entity template (for use in CreateEntityModal)
   */
  async createEntityTemplate(payload: CreateEntityData): Promise<ChimeraEntity> {
    const result = await apiPost<ChimeraEntity>('/api/v2/chimera/entities', payload);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to create entity template');
    }
    return result.data!;
  },
};

