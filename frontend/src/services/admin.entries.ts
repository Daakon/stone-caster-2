/**
 * Entries Admin Service
 * CRUD operations for entries management
 */

import { supabase } from '@/lib/supabase';

export interface Entry {
  id: string;
  name: string;
  slug: string;
  world_text_id: string;
  status: 'draft' | 'active' | 'archived';
  description?: string;
  prompt?: any; // JSONB - AI instructions for the adventure
  tags?: string[]; // Array of tags for filtering and discovery
  difficulty?: 'easy' | 'medium' | 'hard'; // Difficulty level
  visibility?: 'public' | 'unlisted' | 'private'; // Visibility setting
  entry_point_id?: string; // Reference to entry point JSON for initialization
  created_at: string;
  updated_at: string;
  // Related data
  world?: {
    id: string;
    name: string;
  };
  rulesets?: Array<{
    id: string;
    name: string;
    sort_order: number;
  }>;
  npcs?: Array<{
    id: string;
    name: string;
  }>;
  npc_packs?: Array<{
    id: string;
    name: string;
  }>;
  entry_point?: {
    id: string;
    prompt: any; // JSONB - Turn 1 injection data
  };
}

export interface EntryFilters {
  status?: 'draft' | 'active' | 'archived';
  world_text_id?: string;
  search?: string;
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  visibility?: 'public' | 'unlisted' | 'private';
}

export interface CreateEntryData {
  name: string;
  world_text_id: string;
  description?: string;
  prompt?: any; // JSONB - AI instructions
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  visibility?: 'public' | 'unlisted' | 'private';
  status?: 'draft' | 'active' | 'archived';
}

export interface UpdateEntryData extends Partial<CreateEntryData> {}

export interface EntryListResponse {
  data: Entry[];
  count: number;
  hasMore: boolean;
}

export class EntriesService {
  /**
   * List entries with filters and pagination
   */
  async listEntries(
    filters: EntryFilters = {},
    page: number = 1,
    pageSize: number = 20
  ): Promise<EntryListResponse> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    let query = supabase
      .from('entries')
      .select(`
        *,
        world:worlds(id, name),
        rulesets:entry_rulesets(
          ruleset:rulesets(id, name),
          sort_order
        ),
        npcs:entry_npcs(
          npc:npcs(id, name)
        ),
        npc_packs:entry_npc_packs(
          pack:npc_packs(id, name)
        )
      `, { count: 'exact' })
      .order('updated_at', { ascending: false });

    // Apply filters
    if (filters.status !== undefined) {
      query = query.eq('status', filters.status);
    }

    if (filters.world_text_id) {
      query = query.eq('world_text_id', filters.world_text_id);
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
      throw new Error(`Failed to fetch entries: ${error.message}`);
    }

    return {
      data: data || [],
      count: count || 0,
      hasMore: (count || 0) > page * pageSize
    };
  }

  /**
   * Get a single entry by ID
   */
  async getEntry(id: string): Promise<Entry> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('entries')
      .select(`
        *,
        world:worlds(id, name),
        rulesets:entry_rulesets(
          ruleset:rulesets(id, name),
          sort_order
        ),
        npcs:entry_npcs(
          npc:npcs(id, name)
        ),
        npc_packs:entry_npc_packs(
          pack:npc_packs(id, name)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch entry: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new entry
   */
  async createEntry(data: CreateEntryData): Promise<Entry> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data: result, error } = await supabase
      .from('entries')
      .insert({
        ...data,
        status: data.status ?? 'draft'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create entry: ${error.message}`);
    }

    return result;
  }

  /**
   * Update an existing entry
   */
  async updateEntry(id: string, data: UpdateEntryData): Promise<Entry> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data: result, error } = await supabase
      .from('entries')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update entry: ${error.message}`);
    }

    return result;
  }

  /**
   * Delete an entry
   */
  async deleteEntry(id: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { error } = await supabase
      .from('entries')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete entry: ${error.message}`);
    }
  }

  /**
   * Toggle entry status between active and archived
   */
  async toggleStatus(id: string): Promise<Entry> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Get current status
    const current = await this.getEntry(id);
    const newStatus = current.status === 'active' ? 'archived' : 'active';
    
    const { data: result, error } = await supabase
      .from('entries')
      .update({ status: newStatus })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to toggle entry status: ${error.message}`);
    }

    return result;
  }

  // ============================================================================
  // PLAYER-FACING METHODS
  // ============================================================================

  /**
   * Get public entries for player discovery (no auth required)
   */
  async getPublicEntries(
    filters: EntryFilters = {},
    page = 1,
    pageSize = 20
  ): Promise<EntryListResponse> {
    let query = supabase
      .from('entries')
      .select(`
        *,
        world:worlds(name),
        entry_point:entry_points(id, prompt)
      `, { count: 'exact' })
      .eq('status', 'active')
      .eq('visibility', 'public')
      .order('updated_at', { ascending: false });

    // Apply filters
    if (filters.world_text_id) {
      query = query.eq('world_text_id', filters.world_text_id);
    }

    if (filters.difficulty) {
      query = query.eq('difficulty', filters.difficulty);
    }

    if (filters.tags && filters.tags.length > 0) {
      query = query.overlaps('tags', filters.tags);
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
      throw new Error(`Failed to fetch public entries: ${error.message}`);
    }

    return {
      data: data || [],
      count: count || 0,
      hasMore: (count || 0) > page * pageSize
    };
  }

  /**
   * Search entries for player discovery
   */
  async searchEntries(
    searchQuery: string,
    filters: EntryFilters = {},
    page = 1,
    pageSize = 20
  ): Promise<EntryListResponse> {
    return this.getPublicEntries({
      ...filters,
      search: searchQuery
    }, page, pageSize);
  }

  /**
   * Get entry with entry point for starting an adventure
   */
  async getEntryForStarting(entryId: string): Promise<Entry> {
    const { data, error } = await supabase
      .from('entries')
      .select(`
        *,
        world:worlds(name),
        entry_point:entry_points(id, prompt)
      `)
      .eq('id', entryId)
      .eq('status', 'active')
      .eq('visibility', 'public')
      .single();

    if (error) {
      throw new Error(`Failed to fetch entry for starting: ${error.message}`);
    }

    if (!data) {
      throw new Error('Entry not found or not available');
    }

    return data;
  }

  /**
   * Get available tags for filtering
   */
  async getAvailableTags(): Promise<string[]> {
    const { data, error } = await supabase
      .from('entries')
      .select('tags')
      .eq('status', 'active')
      .eq('visibility', 'public');

    if (error) {
      throw new Error(`Failed to fetch tags: ${error.message}`);
    }

    // Flatten and deduplicate tags
    const allTags = data?.flatMap(entry => entry.tags || []) || [];
    return [...new Set(allTags)].sort();
  }

  /**
   * Get available difficulties for filtering
   */
  async getAvailableDifficulties(): Promise<string[]> {
    const { data, error } = await supabase
      .from('entries')
      .select('difficulty')
      .eq('status', 'active')
      .eq('visibility', 'public');

    if (error) {
      throw new Error(`Failed to fetch difficulties: ${error.message}`);
    }

    // Get unique difficulties
    const difficulties = [...new Set(data?.map(entry => entry.difficulty).filter(Boolean))];
    return difficulties.sort();
  }
}

export const entriesService = new EntriesService();
