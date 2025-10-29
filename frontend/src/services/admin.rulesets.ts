/**
 * Rulesets Admin Service
 * CRUD operations for rulesets management
 */

import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

export interface Ruleset {
  id: string;
  name: string;
  slug: string;
  description?: string;
  prompt?: any; // JSONB - can be any structured data (will be added via migration)
  status: 'draft' | 'active' | 'archived';
  version: number; // Legacy version field
  version_major?: number;
  version_minor?: number;
  version_patch?: number;
  version_semver?: string;
  published_at?: string;
  is_mutable?: boolean;
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
   * List rulesets with filters and pagination
   */
  async listRulesets(
    filters: RulesetFilters = {},
    page: number = 1,
    pageSize: number = 20
  ): Promise<RulesetListResponse> {
    const params = new URLSearchParams();
    
    if (filters.status !== undefined) {
      params.append('status', filters.status);
    }
    
    if (filters.search) {
      params.append('search', filters.search);
    }
    
    params.append('page', page.toString());
    params.append('limit', pageSize.toString());
    
    const result = await apiGet<RulesetListResponse>(`/api/admin/rulesets?${params.toString()}`);
    
    if (!result.ok) {
      throw new Error(`Failed to fetch rulesets: ${result.error.message}`);
    }
    
    return result.data;
  }

  /**
   * Get a single ruleset by ID
   */
  async getRuleset(id: string): Promise<Ruleset> {
    const result = await apiGet<Ruleset>(`/api/admin/rulesets/${id}`);
    
    if (!result.ok) {
      throw new Error(`Failed to fetch ruleset: ${result.error.message}`);
    }
    
    return result.data;
  }

  /**
   * Create a new ruleset
   */
  async createRuleset(data: CreateRulesetData): Promise<Ruleset> {
    const result = await apiPost<Ruleset>('/api/admin/rulesets', data);
    
    if (!result.ok) {
      throw new Error(`Failed to create ruleset: ${result.error.message}`);
    }
    
    return result.data;
  }

  /**
   * Update an existing ruleset
   */
  async updateRuleset(id: string, data: UpdateRulesetData): Promise<Ruleset> {
    const result = await apiPut<Ruleset>(`/api/admin/rulesets/${id}`, data);
    
    if (!result.ok) {
      throw new Error(`Failed to update ruleset: ${result.error.message}`);
    }
    
    return result.data;
  }

  /**
   * Delete a ruleset
   */
  async deleteRuleset(id: string): Promise<void> {
    const result = await apiDelete(`/api/admin/rulesets/${id}`);
    
    if (!result.ok) {
      throw new Error(`Failed to delete ruleset: ${result.error.message}`);
    }
  }

  /**
   * Get all active rulesets (for dropdowns)
   */
  async getActiveRulesets(): Promise<Ruleset[]> {
    const result = await apiGet<RulesetListResponse>('/api/admin/rulesets?status=active&limit=100');
    
    if (!result.ok) {
      throw new Error(`Failed to fetch active rulesets: ${result.error.message}`);
    }
    
    return result.data.data;
  }

  /**
   * Toggle ruleset status between active and archived
   */
  async toggleStatus(id: string): Promise<Ruleset> {
    // Get current status
    const current = await this.getRuleset(id);
    const newStatus = current.status === 'active' ? 'archived' : 'active';
    
    const result = await apiPut<Ruleset>(`/api/admin/rulesets/${id}`, { status: newStatus });
    
    if (!result.ok) {
      throw new Error(`Failed to toggle ruleset status: ${result.error.message}`);
    }
    
    return result.data;
  }

  /**
   * Publish a draft ruleset to active status
   */
  async publishRuleset(id: string): Promise<{ success: boolean; ruleset?: Ruleset; error?: string }> {
    try {
      const result = await apiPut<Ruleset>(`/api/admin/rulesets/${id}`, { status: 'active' });
      
      if (!result.ok) {
        return { success: false, error: result.error.message };
      }
      
      return { success: true, ruleset: result.data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Check if ruleset can be edited (only drafts are mutable)
   */
  canEdit(ruleset: Ruleset): boolean {
    return ruleset.is_mutable === true && ruleset.status === 'draft';
  }
}

export const rulesetsService = new RulesetsService();




