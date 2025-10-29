/**
 * Entry Points Admin Service
 * Phase 3: CRUD operations for entry points management
 */

import { apiGet } from '@/lib/api';
import { adminSupabase } from '@/lib/supabase';
import { worldsService } from './admin.worlds';

export interface EntryPoint {
  id: string;
  name: string;
  slug?: string; // Optional - will be added via migration
  type?: 'adventure' | 'scenario' | 'sandbox' | 'quest';
  world_id?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  synopsis?: string;
  tags?: string[];
  visibility?: 'public' | 'unlisted' | 'private';
  content_rating?: string;
  lifecycle?: 'draft' | 'pending_review' | 'changes_requested' | 'active' | 'archived' | 'rejected';
  owner_user_id?: string; // Optional - may not exist in current schema
  prompt?: any; // JSONB - Turn 1 injection JSON data
  entry_id?: string; // Reference to the entry this point initializes
  created_at: string;
  updated_at?: string;
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
  prompt?: any; // JSONB - Turn 1 injection JSON data
  entry_id?: string; // Reference to the entry this point initializes
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
      let query = adminSupabase
        .from('entry_points')
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
   * List entry points with filters and pagination
   */
  async listEntryPoints(
    filters: EntryPointFilters = {},
    page = 1,
    pageSize = 20
  ): Promise<EntryPointListResponse> {
    const params = new URLSearchParams();
    
    if (filters.lifecycle && filters.lifecycle.length > 0) {
      filters.lifecycle.forEach(l => params.append('lifecycle', l));
    }
    
    if (filters.visibility && filters.visibility.length > 0) {
      filters.visibility.forEach(v => params.append('visibility', v));
    }
    
    if (filters.world_id) {
      params.append('world_id', filters.world_id);
    }
    
    if (filters.type && filters.type.length > 0) {
      filters.type.forEach(t => params.append('type', t));
    }
    
    if (filters.search) {
      params.append('search', filters.search);
    }
    
    params.append('page', String(page));
    params.append('limit', String(pageSize));

    const result = await apiGet<EntryPointListResponse>(`/api/admin/entry-points?${params.toString()}`);
    
    if (!result.ok) {
      throw new Error(`Failed to fetch entry points: ${result.error.message}`);
    }
    
    return result.data;
  }

  /**
   * Get a single entry point by ID
   */
  async getEntryPoint(id: string): Promise<EntryPoint> {
    const result = await apiGet<EntryPoint>(`/api/admin/entry-points/${id}`);
    
    if (!result.ok) {
      throw new Error(`Failed to fetch entry point: ${result.error.message}`);
    }
    
    return result.data;
  }

  // Legacy method - keeping for compatibility but may need updating
  async getEntryPointWithRulesets(id: string): Promise<EntryPoint> {
    const entryPoint = await this.getEntryPoint(id);
    
    // TODO: Fetch rulesets separately if needed
    // For now, return entry point without rulesets
    return entryPoint;
  }

  // Old implementation kept for reference - remove after migration complete
  private async _getEntryPointLegacy(id: string): Promise<EntryPoint> {
    const { data: { session } } = await adminSupabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await adminSupabase
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
    const { data: { session } } = await adminSupabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Extract ruleset data
    const { rulesetIds, rulesetOrder, ...entryData } = data;

    // Generate slug if not provided
    const slug = data.slug || this.createSlugFromName(data.name);
    const uniqueSlug = await this.generateUniqueSlug(slug);

    // Prepare insert data - only include fields that exist in the database
    const insertData: any = {
      ...entryData,
      slug: uniqueSlug,
      lifecycle: 'draft'
    };

    // Only include owner_user_id if the column exists (optional)
    // Note: This field may not exist in the current schema
    // insertData.owner_user_id = session.user.id;

    const { data: result, error } = await adminSupabase
      .from('entry_points')
      .insert(insertData)
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

      const { error: rulesetError } = await adminSupabase
        .from('entry_point_rulesets')
        .insert(rulesetAssociations);

      if (rulesetError) {
        // Clean up the entry point if ruleset association fails
        await adminSupabase.from('entry_points').delete().eq('id', result.id);
        throw new Error(`Failed to create ruleset associations: ${rulesetError.message}`);
      }
    }

