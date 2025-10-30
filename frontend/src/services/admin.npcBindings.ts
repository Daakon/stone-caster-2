/**
 * NPC Bindings Service
 * Phase 6: NPC bindings to entry points with role hints and weights
 * Refactored to use backend API instead of direct Supabase calls
 */

import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

export interface NPCBinding {
  id: string;
  entry_point_id: string;
  npc_id: string;
  role_hint: string;
  weight: number;
  created_at: string;
  updated_at: string;
  // Joined data
  entry_point_title?: string;
  entry_point_type?: string;
  npc_name?: string;
  world_id?: string;
}

export interface NPC {
  id: string;
  name: string;
  description?: string;
  status?: string;
  world_id?: string;
}

export interface CreateBindingData {
  entry_point_id: string;
  npc_id: string;
  role_hint: string;
  weight?: number;
}

export interface UpdateBindingData {
  role_hint?: string;
  weight?: number;
}

export class NPCBindingsService {
  /**
   * Get NPC bindings for an entry point
   */
  async getEntryBindings(entryPointId: string): Promise<Array<NPCBinding & { npc_name: string }>> {
    const result = await apiGet<Array<NPCBinding & { npc_name: string }>>(
      `/api/admin/entry-points/${entryPointId}/npcs`
    );
    
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch NPC bindings');
    }
    
    return result.data;
  }

  /**
   * Get available NPCs for binding to an entry point
   * (excludes NPCs already bound to this entry point)
   */
  async getAvailableNPCs(entryPointId: string): Promise<NPC[]> {
    const result = await apiGet<NPC[]>(
      `/api/admin/entry-points/${entryPointId}/npcs/available`
    );
    
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch available NPCs');
    }
    
    return result.data;
  }

  /**
   * Create NPC binding
   */
  async createBinding(data: CreateBindingData): Promise<NPCBinding & { npc_name: string }> {
    const result = await apiPost<NPCBinding & { npc_name: string }>(
      `/api/admin/entry-points/${data.entry_point_id}/npcs`,
      {
        npc_id: data.npc_id,
        role_hint: data.role_hint,
        weight: data.weight || 1
      }
    );
    
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to create NPC binding');
    }
    
    return result.data;
  }

  /**
   * Update NPC binding
   */
  async updateBinding(bindingId: string, entryPointId: string, data: UpdateBindingData): Promise<NPCBinding & { npc_name: string }> {
    const result = await apiPut<NPCBinding & { npc_name: string }>(
      `/api/admin/entry-points/${entryPointId}/npcs/${bindingId}`,
      data
    );
    
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to update NPC binding');
    }
    
    return result.data;
  }

  /**
   * Delete NPC binding
   */
  async deleteBinding(bindingId: string, entryPointId: string): Promise<void> {
    const result = await apiDelete(
      `/api/admin/entry-points/${entryPointId}/npcs/${bindingId}`
    );
    
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to delete NPC binding');
    }
  }
}

export const npcBindingsService = new NPCBindingsService();
