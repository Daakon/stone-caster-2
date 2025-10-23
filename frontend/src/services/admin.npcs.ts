/**
 * NPCs Admin Service
 * CRUD operations for NPCs management
 */

import { supabase } from '@/lib/supabase';

export interface NPC {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'active' | 'archived';
  description?: string;
  prompt?: string;
  world_id?: string;
  user_id?: string;
  visibility: 'private' | 'public';
  author_name?: string;
  author_type: 'user' | 'system' | 'original';
  created_at: string;
  updated_at: string;
}

export interface NPCFilters {
  status?: 'draft' | 'active' | 'archived';
  visibility?: 'private' | 'public';
  author_type?: 'user' | 'system' | 'original';
  search?: string;
}

export interface CreateNPCData {
  name: string;
  description?: string;
  status?: 'draft' | 'active' | 'archived';
  prompt?: string;
  world_id?: string;
  visibility?: 'private' | 'public';
  author_name?: string;
  author_type?: 'user' | 'system' | 'original';
  user_id?: string; // Will be set automatically from auth
}

export interface UpdateNPCData extends Partial<CreateNPCData> {}

export interface NPCListResponse {
  data: NPC[];
  count: number;
  hasMore: boolean;
}

export class NPCsService {
  /**
   * List NPCs with filters and pagination (public NPCs + user's own private NPCs)
   */
  async listNPCs(
    filters: NPCFilters = {},
    page: number = 1,
    pageSize: number = 20
  ): Promise<NPCListResponse> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    let query = supabase
      .from('npcs')
      .select('*', { count: 'exact' })
      .or(`visibility.eq.public,and(visibility.eq.private,user_id.eq.${session.user.id})`) // Public NPCs + user's private NPCs
      .order('updated_at', { ascending: false });

    // Apply filters
    if (filters.status !== undefined) {
      query = query.eq('status', filters.status);
    }

    if (filters.visibility !== undefined) {
      query = query.eq('visibility', filters.visibility);
    }

    if (filters.author_type !== undefined) {
      query = query.eq('author_type', filters.author_type);
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
      throw new Error(`Failed to fetch NPCs: ${error.message}`);
    }

    return {
      data: data || [],
      count: count || 0,
      hasMore: (count || 0) > page * pageSize
    };
  }

  /**
   * Get a single NPC by ID (public NPCs + user's own private NPCs)
   */
  async getNPC(id: string): Promise<NPC> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('npcs')
      .select('*')
      .eq('id', id)
      .or(`visibility.eq.public,and(visibility.eq.private,user_id.eq.${session.user.id})`) // Public NPCs + user's private NPCs
      .single();

    if (error) {
      throw new Error(`Failed to fetch NPC: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new NPC (automatically assigns to current user)
   */
  async createNPC(data: CreateNPCData): Promise<NPC> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data: result, error } = await supabase
      .from('npcs')
      .insert({
        ...data,
        user_id: session.user.id, // Automatically assign to current user
        author_name: data.author_name || 'Player Character',
        author_type: data.author_type || 'user',
        visibility: data.visibility || 'private',
        status: data.status ?? 'active'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create NPC: ${error.message}`);
    }

    return result;
  }

  /**
   * Update an existing NPC (user's own NPCs only)
   */
  async updateNPC(id: string, data: UpdateNPCData): Promise<NPC> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data: result, error } = await supabase
      .from('npcs')
      .update(data)
      .eq('id', id)
      .eq('user_id', session.user.id) // Only user's own NPCs
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update NPC: ${error.message}`);
    }

    return result;
  }

  /**
   * Delete an NPC (user's own NPCs only)
   */
  async deleteNPC(id: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { error } = await supabase
      .from('npcs')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id); // Only user's own NPCs

    if (error) {
      throw new Error(`Failed to delete NPC: ${error.message}`);
    }
  }

  /**
   * Get all active NPCs for current user (for dropdowns)
   */
  async getActiveNPCs(): Promise<NPC[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('npcs')
      .select('*')
      .eq('user_id', session.user.id) // Only user's own NPCs
      .eq('status', 'active')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch active NPCs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Toggle NPC status between active and archived (user's own NPCs only)
   */
  async toggleStatus(id: string): Promise<NPC> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Get current status
    const current = await this.getNPC(id);
    const newStatus = current.status === 'active' ? 'archived' : 'active';
    
    const { data: result, error } = await supabase
      .from('npcs')
      .update({ status: newStatus })
      .eq('id', id)
      .eq('user_id', session.user.id) // Only user's own NPCs
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to toggle NPC status: ${error.message}`);
    }

    return result;
  }
}

export const npcsService = new NPCsService();