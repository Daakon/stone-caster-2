/**
 * NPC Bindings Service
 * Phase 6: NPC bindings to entry points with role hints and weights
 */

import { supabase } from '@/lib/supabase';

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

export interface CreateNPCBindingPayload {
  entry_point_id: string;
  npc_id: string;
  role_hint: string;
  weight?: number;
}

export interface UpdateNPCBindingPayload {
  role_hint?: string;
  weight?: number;
}

export interface NPCBindingFilters {
  npcId?: string;
  entryPointId?: string;
  worldId?: string;
}

export class NPCBindingsService {
  /**
   * List NPC bindings with filters
   */
  async listNPCBindings(filters: NPCBindingFilters = {}): Promise<NPCBinding[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    let query = supabase
      .from('entry_point_npcs')
      .select(`
        *,
        entry_point:entry_point_id (
          id,
          title,
          type,
          world_id
        ),
        npc:npc_id (
          id,
          name,
          world_id
        )
      `)
      .order('created_at', { ascending: false });

    if (filters.npcId) {
      query = query.eq('npc_id', filters.npcId);
    }

    if (filters.entryPointId) {
      query = query.eq('entry_point_id', filters.entryPointId);
    }

    if (filters.worldId) {
      query = query.eq('entry_point.world_id', filters.worldId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch NPC bindings: ${error.message}`);
    }

    // Transform data for display
    return (data || []).map(binding => ({
      ...binding,
      entry_point_title: binding.entry_point?.title || 'Unknown',
      entry_point_type: binding.entry_point?.type || 'unknown',
      npc_name: binding.npc?.name || 'Unknown',
      world_id: binding.entry_point?.world_id || binding.npc?.world_id
    }));
  }

  /**
   * Get single NPC binding
   */
  async getNPCBinding(id: string): Promise<NPCBinding | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('entry_point_npcs')
      .select(`
        *,
        entry_point:entry_point_id (
          id,
          title,
          type,
          world_id
        ),
        npc:npc_id (
          id,
          name,
          world_id
        )
      `)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch NPC binding: ${error.message}`);
    }

    if (!data) return null;

    return {
      ...data,
      entry_point_title: data.entry_point?.title || 'Unknown',
      entry_point_type: data.entry_point?.type || 'unknown',
      npc_name: data.npc?.name || 'Unknown',
      world_id: data.entry_point?.world_id || data.npc?.world_id
    };
  }

  /**
   * Create NPC binding
   */
  async createNPCBinding(payload: CreateNPCBindingPayload): Promise<NPCBinding> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Validate world consistency
    await this.validateWorldConsistency(payload.entry_point_id, payload.npc_id);

    // Check for duplicate binding
    await this.checkDuplicateBinding(payload.entry_point_id, payload.npc_id);

