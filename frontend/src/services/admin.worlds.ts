/**
 * Worlds Admin Service
 * CRUD operations for worlds management
 */

import { supabase } from '@/lib/supabase';

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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    let query = supabase
      .from('worlds_admin')
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
      .from('worlds_admin')
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

    // For create operations, we need to work with the worlds table directly
    // and handle the UUID mapping
    const worldId = crypto.randomUUID();
    const uuidId = crypto.randomUUID();
    
    // Generate a slug from the name
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const { data: result, error } = await supabase
      .from('worlds')
      .insert({
        id: worldId,
        name: data.name,
        slug: slug,
        description: data.description,
        status: data.status ?? 'active',
        version: 1,
        doc: data.prompt || {}
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create world: ${error.message}`);
    }

    // Create the mapping entry
    const { error: mappingError } = await supabase
      .from('world_id_mapping')
      .insert({
        text_id: worldId,
        uuid_id: uuidId
      });

    if (mappingError) {
      // If mapping creation fails, clean up the world
      await supabase.from('worlds').delete().eq('id', worldId);
      throw new Error(`Failed to create world mapping: ${mappingError.message}`);
    }

    // Return the result with the UUID ID
    return {
      ...result,
      id: uuidId
    };
  }

  /**
   * Update an existing world
   */
  async updateWorld(id: string, data: UpdateWorldData): Promise<World> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // For update operations, we need to work with the worlds table directly
    // First, get the current world to find the text ID
    const { data: currentWorld, error: fetchError } = await supabase
      .from('world_id_mapping')
      .select('text_id')
      .eq('uuid_id', id)
      .single();

    if (fetchError || !currentWorld) {
      throw new Error('World not found');
    }

    // Generate a slug from the name if name is being updated
    const updateData: any = {
      description: data.description,
      status: data.status,
      doc: data.prompt || {}
    };

    if (data.name) {
      updateData.name = data.name;
      updateData.slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    const { data: result, error } = await supabase
      .from('worlds')
      .update(updateData)
      .eq('id', currentWorld.text_id)
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

    // For delete operations, we need to work with the worlds table directly
    // First, get the current world to find the text ID
    const { data: currentWorld, error: fetchError } = await supabase
      .from('world_id_mapping')
      .select('text_id')
      .eq('uuid_id', id)
      .single();

    if (fetchError || !currentWorld) {
      throw new Error('World not found');
    }

    const { error } = await supabase
      .from('worlds')
      .delete()
      .eq('id', currentWorld.text_id);

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
      .from('worlds_admin')
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