/**
 * Lore Repository
 * Handles CRUD operations for Chimera lore fragments
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase-client.js';
import type { LoreFragment } from '@shared/types/chimera-authoring';
import { LoreFragmentSchema } from '@shared/types/chimera-authoring';

export class LoreRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

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
}

