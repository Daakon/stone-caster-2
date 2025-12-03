// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Compiled Stories Repository
 * Handles CRUD operations for compiled story records
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase-client.js';
import type { CompiledStory } from '../../services/compile/compiler.service.js';

export class CompiledStoriesRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Create a new compiled story
   * @param storyKey - Unique key for the story
   * @param compiled - The CompiledStory object
   * @returns The ID of the created compiled story
   */
  async create(storyKey: string, compiled: CompiledStory): Promise<string> {
    // Convert Sets to Arrays for JSONB storage
    const compiledForStorage = {
      ...compiled,
      tier1_allowlist: Array.from(compiled.tier1_allowlist),
      tier0_allowlist: Array.from(compiled.tier0_allowlist),
    };

    const { data, error } = await (this.supabase
      .from('compiled_stories') as any)
      .insert({
        story_key: storyKey,
        compiled: compiledForStorage as unknown as Record<string, unknown>,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create compiled story: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to create compiled story: No data returned');
    }

    return data.id;
  }

  /**
   * Get a compiled story by key
   * @param storyKey - The story key
   * @returns CompiledStory or null if not found
   */
  async findByKey(storyKey: string): Promise<CompiledStory | null> {
    const { data, error } = await (this.supabase
      .from('compiled_stories') as any)
      .select('compiled')
      .eq('story_key', storyKey)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find compiled story: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    // Convert Arrays back to Sets
    const compiled = data.compiled as any;
    return {
      ...compiled,
      tier1_allowlist: new Set(compiled.tier1_allowlist || []),
      tier0_allowlist: new Set(compiled.tier0_allowlist || []),
    };
  }

  /**
   * Get a compiled story by ID
   * @param id - The compiled story UUID
   * @returns CompiledStory or null if not found
   */
  async findById(id: string): Promise<CompiledStory | null> {
    const { data, error } = await (this.supabase
      .from('compiled_stories') as any)
      .select('compiled')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find compiled story: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    // Convert Arrays back to Sets
    const compiled = data.compiled as any;
    return {
      ...compiled,
      tier1_allowlist: new Set(compiled.tier1_allowlist || []),
      tier0_allowlist: new Set(compiled.tier0_allowlist || []),
    };
  }
}

