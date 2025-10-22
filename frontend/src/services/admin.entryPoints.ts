/**
 * Entry Points Admin Service
 * Phase 3: CRUD operations for entry points management
 */

import { supabase } from '@/lib/supabase';

export interface EntryPoint {
  id: string;
  name: string;
  slug: string;
  type: 'adventure' | 'scenario' | 'sandbox' | 'quest';
  world_id: string;
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
  // Multi-ruleset support
  rulesets?: Array<{
    id: string;
    name: string;
    sort_order: number;
  }>;
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
  name: string;
  slug?: string; // Optional, will be auto-generated if not provided
  type: 'adventure' | 'scenario' | 'sandbox' | 'quest';
  world_id: string;
  rulesetIds: string[];
  rulesetOrder?: string[]; // Optional ordering, falls back to alphabetical
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
   * Generate a unique slug from a name
   */
  private async generateUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      let query = supabase
        .from('entry_points')
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
      query = query.or(`name.ilike.%${filters.search}%,slug.ilike.%${filters.search}%,title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
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
      .select(`
        *,
        rulesets:entry_point_rulesets (
          sort_order,
          ruleset:ruleset_id (
            id,
            name
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch entry point: ${error.message}`);
    }

    // Transform the rulesets data
    const rulesets = (data.rulesets || []).map((item: any) => ({
      id: item.ruleset.id,
      name: item.ruleset.name,
      sort_order: item.sort_order
    }));

    return {
      ...data,
      rulesets
    };
  }

  /**
   * Create a new entry point
   */
  async createEntryPoint(data: CreateEntryPointData): Promise<EntryPoint> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Extract ruleset data
    const { rulesetIds, rulesetOrder, ...entryData } = data;

    // Generate slug if not provided
    const slug = data.slug || this.createSlugFromName(data.name);
    const uniqueSlug = await this.generateUniqueSlug(slug);

    // Create the entry point
    const { data: result, error } = await supabase
      .from('entry_points')
      .insert({
        ...entryData,
        slug: uniqueSlug,
        owner_user_id: session.user.id,
        lifecycle: 'draft'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create entry point: ${error.message}`);
    }

    // Create ruleset associations
    if (rulesetIds && rulesetIds.length > 0) {
      const rulesetAssociations = rulesetIds.map((rulesetId, index) => ({
        entry_point_id: result.id,
        ruleset_id: rulesetId,
        sort_order: rulesetOrder ? rulesetOrder.indexOf(rulesetId) : index
      }));

      const { error: rulesetError } = await supabase
        .from('entry_point_rulesets')
        .insert(rulesetAssociations);

      if (rulesetError) {
        // Clean up the entry point if ruleset association fails
        await supabase.from('entry_points').delete().eq('id', result.id);
        throw new Error(`Failed to create ruleset associations: ${rulesetError.message}`);
      }
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

    // Extract ruleset data if present
    const { rulesetIds, rulesetOrder, ...entryData } = data;

    // Handle slug updates
    let updateData = { ...entryData };
    if (data.slug || data.name) {
      const slug = data.slug || (data.name ? this.createSlugFromName(data.name) : undefined);
      if (slug) {
        updateData.slug = await this.generateUniqueSlug(slug, id);
      }
    }

    // Update the entry point
    const { data: result, error } = await supabase
      .from('entry_points')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update entry point: ${error.message}`);
    }

    // Update ruleset associations if provided
    if (rulesetIds !== undefined) {
      // Delete existing associations
      const { error: deleteError } = await supabase
        .from('entry_point_rulesets')
        .delete()
        .eq('entry_point_id', id);

      if (deleteError) {
        throw new Error(`Failed to remove existing ruleset associations: ${deleteError.message}`);
      }

      // Create new associations
      if (rulesetIds.length > 0) {
        const rulesetAssociations = rulesetIds.map((rulesetId, index) => ({
          entry_point_id: id,
          ruleset_id: rulesetId,
          sort_order: rulesetOrder ? rulesetOrder.indexOf(rulesetId) : index
        }));

        const { error: rulesetError } = await supabase
          .from('entry_point_rulesets')
          .insert(rulesetAssociations);

        if (rulesetError) {
          throw new Error(`Failed to create ruleset associations: ${rulesetError.message}`);
        }
      }
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
  async getWorlds(): Promise<Array<{ id: string; name: string; slug: string }>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('worlds')
      .select('id, name, slug')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch worlds: ${error.message}`);
    }

    return (data || []).map(world => ({
      id: world.id,
      name: world.name,
      slug: world.slug
    }));
  }

  /**
   * Get rulesets for typeahead
   */
  async getRulesets(): Promise<Array<{ id: string; name: string; slug: string }>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('rulesets')
      .select('id, name, slug')
      .eq('active', true)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch rulesets: ${error.message}`);
    }

    return (data || []).map(ruleset => ({
      id: ruleset.id,
      name: ruleset.name,
      slug: ruleset.slug
    }));
  }
}

export const entryPointsService = new EntryPointsService();
