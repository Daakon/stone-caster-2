/**
 * Rulesets Admin Service
 * CRUD operations for rulesets management
 */

import { supabase } from '@/lib/supabase';

export interface Ruleset {
  id: string;
  name: string;
  slug: string;
  description?: string;
  prompt?: any; // JSONB - can be any structured data
  status: 'draft' | 'active' | 'archived';
  version_major: number;
  version_minor: number;
  version_patch: number;
  version_semver: string;
  published_at?: string;
  is_mutable: boolean;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface RulesetFilters {
  status?: 'draft' | 'active' | 'archived';
  search?: string;
}

export interface CreateRulesetData {
  name: string;
  slug?: string; // Optional, will be auto-generated if not provided
  description?: string;
  prompt?: any; // JSONB - can be any structured data
  status?: 'draft' | 'active' | 'archived';
}

export interface UpdateRulesetData extends Partial<CreateRulesetData> {}

export interface RulesetListResponse {
  data: Ruleset[];
  count: number;
  hasMore: boolean;
}

export class RulesetsService {
  /**
   * Generate a unique slug from a name
   */
  private async generateUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      let query = supabase
        .from('rulesets')
        .select('id')
        .eq('slug', slug);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { error } = await query.single();

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
   * List rulesets with filters and pagination
   */
  async listRulesets(
    filters: RulesetFilters = {},
    page: number = 1,
    pageSize: number = 20
  ): Promise<RulesetListResponse> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    let query = supabase
      .from('rulesets')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false });

    // Apply filters
    if (filters.status !== undefined) {
      query = query.eq('status', filters.status);
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
      throw new Error(`Failed to fetch rulesets: ${error.message}`);
    }

    return {
      data: data || [],
      count: count || 0,
      hasMore: (count || 0) > page * pageSize
    };
  }

  /**
   * Get a single ruleset by ID
   */
  async getRuleset(id: string): Promise<Ruleset> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('rulesets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch ruleset: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new ruleset
   */
  async createRuleset(data: CreateRulesetData): Promise<Ruleset> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Generate slug if not provided
    const slug = data.slug || this.createSlugFromName(data.name);
    const uniqueSlug = await this.generateUniqueSlug(slug);

    const { data: result, error } = await supabase
      .from('rulesets')
      .insert({
        ...data,
        slug: uniqueSlug,
        status: data.status ?? 'active',
        owner_user_id: session.user.id
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create ruleset: ${error.message}`);
    }

    return result;
  }

  /**
   * Update an existing ruleset
   */
  async updateRuleset(id: string, data: UpdateRulesetData): Promise<Ruleset> {
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
      .from('rulesets')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update ruleset: ${error.message}`);
    }

    return result;
  }

  /**
   * Delete a ruleset
   */
  async deleteRuleset(id: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { error } = await supabase
      .from('rulesets')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete ruleset: ${error.message}`);
    }
  }

  /**
   * Get all active rulesets (for dropdowns)
   */
  async getActiveRulesets(): Promise<Ruleset[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('rulesets')
      .select('*')
      .eq('status', 'active')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch active rulesets: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Toggle ruleset status between active and archived
   */
  async toggleStatus(id: string): Promise<Ruleset> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Get current status
    const current = await this.getRuleset(id);
    const newStatus = current.status === 'active' ? 'archived' : 'active';
    
    const { data: result, error } = await supabase
      .from('rulesets')
      .update({ status: newStatus })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to toggle ruleset status: ${error.message}`);
    }

    return result;
  }

  /**
   * Publish a draft ruleset to active status
   */
  async publishRuleset(id: string): Promise<{ success: boolean; ruleset?: Ruleset; error?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase.rpc('publish_ruleset', { ruleset_id: id });

    if (error) {
      throw new Error(`Failed to publish ruleset: ${error.message}`);
    }

    if (!data.success) {
      return { success: false, error: data.error };
    }

    // Get the updated ruleset
    const updatedRuleset = await this.getRuleset(id);
    return { success: true, ruleset: updatedRuleset };
  }

  /**
   * Clone a ruleset with version bump
   */
  async cloneRuleset(
    id: string, 
    bumpType: 'major' | 'minor' | 'patch' = 'minor'
  ): Promise<{ success: boolean; newRuleset?: Ruleset; error?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase.rpc('clone_ruleset', { 
      ruleset_id: id, 
      bump_type: bumpType 
    });

    if (error) {
      throw new Error(`Failed to clone ruleset: ${error.message}`);
    }

    if (!data.success) {
      return { success: false, error: data.error };
    }

    // Get the new ruleset
    const newRuleset = await this.getRuleset(data.new_id);
    return { success: true, newRuleset };
  }

  /**
   * Get ruleset revision history
   */
  async getRulesetRevisions(rulesetId: string): Promise<Array<{
    id: string;
    snapshot: any;
    created_at: string;
    actor?: string;
  }>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('ruleset_revisions')
      .select('*')
      .eq('ruleset_id', rulesetId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch ruleset revisions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Check if ruleset can be edited (only drafts are mutable)
   */
  canEdit(ruleset: Ruleset): boolean {
    return ruleset.is_mutable && ruleset.status === 'draft';
  }
}

export const rulesetsService = new RulesetsService();




