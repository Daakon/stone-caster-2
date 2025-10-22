/**
 * Worlds Admin Service
 * CRUD operations for worlds management
 */

import { supabase } from '@/lib/supabase';

export interface World {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'active' | 'archived';
  description?: string;
  prompt?: string;
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
  prompt?: string;
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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    let query = supabase
      .from('worlds')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false });

    // Apply filters
    if (filters.status !== undefined) {
      query = query.eq('status', filters.status);
    }

    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch worlds: ${error.message}`);
    }

    return {
      data: data || [],
      count: count || 0,
      hasMore: (count || 0) > page * pageSize
    };
  }

  /**
   * Get a single world by ID
   */
  async getWorld(id: string): Promise<World> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('worlds')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch world: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new world
   */
  async createWorld(data: CreateWorldData): Promise<World> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data: result, error } = await supabase
      .from('worlds')
      .insert({
        ...data,
        status: data.status ?? 'active'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create world: ${error.message}`);
    }

    return result;
  }

  /**
   * Update an existing world
   */
  async updateWorld(id: string, data: UpdateWorldData): Promise<World> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data: result, error } = await supabase
      .from('worlds')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update world: ${error.message}`);
    }

    return result;
  }

  /**
   * Delete a world
   */
  async deleteWorld(id: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { error } = await supabase
      .from('worlds')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete world: ${error.message}`);
    }
  }

  /**
   * Get all active worlds (for dropdowns)
   */
  async getActiveWorlds(): Promise<World[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('worlds')
      .select('*')
      .eq('status', 'active')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch active worlds: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Toggle world status between active and archived
   */
  async toggleStatus(id: string): Promise<World> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Get current status
    const current = await this.getWorld(id);
    const newStatus = current.status === 'active' ? 'archived' : 'active';
    
    const { data: result, error } = await supabase
      .from('worlds')
      .update({ status: newStatus })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to toggle world status: ${error.message}`);
    }

    return result;
  }
}

export const worldsService = new WorldsService();