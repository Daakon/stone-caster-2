/**
 * NPC Packs Admin Service
 * CRUD operations for NPC packs management
 */

import { supabase } from '@/lib/supabase';

export interface NPCPack {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'active' | 'archived';
  description?: string;
  created_at: string;
  updated_at: string;
  // Related data
  members?: Array<{
    id: string;
    name: string;
  }>;
}

export interface NPCPackFilters {
  status?: 'draft' | 'active' | 'archived';
  search?: string;
}

export interface CreateNPCPackData {
  name: string;
  description?: string;
  status?: 'draft' | 'active' | 'archived';
}

export interface UpdateNPCPackData extends Partial<CreateNPCPackData> {}

export interface NPCPackListResponse {
  data: NPCPack[];
  count: number;
  hasMore: boolean;
}

export class NPCPacksService {
  /**
   * List NPC packs with filters and pagination
   */
  async listNPCPacks(
    filters: NPCPackFilters = {},
    page: number = 1,
    pageSize: number = 20
  ): Promise<NPCPackListResponse> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    let query = supabase
      .from('npc_packs')
      .select(`
        *,
        members:npc_pack_members(
          npc:npcs(id, name)
        )
      `, { count: 'exact' })
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
      throw new Error(`Failed to fetch NPC packs: ${error.message}`);
    }

    return {
      data: data || [],
      count: count || 0,
      hasMore: (count || 0) > page * pageSize
    };
  }

  /**
   * Get a single NPC pack by ID
   */
  async getNPCPack(id: string): Promise<NPCPack> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('npc_packs')
      .select(`
        *,
        members:npc_pack_members(
          npc:npcs(id, name)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch NPC pack: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new NPC pack
   */
  async createNPCPack(data: CreateNPCPackData): Promise<NPCPack> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data: result, error } = await supabase
      .from('npc_packs')
      .insert({
        ...data,
        status: data.status ?? 'active'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create NPC pack: ${error.message}`);
    }

    return result;
  }

  /**
   * Update an existing NPC pack
   */
  async updateNPCPack(id: string, data: UpdateNPCPackData): Promise<NPCPack> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data: result, error } = await supabase
      .from('npc_packs')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update NPC pack: ${error.message}`);
    }

    return result;
  }

  /**
   * Delete an NPC pack
   */
  async deleteNPCPack(id: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { error } = await supabase
      .from('npc_packs')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete NPC pack: ${error.message}`);
    }
  }

  /**
   * Get all active NPC packs (for dropdowns)
   */
  async getActiveNPCPacks(): Promise<NPCPack[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('npc_packs')
      .select('*')
      .eq('status', 'active')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch active NPC packs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Add NPCs to a pack
   */
  async addNPCsToPack(packId: string, npcIds: string[]): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const members = npcIds.map(npcId => ({
      pack_id: packId,
      npc_id: npcId
    }));

    const { error } = await supabase
      .from('npc_pack_members')
      .insert(members);

    if (error) {
      throw new Error(`Failed to add NPCs to pack: ${error.message}`);
    }
  }

  /**
   * Remove NPCs from a pack
   */
  async removeNPCsFromPack(packId: string, npcIds: string[]): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { error } = await supabase
      .from('npc_pack_members')
      .delete()
      .eq('pack_id', packId)
      .in('npc_id', npcIds);

    if (error) {
      throw new Error(`Failed to remove NPCs from pack: ${error.message}`);
    }
  }

  /**
   * Toggle NPC pack status between active and archived
   */
  async toggleStatus(id: string): Promise<NPCPack> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Get current status
    const current = await this.getNPCPack(id);
    const newStatus = current.status === 'active' ? 'archived' : 'active';
    
    const { data: result, error } = await supabase
      .from('npc_packs')
      .update({ status: newStatus })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to toggle NPC pack status: ${error.message}`);
    }

    return result;
  }
}

export const npcPacksService = new NPCPacksService();
