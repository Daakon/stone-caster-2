/**
 * Lore Repository
 * Handles CRUD operations for Chimera lore fragments
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase-client.js';
import type { LoreFragment } from '@shared/types/chimera-authoring';
import { LoreFragmentSchema } from '@shared/types/chimera-authoring';

export class LoreRepository {
  constructor(private supabase: SupabaseClient<Database>) { }

  /**
   * Create a new lore fragment
   * @param fragment - The LoreFragment object
   * @returns The ID of the created lore fragment
   */
  async create(fragment: LoreFragment): Promise<string> {
    // Validate the lore fragment
    const validated = LoreFragmentSchema.parse(fragment);

    const { data, error } = await this.supabase
      .from('chimera_lore')
      .insert({
        fragment: validated as unknown as Record<string, unknown>,
        embedding: validated.embedding || null,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create lore fragment: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to create lore fragment: No data returned');
    }

    return data.id;
  }

  /**
   * Get a lore fragment by ID
   * @param id - The lore fragment UUID
   * @returns LoreFragment or null if not found
   */
  async findById(id: string): Promise<LoreFragment | null> {
    const { data, error } = await this.supabase
      .from('chimera_lore')
      .select('fragment, embedding')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find lore fragment by ID: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    // Reconstruct LoreFragment from stored data
    const fragmentData = data.fragment as Record<string, unknown>;
    return LoreFragmentSchema.parse({
      id,
      content: fragmentData.content as string,
      tags: (fragmentData.tags as string[]) || [],
      embedding: data.embedding as number[] | undefined,
    });
  }

  /**
   * Update a lore fragment
   * @param id - The lore fragment UUID
   * @param fragment - The updated LoreFragment object
   */
  async update(id: string, fragment: LoreFragment): Promise<void> {
    // Validate the lore fragment
    const validated = LoreFragmentSchema.parse(fragment);

    const { error } = await this.supabase
      .from('chimera_lore')
      .update({
        fragment: validated as unknown as Record<string, unknown>,
        embedding: validated.embedding || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update lore fragment: ${error.message}`);
    }
  }

  /**
   * Delete a lore fragment
   * @param id - The lore fragment UUID
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('chimera_lore')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete lore fragment: ${error.message}`);
    }
  }

  /**
   * List all lore fragments
   * @returns Array of LoreFragment objects
   */
  async listAll(): Promise<LoreFragment[]> {
    const { data, error } = await this.supabase
      .from('chimera_lore')
      .select('id, fragment, embedding');

    if (error) {
      throw new Error(`Failed to list lore fragments: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    // Parse and validate each lore fragment
    return data.map((row) => {
      const fragmentData = row.fragment as Record<string, unknown>;
      return LoreFragmentSchema.parse({
        id: row.id,
        content: fragmentData.content as string,
        tags: (fragmentData.tags as string[]) || [],
        embedding: row.embedding as number[] | undefined,
      });
    });
  }
  /**
   * Create a new lore fragment (V2)
   * Handles hybrid schema: keywords in SQL, type in JSONB
   */
  async createV2(
    worldId: string,
    entry: {
      display_name: string;
      entry_text: string;
      keywords?: string[];
      type?: string;
    },
    userId: string
  ): Promise<any> {
    const { display_name, entry_text, keywords, type } = entry;

    const { data, error } = await this.supabase
      .from('chimera_lore')
      .insert({
        world_id: worldId,
        owner_user_id: userId,
        visibility: 'private',
        keywords: keywords || [],
        fragment: {
          display_name,
          entry_text,
          type: type || 'general',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      })
      .select('id, world_id, owner_user_id, fragment, keywords, created_at, updated_at')
      .single();

    if (error) {
      throw new Error(`Failed to create lore fragment: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a lore fragment (V2)
   */
  async updateV2(
    id: string,
    entry: {
      display_name?: string;
      entry_text?: string;
      keywords?: string[];
      type?: string;
    }
  ): Promise<any> {
    const { keywords, ...fragmentUpdates } = entry;

    // Fetch existing first to merge fragment JSONB
    const { data: existing, error: fetchError } = await this.supabase
      .from('chimera_lore')
      .select('fragment')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      throw new Error(`Lore fragment not found: ${fetchError?.message}`);
    }

    const payload: any = {
      updated_at: new Date().toISOString(),
    };

    if (keywords !== undefined) {
      payload.keywords = keywords;
    }

    const existingFragment = (existing.fragment as Record<string, unknown>) || {};
    const newFragment = { ...existingFragment };
    let fragmentChanged = false;

    if (fragmentUpdates.display_name !== undefined) {
      newFragment.display_name = fragmentUpdates.display_name;
      fragmentChanged = true;
    }
    if (fragmentUpdates.entry_text !== undefined) {
      newFragment.entry_text = fragmentUpdates.entry_text;
      fragmentChanged = true;
    }
    if (fragmentUpdates.type !== undefined) {
      newFragment.type = fragmentUpdates.type;
      fragmentChanged = true;
    }

    if (fragmentChanged) {
      newFragment.updated_at = new Date().toISOString();
      payload.fragment = newFragment;
    }

    const { data: updated, error: updateError } = await this.supabase
      .from('chimera_lore')
      .update(payload)
      .eq('id', id)
      .select('id, world_id, owner_user_id, fragment, keywords, created_at, updated_at')
      .single();

    if (updateError) {
      throw new Error(`Failed to update lore fragment: ${updateError.message}`);
    }

    return updated;
  }
}

