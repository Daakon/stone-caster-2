/**
 * Chimera Admin Service
 * API client for Chimera V2 admin endpoints
 */

import { apiFetch, apiPost, apiPut, apiDelete } from '@/lib/api';

export interface ExclusionGroup {
  id: string;
  group_name: string;
  created_at: string;
  updated_at: string;
}

export interface RulesetTemplate {
  id: string;
  display_name: string;
  description_short: string | null;
  description_long: string | null;
  version: number;
  rule_type: 'MAIN_SYSTEM' | 'SUBSYSTEM' | 'MODIFIER';
  main_system_dependency: string | null;
  exclusion_group: string | null; // V3: Simple TEXT column, not a foreign key
  rule_category: string;
  definition: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateRulesetTemplateData {
  display_name: string;
  description_short?: string | null;
  description_long?: string | null;
  rule_type: 'MAIN_SYSTEM' | 'SUBSYSTEM' | 'MODIFIER';
  main_system_dependency?: string | null;
  exclusion_group_id?: string | null;
  new_exclusion_group_name?: string | null;
  rule_category: string;
  definition: Record<string, unknown>;
}

export interface UpdateRulesetTemplateData extends Partial<CreateRulesetTemplateData> {}

export interface ChimeraTag {
  id: string;
  tag_name: string;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTagData {
  tag_name: string;
  is_approved?: boolean;
}

export interface UpdateTagData {
  tag_name?: string;
  is_approved?: boolean;
}

export const chimeraService = {
  /**
   * Get all ruleset templates
   */
  async listRulesetTemplates(): Promise<RulesetTemplate[]> {
    const result = await apiFetch<RulesetTemplate[]>('/api/v2/chimera/admin/rulesets');
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch ruleset templates');
    }
    return result.data || [];
  },

  /**
   * Get a single ruleset template by ID
   */
  async getRulesetTemplate(id: string): Promise<RulesetTemplate> {
    const result = await apiFetch<RulesetTemplate>(`/api/v2/chimera/admin/rulesets/${id}`);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch ruleset template');
    }
    return result.data!;
  },

  /**
   * Create a new ruleset template
   */
  async createRulesetTemplate(data: CreateRulesetTemplateData): Promise<RulesetTemplate> {
    const result = await apiPost<RulesetTemplate>('/api/v2/chimera/admin/rulesets', data);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to create ruleset template');
    }
    return result.data!;
  },

  /**
   * Update an existing ruleset template
   */
  async updateRulesetTemplate(id: string, data: UpdateRulesetTemplateData): Promise<RulesetTemplate> {
    const result = await apiPut<RulesetTemplate>(`/api/v2/chimera/admin/rulesets/${id}`, data);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to update ruleset template');
    }
    return result.data!;
  },

  /**
   * Delete a ruleset template
   */
  async deleteRulesetTemplate(id: string): Promise<void> {
    const result = await apiDelete(`/api/v2/chimera/admin/rulesets/${id}`);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to delete ruleset template');
    }
  },

  /**
   * Get all exclusion groups
   */
  async listExclusionGroups(): Promise<ExclusionGroup[]> {
    const result = await apiFetch<ExclusionGroup[]>('/api/v2/chimera/admin/rulesets/exclusion-groups');
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch exclusion groups');
    }
    return result.data || [];
  },

  /**
   * Get all tags (admin only - includes unapproved)
   */
  async listTags(): Promise<ChimeraTag[]> {
    const result = await apiFetch<ChimeraTag[]>('/api/v2/chimera/admin/tags');
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch tags');
    }
    return result.data || [];
  },

  /**
   * Create a new tag
   */
  async createTag(data: CreateTagData): Promise<ChimeraTag> {
    const result = await apiPost<ChimeraTag>('/api/v2/chimera/admin/tags', data);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to create tag');
    }
    return result.data!;
  },

  /**
   * Update an existing tag
   */
  async updateTag(id: string, data: UpdateTagData): Promise<ChimeraTag> {
    const result = await apiPut<ChimeraTag>(`/api/v2/chimera/admin/tags/${id}`, data);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to update tag');
    }
    return result.data!;
  },

  /**
   * Delete a tag
   */
  async deleteTag(id: string): Promise<void> {
    const result = await apiDelete(`/api/v2/chimera/admin/tags/${id}`);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to delete tag');
    }
  },
};

