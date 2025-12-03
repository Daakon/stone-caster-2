/**
 * Chimera Lore Entries Service
 * API client for Chimera V2 lore entry endpoints (Pure RAG system)
 */

import { apiFetch, apiPost, apiDelete } from '@/lib/api';
import type { ChimeraLoreEntry } from '@shared/types/chimera-lore';

export interface CreateLoreEntryData {
  world_id: string;
  display_name: string;
  entry_text: string;
}

export const chimeraLoreEntriesService = {
  /**
   * Create a new lore entry
   */
  async createLoreEntry(worldId: string, payload: Omit<CreateLoreEntryData, 'world_id'>): Promise<ChimeraLoreEntry> {
    // Validate inputs
    if (!worldId || typeof worldId !== 'string' || !worldId.trim()) {
      throw new Error('World ID is required and must be a non-empty string');
    }
    if (!payload.display_name || typeof payload.display_name !== 'string' || !payload.display_name.trim()) {
      throw new Error('Display name is required');
    }
    if (!payload.entry_text || typeof payload.entry_text !== 'string' || !payload.entry_text.trim()) {
      throw new Error('Entry text is required');
    }

    const requestBody = {
      world_id: worldId.trim(),
      display_name: payload.display_name.trim(),
      entry_text: payload.entry_text.trim(),
    };

    // Debug logging (remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('[Chimera Lore] Creating lore entry with body:', requestBody);
    }

    const result = await apiPost<ChimeraLoreEntry>('/api/v2/chimera/lore', requestBody);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to create lore entry');
    }
    return result.data!;
  },

  /**
   * Fetch all lore entries for a world
   * Also supports storyId for backward compatibility (gets world_id from story)
   */
  async fetchLoreEntries(
    worldId: string, 
    options?: { storyId?: string }
  ): Promise<ChimeraLoreEntry[]> {
    // If options.storyId is provided, use story_id query param for backward compatibility
    // Otherwise, treat the first param as world_id
    const queryParam = options?.storyId 
      ? `story_id=${encodeURIComponent(options.storyId)}`
      : `world_id=${encodeURIComponent(worldId)}`;
    
    const result = await apiFetch<ChimeraLoreEntry[]>(`/api/v2/chimera/lore?${queryParam}`);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch lore entries');
    }
    return result.data || [];
  },

  /**
   * Delete a lore entry
   */
  async deleteLoreEntry(loreId: string): Promise<void> {
    const result = await apiDelete(`/api/v2/chimera/lore/${loreId}`);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to delete lore entry');
    }
  },
};

