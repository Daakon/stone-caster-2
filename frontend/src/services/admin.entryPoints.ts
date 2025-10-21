/**
 * Entry Points Admin Service
 * Phase 3: CRUD operations for entry points management
 */

import { supabase } from '@/lib/supabase';

export interface EntryPoint {
  id: string;
  slug: string;
  type: 'adventure' | 'scenario' | 'sandbox' | 'quest';
  world_id: string;
  ruleset_id: string;
  title: string;
  subtitle?: string;
  description: string;
  synopsis?: string;
  tags: string[];
  visibility: 'public' | 'unlisted' | 'private';
  content_rating: string;
  lifecycle: 'draft' | 'pending_review' | 'changes_requested' | 'active' | 'archived' | 'rejected';
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface EntryPointFilters {
  lifecycle?: string[];
  visibility?: string[];
  world_id?: string;
  type?: string[];
  tags?: string[];
  search?: string;
}

export interface CreateEntryPointData {
  slug: string;
  type: 'adventure' | 'scenario' | 'sandbox' | 'quest';
  world_id: string;
  ruleset_id: string;
  title: string;
  subtitle?: string;
  description: string;
  synopsis?: string;
  tags: string[];
  visibility: 'public' | 'unlisted' | 'private';
  content_rating: string;
}

export interface UpdateEntryPointData extends Partial<CreateEntryPointData> {
  lifecycle?: 'draft' | 'pending_review' | 'changes_requested' | 'active' | 'archived' | 'rejected';
}

export interface EntryPointListResponse {
  data: EntryPoint[];
  count: number;
  hasMore: boolean;
}

export class EntryPointsService {
  /**
   * List entry points with filters and pagination
   */
  async listEntryPoints(
    filters: EntryPointFilters = {},
    page = 1,
    pageSize = 20
  ): Promise<EntryPointListResponse> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    let query = supabase
      .from('entry_points')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false });

    // Apply filters
    if (filters.lifecycle && filters.lifecycle.length > 0) {
      query = query.in('lifecycle', filters.lifecycle);
    }

    if (filters.visibility && filters.visibility.length > 0) {
      query = query.in('visibility', filters.visibility);
    }

    if (filters.world_id) {
      query = query.eq('world_id', filters.world_id);
    }

    if (filters.type && filters.type.length > 0) {
      query = query.in('type', filters.type);
    }

    if (filters.tags && filters.tags.length > 0) {
      query = query.overlaps('tags', filters.tags);
    }

    if (filters.search) {
      query = query.textSearch('search_text', filters.search);
    }

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch entry points: ${error.message}`);
    }

    return {
      data: data || [],
      count: count || 0,
      hasMore: (count || 0) > page * pageSize
    };
  }

  /**
   * Get a single entry point by ID
   */
  async getEntryPoint(id: string): Promise<EntryPoint> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('entry_points')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch entry point: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new entry point
   */
  async createEntryPoint(data: CreateEntryPointData): Promise<EntryPoint> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data: result, error } = await supabase
      .from('entry_points')
      .insert({
        ...data,
        owner_user_id: session.user.id,
        lifecycle: 'draft'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create entry point: ${error.message}`);
    }

    return result;
  }

  /**
   * Update an entry point
   */
  async updateEntryPoint(id: string, data: UpdateEntryPointData): Promise<EntryPoint> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data: result, error } = await supabase
      .from('entry_points')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update entry point: ${error.message}`);
    }

    return result;
  }

  /**
   * Submit entry point for review
   */
  async submitForReview(id: string, note?: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Update lifecycle to pending_review
    const { error: updateError } = await supabase
      .from('entry_points')
      .update({ lifecycle: 'pending_review' })
      .eq('id', id)
      .eq('owner_user_id', session.user.id)
      .in('lifecycle', ['draft', 'changes_requested']);

    if (updateError) {
      throw new Error(`Failed to update lifecycle: ${updateError.message}`);
    }

    // Create content review (idempotent)
    const { error: reviewError } = await supabase
      .from('content_reviews')
      .upsert({
        target_type: 'entry_point',
        target_id: id,
        submitted_by: session.user.id,
        state: 'open',
        notes: note || null
      }, {
        onConflict: 'target_type,target_id,state'
      });

    if (reviewError) {
      throw new Error(`Failed to create review: ${reviewError.message}`);
    }
  }

  /**
   * Delete an entry point
   */
  async deleteEntryPoint(id: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { error } = await supabase
      .from('entry_points')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete entry point: ${error.message}`);
    }
  }

  /**
   * Get worlds for typeahead
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
   * Get rulesets for typeahead
   */
  async getRulesets(): Promise<Array<{ id: string; name: string }>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('core_rulesets')
      .select('id, doc')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch rulesets: ${error.message}`);
    }

    return (data || []).map(ruleset => ({
      id: ruleset.id,
      name: ruleset.doc?.name || ruleset.id
    }));
  }
}

export const entryPointsService = new EntryPointsService();
