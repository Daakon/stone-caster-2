/**
 * Worlds Admin Service
 * CRUD operations for worlds management
 */

import { supabase } from '@/lib/supabase';

export interface World {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: 'draft' | 'active' | 'archived';
  locale: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface WorldFilters {
  status?: string[];
  locale?: string[];
  search?: string;
}

export interface CreateWorldData {
  name: string;
  slug?: string; // Optional, will be auto-generated if not provided
  description?: string;
  status: 'draft' | 'active' | 'archived';
  locale: string;
}

export interface UpdateWorldData extends Partial<CreateWorldData> {}

export interface WorldListResponse {
  data: World[];
  count: number;
  hasMore: boolean;
}

export class WorldsService {
  /**
   * Generate a unique slug from a name
   */
  private async generateUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      let query = supabase
        .from('worlds')
        .select('id')
        .eq('slug', slug);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query.single();

      if (error && error.code === 'PGRST116') {
        // No existing slug found, we can use this one
        break;
      }

      if (error) {
        throw new Error(`Failed to check slug uniqueness: ${error.message}`);
      }

      // Slug exists, try with counter
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Create slug from name
   */
  private createSlugFromName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
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
    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    if (filters.locale && filters.locale.length > 0) {
      query = query.in('locale', filters.locale);
    }

    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,slug.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
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

    // Generate slug if not provided
    const slug = data.slug || this.createSlugFromName(data.name);
    const uniqueSlug = await this.generateUniqueSlug(slug);

    const { data: result, error } = await supabase
      .from('worlds')
      .insert({
        ...data,
        slug: uniqueSlug,
        owner_user_id: session.user.id
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

    // Handle slug updates
    let updateData = { ...data };
    if (data.slug || data.name) {
      const slug = data.slug || (data.name ? this.createSlugFromName(data.name) : undefined);
      if (slug) {
        updateData.slug = await this.generateUniqueSlug(slug, id);
      }
    }

    const { data: result, error } = await supabase
      .from('worlds')
      .update(updateData)
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
   * Get available locales
   */
  async getLocales(): Promise<string[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('worlds')
      .select('locale')
      .not('locale', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch locales: ${error.message}`);
    }

    const locales = [...new Set((data || []).map(item => item.locale))];
    return locales.sort();
  }
}

export const worldsService = new WorldsService();
