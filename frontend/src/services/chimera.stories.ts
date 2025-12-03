/**
 * Chimera Stories Service
 * API client for Chimera V2 story endpoints
 */

import { apiFetch, apiPost, apiPut, apiDelete } from '@/lib/api';

export interface ChimeraStory {
  id: string;
  owner_user_id: string;
  visibility: 'private' | 'pending_approval' | 'public';
  display_name: string;
  description_short: string | null;
  content_rating: 'safe' | 'mature' | 'explicit';
  world_id: string | null;
  story_definition?: Record<string, unknown> | null;
  configuration?: {
    worldId: string;
    rulesetIds: string[];
    entityIds: string[];
  } | null;
  created_at: string;
  updated_at: string;
  world?: {
    id: string;
    display_name: string;
    description_short?: string | null;
  } | null;
  // Deprecated: These fields are now in configuration JSONB
  ruleset_links?: Array<{ ruleset_template_id: string }>;
  pack_links?: Array<{ pack_id: string }>;
  entity_links?: Array<{ entity_template_id: string }>;
}

export interface CreateStoryData {
  display_name: string;
  description_short?: string | null;
  content_rating?: 'safe' | 'mature' | 'explicit';
  world_id?: string | null;
  ruleset_template_ids: string[];
  pack_ids: string[];
  entity_ids?: string[];
}

export interface UpdateStoryData extends Partial<CreateStoryData> {
  visibility?: 'private' | 'pending_approval' | 'public';
  story_definition?: Record<string, unknown> | null;
}

export const chimeraStoriesService = {
  /**
   * Get a single story by ID
   */
  async getStory(id: string): Promise<ChimeraStory> {
    const result = await apiFetch<ChimeraStory>(`/api/v2/chimera/stories/${id}`);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch story');
    }
    return result.data!;
  },

  /**
   * Get all stories owned by the current user
   */
  async getMyStories(): Promise<ChimeraStory[]> {
    const result = await apiFetch<ChimeraStory[]>('/api/v2/chimera/stories/my-creations');
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch stories');
    }
    return result.data || [];
  },

  /**
   * Create a new story
   */
  async createStory(data: CreateStoryData): Promise<ChimeraStory> {
    const result = await apiPost<ChimeraStory>('/api/v2/chimera/stories', data);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to create story');
    }
    return result.data!;
  },

  /**
   * Create a draft story with minimal data
   * Generates a unique name using timestamp to avoid conflicts
   */
  async createDraftStory(): Promise<ChimeraStory> {
    // Generate unique name using timestamp to avoid "name already exists" errors
    // Format: "Untitled Story 2024-11-15 15:20:30.123" (includes milliseconds for uniqueness)
    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').substring(0, 23);
    const uniqueName = `Untitled Story ${dateStr}`;

    const result = await apiPost<ChimeraStory>('/api/v2/chimera/stories', {
      display_name: uniqueName,
      description_short: null,
      content_rating: 'safe',
      world_id: null,
      ruleset_template_ids: [],
      pack_ids: [],
    });
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to create draft story');
    }
    return result.data!;
  },

  /**
   * Update an existing story
   */
  async updateStory(id: string, data: UpdateStoryData): Promise<ChimeraStory> {
    const result = await apiPut<ChimeraStory>(`/api/v2/chimera/stories/${id}`, data);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to update story');
    }
    return result.data!;
  },

  /**
   * Update only the story_definition JSON
   */
  async updateStoryDefinition(id: string, storyDefinition: Record<string, unknown>): Promise<{
    id: string;
    story_definition: Record<string, unknown>;
    updated_at: string;
  }> {
    const result = await apiPut<{
      id: string;
      story_definition: Record<string, unknown>;
      updated_at: string;
    }>(`/api/v2/chimera/stories/${id}/definition`, { story_definition: storyDefinition });
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to update story definition');
    }
    return result.data!;
  },

  /**
   * Rebuild/compile a story's ruleset
   */
  async rebuildStory(id: string): Promise<{
    story_id: string;
    compiled_json: Record<string, unknown>;
    source_manifest: Array<{ id: string; version: number }>;
    last_compiled_at: string;
  }> {
    const result = await apiPost<{
      story_id: string;
      compiled_json: Record<string, unknown>;
      source_manifest: Array<{ id: string; version: number }>;
      last_compiled_at: string;
    }>(`/api/v2/chimera/stories/${id}/rebuild`, {});
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to rebuild story');
    }
    return result.data!;
  },

  /**
   * Delete a story
   */
  async deleteStory(id: string): Promise<void> {
    const result = await apiDelete(`/api/v2/chimera/stories/${id}`);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to delete story');
    }
  },

  /**
   * Link an entity template to a story
   */
  async linkEntityToStory(storyId: string, entityTemplateId: string): Promise<{
    story_id: string;
    entity_template_id: string;
  }> {
    const result = await apiPost<{
      story_id: string;
      entity_template_id: string;
    }>(`/api/v2/chimera/stories/${storyId}/links/entities`, {
      entity_template_id: entityTemplateId,
    });
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to link entity to story');
    }
    return result.data!;
  },
};

