/**
 * Admin References Service
 * Phase 4: Lookup helpers for ref ID pickers
 */

import { supabase } from '@/lib/supabase';

export interface RefItem {
  id: string;
  name: string;
  type?: string;
  world_id?: string;
}

export interface SearchOptions {
  q?: string;
  world_id?: string;
  limit?: number;
}

export class RefsService {
  /**
   * Search worlds for picker
   */
  async searchWorlds(options: SearchOptions = {}): Promise<RefItem[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    let query = supabase
      .from('worlds')
      .select('id, doc')
      .order('created_at', { ascending: false });

    if (options.q) {
      query = query.or(`doc->>name.ilike.%${options.q}%,id.ilike.%${options.q}%`);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to search worlds: ${error.message}`);
    }

    return (data || []).map(world => ({
      id: world.id,
      name: world.doc?.name || world.id,
      type: 'world'
    }));
  }

  /**
   * Search rulesets for picker
   */
  async searchRulesets(options: SearchOptions = {}): Promise<RefItem[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    let query = supabase
      .from('core_rulesets')
      .select('id, doc')
      .order('created_at', { ascending: false });

    if (options.q) {
      query = query.or(`doc->>name.ilike.%${options.q}%,id.ilike.%${options.q}%`);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to search rulesets: ${error.message}`);
    }

    return (data || []).map(ruleset => ({
      id: ruleset.id,
      name: ruleset.doc?.name || ruleset.id,
      type: 'ruleset'
    }));
  }

  /**
   * Search entry points for picker
   */
  async searchEntryPoints(options: SearchOptions = {}): Promise<RefItem[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    let query = supabase
      .from('entry_points')
      .select('id, title, type, world_id')
      .order('updated_at', { ascending: false });

    if (options.q) {
      query = query.or(`title.ilike.%${options.q}%,id.ilike.%${options.q}%`);
    }

    if (options.world_id) {
      query = query.eq('world_id', options.world_id);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to search entry points: ${error.message}`);
    }

    return (data || []).map(entry => ({
      id: entry.id,
      name: `${entry.title} (${entry.type})`,
      type: entry.type,
      world_id: entry.world_id
    }));
  }

  /**
   * Search NPCs for picker
   */
  async searchNPCs(options: SearchOptions = {}): Promise<RefItem[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    let query = supabase
      .from('npcs')
      .select('id, doc')
      .order('created_at', { ascending: false });

    if (options.q) {
      query = query.or(`doc->>npc->>name.ilike.%${options.q}%,id.ilike.%${options.q}%`);
    }

    if (options.world_id) {
      query = query.eq('doc->>npc->>world_id', options.world_id);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to search NPCs: ${error.message}`);
    }

    return (data || []).map(npc => ({
      id: npc.id,
      name: npc.doc?.npc?.name || npc.id,
      type: 'npc',
      world_id: npc.doc?.npc?.world_id
    }));
  }

  /**
   * Get ref item by ID and type
   */
  async getRefItem(id: string, type: 'world' | 'ruleset' | 'entry' | 'npc'): Promise<RefItem | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    try {
      switch (type) {
        case 'world': {
          const { data, error } = await supabase
            .from('worlds')
            .select('id, doc')
            .eq('id', id)
            .single();

          if (error) return null;

          return {
            id: data.id,
            name: data.doc?.name || data.id,
            type: 'world'
          };
        }

        case 'ruleset': {
          const { data, error } = await supabase
            .from('core_rulesets')
            .select('id, doc')
            .eq('id', id)
            .single();

          if (error) return null;

          return {
            id: data.id,
            name: data.doc?.name || data.id,
            type: 'ruleset'
          };
        }

        case 'entry': {
          const { data, error } = await supabase
            .from('entry_points')
            .select('id, title, type, world_id')
            .eq('id', id)
            .single();

          if (error) return null;

          return {
            id: data.id,
            name: `${data.title} (${data.type})`,
            type: data.type,
            world_id: data.world_id
          };
        }

        case 'npc': {
          const { data, error } = await supabase
            .from('npcs')
            .select('id, doc')
            .eq('id', id)
            .single();

          if (error) return null;

          return {
            id: data.id,
            name: data.doc?.npc?.name || data.id,
            type: 'npc',
            world_id: data.doc?.npc?.world_id
          };
        }

        default:
          return null;
      }
    } catch (error) {
      console.error('Error fetching ref item:', error);
      return null;
    }
  }

  /**
   * Get available worlds for filtering
   */
  async getWorldsForFilter(): Promise<RefItem[]> {
    return this.searchWorlds({ limit: 100 });
  }

  /**
   * Get available rulesets for filtering
   */
  async getRulesetsForFilter(): Promise<RefItem[]> {
    return this.searchRulesets({ limit: 100 });
  }

  /**
   * Get available entry points for filtering
   */
  async getEntryPointsForFilter(worldId?: string): Promise<RefItem[]> {
    return this.searchEntryPoints({ world_id: worldId, limit: 100 });
  }

  /**
   * Get available NPCs for filtering
   */
  async getNPCsForFilter(worldId?: string): Promise<RefItem[]> {
    return this.searchNPCs({ world_id: worldId, limit: 100 });
  }
}

export const refsService = new RefsService();