    const { data, error } = await supabase
      .from('entry_point_npcs')
      .insert({
        entry_point_id: payload.entry_point_id,
        npc_id: payload.npc_id,
        role_hint: payload.role_hint,
        weight: payload.weight || 1
      })
      .select(`
        *,
        entry_point:entry_point_id (
          id,
          title,
          type,
          world_id
        ),
        npc:npc_id (
          id,
          name,
          world_id
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to create NPC binding: ${error.message}`);
    }

    return {
      ...data,
      entry_point_title: data.entry_point?.title || 'Unknown',
      entry_point_type: data.entry_point?.type || 'unknown',
      npc_name: data.npc?.name || 'Unknown',
      world_id: data.entry_point?.world_id || data.npc?.world_id
    };
  }

  /**
   * Update NPC binding
   */
  async updateNPCBinding(id: string, payload: UpdateNPCBindingPayload): Promise<NPCBinding> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('entry_point_npcs')
      .update({
        ...payload,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        entry_point:entry_point_id (
          id,
          title,
          type,
          world_id
        ),
        npc:npc_id (
          id,
          name,
          world_id
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to update NPC binding: ${error.message}`);
    }

    return {
      ...data,
      entry_point_title: data.entry_point?.title || 'Unknown',
      entry_point_type: data.entry_point?.type || 'unknown',
      npc_name: data.npc?.name || 'Unknown',
      world_id: data.entry_point?.world_id || data.npc?.world_id
    };
  }

  /**
   * Delete NPC binding
   */
  async deleteNPCBinding(id: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { error } = await supabase
      .from('entry_point_npcs')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete NPC binding: ${error.message}`);
    }
  }

  /**
   * Get entry points for NPC binding (same world)
   */
  async getEntryPointsForNPC(npcId: string): Promise<Array<{ id: string; title: string; type: string; world_id: string }>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Get NPC's world
    const { data: npc, error: npcError } = await supabase
      .from('npcs')
      .select('world_id')
      .eq('id', npcId)
      .single();

    if (npcError) {
      throw new Error(`Failed to fetch NPC: ${npcError.message}`);
    }

    if (!npc) {
      throw new Error('NPC not found');
    }

    // Get entry points in same world
    const { data, error } = await supabase
      .from('entry_points')
      .select('id, title, type, world_id')
      .eq('world_id', npc.world_id)
      .order('title');

    if (error) {
      throw new Error(`Failed to fetch entry points: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get NPCs for entry point binding (same world)
   */
  async getNPCsForEntryPoint(entryPointId: string): Promise<Array<{ id: string; name: string; world_id: string }>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Get entry point's world
    const { data: entryPoint, error: entryPointError } = await supabase
      .from('entry_points')
      .select('world_id')
      .eq('id', entryPointId)
      .single();

    if (entryPointError) {
      throw new Error(`Failed to fetch entry point: ${entryPointError.message}`);
    }

    if (!entryPoint) {
      throw new Error('Entry point not found');
    }

    // Get NPCs in same world
    const { data, error } = await supabase
      .from('npcs')
      .select('id, name, world_id')
      .eq('world_id', entryPoint.world_id)
      .order('name');

    if (error) {
      throw new Error(`Failed to fetch NPCs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Validate world consistency between entry point and NPC
   */
  private async validateWorldConsistency(entryPointId: string, npcId: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Get both world IDs
    const [entryPointResult, npcResult] = await Promise.all([
      supabase.from('entry_points').select('world_id').eq('id', entryPointId).single(),
      supabase.from('npcs').select('world_id').eq('id', npcId).single()
    ]);

    if (entryPointResult.error) {
      throw new Error(`Failed to fetch entry point: ${entryPointResult.error.message}`);
    }

    if (npcResult.error) {
      throw new Error(`Failed to fetch NPC: ${npcResult.error.message}`);
    }

    if (!entryPointResult.data || !npcResult.data) {
      throw new Error('Entry point or NPC not found');
    }

    if (entryPointResult.data.world_id !== npcResult.data.world_id) {
      throw new Error('Entry point and NPC must be in the same world');
    }
  }

  /**
   * Check for duplicate binding
   */
  private async checkDuplicateBinding(entryPointId: string, npcId: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('entry_point_npcs')
      .select('id')
      .eq('entry_point_id', entryPointId)
      .eq('npc_id', npcId)
      .limit(1);

    if (error) {
      throw new Error(`Failed to check for duplicate binding: ${error.message}`);
    }

    if (data && data.length > 0) {
      throw new Error('NPC is already bound to this entry point');
    }
  }

  /**
   * Get binding statistics
   */
  async getBindingStats(): Promise<{
    totalBindings: number;
    npcsWithBindings: number;
    entryPointsWithBindings: number;
  }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const [bindingsResult, npcsResult, entryPointsResult] = await Promise.all([
      supabase.from('entry_point_npcs').select('*', { count: 'exact', head: true }),
      supabase.from('entry_point_npcs').select('npc_id', { count: 'exact' }).not('npc_id', 'is', null),
      supabase.from('entry_point_npcs').select('entry_point_id', { count: 'exact' }).not('entry_point_id', 'is', null)
    ]);

    if (bindingsResult.error) {
      throw new Error(`Failed to fetch binding stats: ${bindingsResult.error.message}`);
    }

    return {
      totalBindings: bindingsResult.count || 0,
      npcsWithBindings: npcsResult.count || 0,
      entryPointsWithBindings: entryPointsResult.count || 0
    };
  }
}

export const npcBindingsService = new NPCBindingsService();