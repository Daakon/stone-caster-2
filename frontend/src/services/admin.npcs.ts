/**
 * NPCs Admin Service
 * Phase 6: NPC catalog and management with world-scoped operations
 */

import { supabase } from '@/lib/supabase';

export interface NPC {
  id: string;
  world_id: string;
  name: string;
  archetype?: string;
  role_tags: string[];
  portrait_url?: string;
  doc: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Joined data
  world_name?: string;
}

export interface NPCFilters {
  worldId?: string;
  q?: string;
  tags?: string[];
  limit?: number;
  cursor?: string;
}

export interface NPCListResponse {
  data: NPC[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface CreateNPCPayload {
  id: string;
  world_id: string;
  name: string;
  archetype?: string;
  role_tags?: string[];
  portrait_url?: string;
  doc?: Record<string, any>;
}

export interface UpdateNPCPayload {
  name?: string;
  archetype?: string;
  role_tags?: string[];
  portrait_url?: string;
  world_id?: string;
  doc?: Record<string, any>;
}

export class NPCsService {
  /**
   * List NPCs with filters and pagination
   */
  async listNPCs(filters: NPCFilters = {}): Promise<NPCListResponse> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    let query = supabase
      .from('npcs')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false });

    // Apply filters
    if (filters.worldId) {
      query = query.eq('doc->npc->world_id', filters.worldId);
    }

    if (filters.tags && filters.tags.length > 0) {
      query = query.overlaps('doc->npc->tags', filters.tags);
    }

    if (filters.q) {
      query = query.or(`doc->npc->name.ilike.%${filters.q}%,doc->npc->archetype.ilike.%${filters.q}%`);
    }

    // Apply pagination
    const limit = filters.limit || 20;
    if (filters.cursor) {
      query = query.lt('updated_at', filters.cursor);
    }
    query = query.limit(limit + 1);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch NPCs: ${error.message}`);
    }

    const hasMore = (data || []).length > limit;
    const npcs = hasMore ? (data || []).slice(0, limit) : (data || []);
    const nextCursor = hasMore ? npcs[npcs.length - 1]?.updated_at : undefined;

    // Transform data for display
    const transformedNPCs = npcs.map(npc => {
      const npcData = npc.doc?.npc || {};
      return {
        ...npc,
        name: npcData.name || npc.id,
        archetype: npcData.archetype,
        role_tags: npcData.tags || [],
        world_id: npcData.world_id,
        world_name: npcData.world_name || npcData.world_id
      };
    });

    return {
      data: transformedNPCs,
      hasMore,
      nextCursor
    };
  }

  /**
   * Get single NPC by ID
   */
  async getNPC(id: string): Promise<NPC | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('npcs')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch NPC: ${error.message}`);
    }

    if (!data) return null;

    const npcData = data.doc?.npc || {};
    return {
      ...data,
      name: npcData.name || data.id,
      archetype: npcData.archetype,
      role_tags: npcData.tags || [],
      world_id: npcData.world_id,
      world_name: npcData.world_name || npcData.world_id
    };
  }

  /**
   * Create new NPC
   */
  async createNPC(payload: CreateNPCPayload): Promise<NPC> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('npcs')
      .insert({
        id: payload.id,
        version: '1.0.0',
        doc: {
          npc: {
            name: payload.name,
            archetype: payload.archetype,
            world_id: payload.world_id,
            tags: payload.role_tags || [],
            ...payload.doc
          }
        }
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create NPC: ${error.message}`);
    }

    const npcData = data.doc?.npc || {};
    return {
      ...data,
      name: npcData.name || data.id,
      archetype: npcData.archetype,
      role_tags: npcData.tags || [],
      world_id: npcData.world_id,
      world_name: npcData.world_name || npcData.world_id
    };
  }

  /**
   * Update existing NPC
   */
  async updateNPC(id: string, payload: UpdateNPCPayload): Promise<NPC> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('npcs')
      .update({
        doc: {
          npc: {
            name: payload.name,
            archetype: payload.archetype,
            world_id: payload.world_id,
            tags: payload.role_tags || [],
            ...payload.doc
          }
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update NPC: ${error.message}`);
    }

    const npcData = data.doc?.npc || {};
    return {
      ...data,
      name: npcData.name || data.id,
      archetype: npcData.archetype,
      role_tags: npcData.tags || [],
      world_id: npcData.world_id,
      world_name: npcData.world_name || npcData.world_id
    };
  }

  /**
   * Delete NPC (with binding checks)
   */
  async deleteNPC(id: string, force: boolean = false): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Check for existing bindings
    const { data: bindings, error: bindingsError } = await supabase
      .from('entry_point_npcs')
      .select('id')
      .eq('npc_id', id)
      .limit(1);

    if (bindingsError) {
      throw new Error(`Failed to check NPC bindings: ${bindingsError.message}`);
    }

    if (bindings && bindings.length > 0 && !force) {
      throw new Error('Cannot delete NPC with existing bindings. Use force=true to delete anyway.');
    }

    // Delete bindings first if force is true
    if (force && bindings && bindings.length > 0) {
      const { error: deleteBindingsError } = await supabase
        .from('entry_point_npcs')
        .delete()
        .eq('npc_id', id);

      if (deleteBindingsError) {
        throw new Error(`Failed to delete NPC bindings: ${deleteBindingsError.message}`);
      }
    }

    // Delete NPC
    const { error } = await supabase
      .from('npcs')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete NPC: ${error.message}`);
    }
  }

  /**
   * Upload portrait image
   */
  async updatePortrait(id: string, file: File): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Validate file type and size
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      throw new Error('File size too large. Maximum 5MB allowed.');
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${id}-${Date.now()}.${fileExt}`;
    const filePath = `npc_portraits/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('npc_portraits')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload portrait: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('npc_portraits')
      .getPublicUrl(filePath);

    const portraitUrl = urlData.publicUrl;

    // Update NPC with new portrait URL
    await this.updateNPC(id, { portrait_url: portraitUrl });

    return portraitUrl;
  }

  /**
   * Get available worlds for filtering
   */
  async getWorlds(): Promise<Array<{ id: string; name: string }>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('worlds')
      .select('id, doc')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch worlds: ${error.message}`);
    }

    return (data || []).map(world => ({
      id: world.id,
      name: world.doc?.name || world.id
    }));
  }

  /**
   * Get available role tags
   */
  async getRoleTags(): Promise<string[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('npcs')
      .select('doc');

    if (error) {
      throw new Error(`Failed to fetch role tags: ${error.message}`);
    }

    const allTags = new Set<string>();
    (data || []).forEach(npc => {
      const tags = npc.doc?.npc?.tags || [];
      if (Array.isArray(tags)) {
        tags.forEach(tag => allTags.add(tag));
      }
    });

    return Array.from(allTags).sort();
  }

  /**
   * Get NPC bindings count
   */
  async getNPCBindingsCount(id: string): Promise<number> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { count, error } = await supabase
      .from('entry_point_npcs')
      .select('*', { count: 'exact', head: true })
      .eq('npc_id', id);

    if (error) {
      throw new Error(`Failed to count NPC bindings: ${error.message}`);
    }

    return count || 0;
  }
}

export const npcsService = new NPCsService();
