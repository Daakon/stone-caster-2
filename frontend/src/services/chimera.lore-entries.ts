/**
 * Chimera Lore Entries Service
 * API client for Chimera V2 lore entry endpoints (Pure RAG system)
 */

import { apiFetch, apiPost, apiDelete } from '@/lib/api';
import type { ChimeraLoreEntry } from '@shared/types/chimera-lore';

export interface CreateLoreEntryData {
  story_id: string;
  display_name: string;
  entry_text: string;
}

export const chimeraLoreEntriesService = {
  /**
   * Create a new lore entry
   */
  async createLoreEntry(storyId: string, payload: Omit<CreateLoreEntryData, 'story_id'>): Promise<ChimeraLoreEntry> {
    const result = await apiPost<ChimeraLoreEntry>('/api/v2/chimera/lore', {
      story_id: storyId,
      ...payload,
    });
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to create lore entry');
    }
    return result.data!;
  },

  /**
   * Fetch all lore entries for a story
   */
  async fetchLoreEntries(storyId: string): Promise<ChimeraLoreEntry[]> {
    const result = await apiFetch<ChimeraLoreEntry[]>(`/api/v2/chimera/lore?story_id=${encodeURIComponent(storyId)}`);
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

