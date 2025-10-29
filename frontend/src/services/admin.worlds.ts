/**
 * Worlds Admin Service
 * CRUD operations for worlds management
 */

import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

export interface World {
  id: string;
  name: string;
  slug?: string; // Not always present in API response
  status: 'draft' | 'active' | 'archived';
  description?: string;
  prompt?: any; // JSONB - can be any structured data
  doc?: {
    prompt?: string; // The actual prompt data from the API
    [key: string]: any;
  };
  version?: string;
  created_at: string;
  updated_at: string;
}

export interface WorldFilters {
  status?: 'draft' | 'active' | 'archived';
  search?: string;
}

export interface CreateWorldData {
  name: string;
  description?: string;
  prompt?: any; // JSONB - can be any structured data
  status?: 'draft' | 'active' | 'archived';
}

export interface UpdateWorldData extends Partial<CreateWorldData> {}

export interface WorldListResponse {
  data: World[];
  count: number;
  hasMore: boolean;
}

export class WorldsService {
  /**
   * List worlds with filters and pagination
   */
  async listWorlds(
    filters: WorldFilters = {},
    page: number = 1,
    pageSize: number = 20
  ): Promise<WorldListResponse> {
    const params = new URLSearchParams();
    
    if (filters.status !== undefined) {
      params.append('status', filters.status);
    }
    
    if (filters.search) {
      params.append('search', filters.search);
    }
    
    params.append('page', page.toString());
    params.append('limit', pageSize.toString());
    
    const result = await apiGet<WorldListResponse>(`/api/admin/worlds?${params.toString()}`);
    
    if (!result.ok) {
      throw new Error(`Failed to fetch worlds: ${result.error.message}`);
    }
    
    return result.data;
  }

  /**
   * Get a single world by ID
   */
  async getWorld(id: string): Promise<World> {
    const result = await apiGet<World>(`/api/admin/worlds/${id}`);
    
    if (!result.ok) {
      throw new Error(`Failed to fetch world: ${result.error.message}`);
    }
    
    return result.data;
  }

  /**
   * Create a new world
   */
  async createWorld(data: CreateWorldData): Promise<World> {
    const result = await apiPost<World>('/api/admin/worlds', data);
    
    if (!result.ok) {
      throw new Error(`Failed to create world: ${result.error.message}`);
    }
    
    return result.data;
  }

  /**
   * Update an existing world
   */
  async updateWorld(id: string, data: UpdateWorldData): Promise<World> {
    const result = await apiPut<World>(`/api/admin/worlds/${id}`, data);
    
    if (!result.ok) {
      throw new Error(`Failed to update world: ${result.error.message}`);
    }
    
    return result.data;
  }

  /**
   * Delete a world
   */
  async deleteWorld(id: string): Promise<void> {
    const result = await apiDelete(`/api/admin/worlds/${id}`);
    
    if (!result.ok) {
      throw new Error(`Failed to delete world: ${result.error.message}`);
    }
  }

  /**
   * Get all active worlds (for dropdowns)
   */
  async getActiveWorlds(): Promise<World[]> {
    const result = await apiGet<WorldListResponse>('/api/admin/worlds?status=active&limit=100');
    
    if (!result.ok) {
      throw new Error(`Failed to fetch active worlds: ${result.error.message}`);
    }
    
    return result.data.data;
  }

  /**
   * Toggle world status between active and archived
   */
  async toggleStatus(id: string): Promise<World> {
    // Get current status
    const current = await this.getWorld(id);
    const newStatus = current.status === 'active' ? 'archived' : 'active';
    
    const result = await apiPut<World>(`/api/admin/worlds/${id}`, { status: newStatus });
    
    if (!result.ok) {
      throw new Error(`Failed to toggle world status: ${result.error.message}`);
    }
    
    return result.data;
  }
}

export const worldsService = new WorldsService();