    return result;
  }

  /**
   * Update an entry point
   */
  async updateEntryPoint(id: string, data: UpdateEntryPointData): Promise<EntryPoint> {
    const { data: { session } } = await adminSupabase.auth.getSession();
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
    const { data: result, error } = await adminSupabase
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
      const { error: deleteError } = await adminSupabase
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

        const { error: rulesetError } = await adminSupabase
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
    const { data: { session } } = await adminSupabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Update lifecycle to pending_review
    const { error: updateError } = await adminSupabase
      .from('entry_points')
      .update({ lifecycle: 'pending_review' })
      .eq('id', id)
      .in('lifecycle', ['draft', 'changes_requested']);

    if (updateError) {
      throw new Error(`Failed to update lifecycle: ${updateError.message}`);
    }

    // Create content review (idempotent)
    const { error: reviewError } = await adminSupabase
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
    const { data: { session } } = await adminSupabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { error } = await adminSupabase
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
    try {
      const response = await worldsService.listWorlds({}, 1, 1000);
      return (response.data || []).map(world => ({
        id: world.id,
        name: world.name,
        slug: world.slug || ''
      }));
    } catch (error) {
      console.error('Error fetching worlds:', error);
      throw new Error(`Failed to fetch worlds: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get rulesets for typeahead
   */
  async getRulesets(): Promise<Array<{ id: string; name: string; slug: string }>> {
    const { data: { session } } = await adminSupabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await adminSupabase
      .from('rulesets')
      .select('id, name, slug')
      .eq('status', 'active')
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

  // ============================================================================
  // JSON CONFIGURATION METHODS
  // ============================================================================

  /**
   * Get entry point JSON for turn 1 injection
   */
  async getEntryPointJSON(entryPointId: string): Promise<any> {
    const { data, error } = await adminSupabase
      .from('entry_points')
      .select('prompt')
      .eq('id', entryPointId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch entry point JSON: ${error.message}`);
    }

    return data?.prompt || {};
  }

  /**
   * Get entry point JSON by entry ID
   */
  async getEntryPointJSONByEntryId(entryId: string): Promise<any> {
    const { data, error } = await adminSupabase
      .from('entry_points')
      .select('prompt')
      .eq('entry_id', entryId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch entry point JSON by entry ID: ${error.message}`);
    }

    return data?.prompt || {};
  }

  /**
   * Update entry point JSON configuration
   */
  async updateEntryPointJSON(entryPointId: string, jsonData: any): Promise<void> {
    const { data: { session } } = await adminSupabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { error } = await adminSupabase
      .from('entry_points')
      .update({ prompt: jsonData })
      .eq('id', entryPointId);

    if (error) {
      throw new Error(`Failed to update entry point JSON: ${error.message}`);
    }
  }

  /**
   * Validate JSON configuration
   */
  validateJSONConfiguration(jsonData: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!jsonData || typeof jsonData !== 'object') {
      errors.push('JSON data must be an object');
      return { valid: false, errors };
    }

    // Add specific validation rules for turn 1 injection JSON
    if (!jsonData.scenario && !jsonData.context) {
      errors.push('JSON must contain either "scenario" or "context" field');
    }

    if (jsonData.npcs && !Array.isArray(jsonData.npcs)) {
      errors.push('"npcs" field must be an array if present');
    }

    if (jsonData.environment && typeof jsonData.environment !== 'string') {
      errors.push('"environment" field must be a string if present');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get JSON template for new entry points
   */
  getJSONTemplate(): any {
    return {
      scenario: "You find yourself in a mysterious location...",
      context: {
        location: "Unknown",
        time: "Present",
        mood: "Mysterious"
      },
      npcs: [
        {
          name: "Guide",
          description: "A helpful character",
          role: "assistant"
        }
      ],
      environment: {
        setting: "Fantasy",
        atmosphere: "Mysterious",
        weather: "Clear"
      },
      starting_state: {
        player_health: 100,
        inventory: [],
        objectives: []
      }
    };
  }
}

export const entryPointsService = new EntryPointsService();
