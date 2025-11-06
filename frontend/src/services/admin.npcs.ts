/**
 * NPCs Admin Service
 * CRUD operations for NPCs management
 */

import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

export interface NPC {
  id: string;
  name: string;
  slug?: string; // Optional - will be added via migration
  status: 'draft' | 'active' | 'archived';
  description?: string;
  prompt?: any; // JSONB - can be any structured data (will be added via migration)
  created_at: string;
  updated_at: string;
}

export interface NPCFilters {
  status?: 'draft' | 'active' | 'archived';
  search?: string;
}

export interface CreateNPCData {
  name: string;
  slug?: string; // Optional - will be auto-generated if not provided
  description?: string;
  status?: 'draft' | 'active' | 'archived';
  prompt?: any; // JSONB - can be any structured data (will be added via migration)
  world_id?: string;
  visibility?: 'private' | 'public';
  author_name?: string;
  author_type?: 'user' | 'original' | 'system';
}

export interface UpdateNPCData extends Partial<CreateNPCData> {}

export interface NPCListResponse {
  data: NPC[];
  count: number;
  hasMore: boolean;
}

export class NPCsService {
  /**
   * List NPCs with filters and pagination
   */
  async listNPCs(
    filters: NPCFilters = {},
    page: number = 1,
    pageSize: number = 20
  ): Promise<NPCListResponse> {
    const params = new URLSearchParams();
    
    if (filters.status) {
      params.append('status', filters.status);
    }
    
    if (filters.search) {
      params.append('search', filters.search);
    }
    
    params.append('page', String(page));
    params.append('limit', String(pageSize));

    const result = await apiGet<{
      data: NPC[];
      count: number;
      hasMore: boolean;
    }>(`/api/admin/npcs?${params.toString()}`);
    
    if (!result.ok) {
      throw new Error(`Failed to fetch NPCs: ${result.error.message}`);
    }
    
    return result.data;
  }

  /**
   * Get a single NPC by ID
   */
  async getNPC(id: string): Promise<NPC> {
    const result = await apiGet<NPC>(`/api/admin/npcs/${id}`);
    
    if (!result.ok) {
      throw new Error(`Failed to fetch NPC: ${result.error.message}`);
    }
    
    return result.data;
  }

  /**
   * Create a new NPC
   */
  async createNPC(data: CreateNPCData): Promise<NPC> {
    // Prepare insert data
    const insertData: any = {
      name: data.name,
      description: data.description,
      status: data.status ?? 'draft'
    };

    if (data.slug) {
      insertData.slug = data.slug;
    }

    if (data.prompt) {
      insertData.prompt = data.prompt;
    }

    if (data.world_id) {
      insertData.world_id = data.world_id;
    }

    if (data.visibility) {
      insertData.visibility = data.visibility;
    }

    if (data.author_type) {
      insertData.author_type = data.author_type;
    }

    if (data.author_name) {
      insertData.author_name = data.author_name;
    }

    const result = await apiPost<NPC>('/api/admin/npcs', insertData);
    
    if (!result.ok) {
      throw new Error(`Failed to create NPC: ${result.error.message}`);
    }
    
    return result.data;
  }

  /**
   * Update an existing NPC
   */
  async updateNPC(id: string, data: UpdateNPCData): Promise<NPC> {
    const updateData: any = {};
    
    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    
    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    
    if (data.slug !== undefined) {
      updateData.slug = data.slug;
    }
    
    if (data.prompt !== undefined) {
      updateData.prompt = data.prompt;
    }

    if (data.world_id !== undefined) {
      updateData.world_id = data.world_id;
    }

    if (data.visibility !== undefined) {
      updateData.visibility = data.visibility;
    }

    if (data.author_type !== undefined) {
      updateData.author_type = data.author_type;
    }

    if (data.author_name !== undefined) {
      updateData.author_name = data.author_name;
    }

    const result = await apiPut<NPC>(`/api/admin/npcs/${id}`, updateData);
    
    if (!result.ok) {
      throw new Error(`Failed to update NPC: ${result.error.message}`);
    }
    
    return result.data;
  }

  /**
   * Delete an NPC
   */
  async deleteNPC(id: string): Promise<void> {
    const result = await apiDelete(`/api/admin/npcs/${id}`);
    
    if (!result.ok) {
      throw new Error(`Failed to delete NPC: ${result.error.message}`);
    }
  }

  /**
   * Get all active NPCs (for dropdowns)
   */
  async getActiveNPCs(): Promise<NPC[]> {
    const result = await apiGet<NPCListResponse>('/api/admin/npcs?status=active&limit=1000');
    
    if (!result.ok) {
      throw new Error(`Failed to fetch active NPCs: ${result.error.message}`);
    }
    
    return result.data.data || [];
  }

  /**
   * Toggle NPC status between active and archived
   */
  async toggleStatus(id: string): Promise<NPC> {
    // Get current status
    const current = await this.getNPC(id);
    const newStatus = current.status === 'active' ? 'archived' : 'active';
    
    return this.updateNPC(id, { status: newStatus });
  }
}

export const npcsService = new NPCsService();