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
      content: (fragmentData.content || fragmentData.entry_text) as string,
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
        content: (fragmentData.content || fragmentData.entry_text) as string,
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
      entity_id?: string;
      story_id?: string;
    },
    userId: string
  ): Promise<any> {
    const { display_name, entry_text, keywords, type, entity_id, story_id } = entry;

    const { data, error } = await this.supabase
      .from('chimera_lore')
      .insert({
        world_id: worldId,
        owner_user_id: userId,
        visibility: 'private',
        keywords: keywords || [],
        entity_id: entity_id || null, // Sparse column
        story_id: story_id || null,   // Sparse column
        fragment: {
          display_name,
          entry_text,
          type: type || 'general',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      })
      .select('id, world_id, owner_user_id, fragment, keywords, entity_id, story_id, created_at, updated_at')
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
  /**
   * Find all lore entries with strict context isolation
   * @param params - Filter parameters
   */
  async findAll(params: { world_id?: string; entity_id?: string; story_id?: string }): Promise<any[]> {
    console.log('------------------------------------------------');
    console.log('[LoreRepository] findAll called with:', JSON.stringify(params));

    let query = this.supabase
      .from('chimera_lore')
      // Added 'keywords' to selection as per user request
      .select('id, world_id, fragment, created_at, updated_at, entity_id, story_id, keywords');

    // STRICT MUTUAL EXCLUSION
    if (params.entity_id) {
      console.log('[LoreRepository] APPLYING FILTER: entity_id =', params.entity_id);
      query = query.eq('entity_id', params.entity_id);
    } else if (params.story_id) {
      console.log('[LoreRepository] APPLYING FILTER: story_id =', params.story_id);
      query = query.eq('story_id', params.story_id);
    } else if (params.world_id) {
      console.log('[LoreRepository] APPLYING FILTER: world_id =', params.world_id);
      // World lore = World ID matches AND entity/story are null
      query = query.eq('world_id', params.world_id).is('entity_id', null).is('story_id', null);
    } else {
      console.warn('[LoreRepository] No ID provided. Returning empty list to prevent leakage.');
      return [];
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    console.log(`[LoreRepository] Query returned ${data?.length || 0} rows.`);
    console.log('------------------------------------------------');

    if (error) {
      console.error('[LoreRepository] DB Error:', error);
      throw new Error(`Failed to fetch lore entries: ${error.message}`);
    }

    return data || [];
  }
}

