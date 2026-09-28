// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Compiled Stories Repository
 * Handles CRUD operations for compiled story records
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase-client.js';
import type { CompiledStory } from '../../services/compile/compiler.service.js';
import type { CompiledContentManifestV1 } from '@shared/types/chimera-content.js';

export class CompiledStoriesRepository {
  constructor(private supabase: SupabaseClient<Database>) { }

  async publishFrozen(
    expectedGeneration: number,
    storyId: string | null,
    title: string,
    refs: Array<CompiledContentManifestV1 & {role:string}>,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const {data, error} = await (this.supabase as any).rpc('publish_frozen_chimera_compile', {
      p_expected_generation:expectedGeneration,
      p_story_id:storyId,
      p_title:title,
      p_refs:refs.map((ref) => ({...ref, key:ref.key})),
      p_payload:payload,
    });
    if (error) throw new Error(`Failed to publish frozen compile: ${error.message}`);
    if (typeof data !== 'string') throw new Error('Frozen compile function returned no compiled story ID');
    return data;
  }

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
   * Get a compiled story by key (Story ID)
   * @param storyKey - The story ID
   * @returns CompiledStory or null if not found
   */
  async findByKey(storyKey: string): Promise<CompiledStory | null> {
    const { data, error } = await (this.supabase
      .from('chimera_compiled_stories') as any)
      .select('id, story_id, version, payload_blob_hash, config_mechanics, config_interpreter, config_narrator, config_ui, config_engine, creation_manifest, prompt_interpreter_logic, prompt_narrator_style, snapshot_world, snapshot_entities, genesis_config, created_at')
      .eq('story_id', storyKey)
      .order('version', { ascending: false })
      .limit(1)
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

    return this.mapCompiledStory(data);
  }

  /**
   * Get a compiled story by ID (Cartridge ID)
   * @param id - The compiled story UUID
   * @returns CompiledStory or null if not found
   */
  async findById(id: string): Promise<CompiledStory | null> {
    const { data, error } = await (this.supabase
      .from('chimera_compiled_stories') as any)
      .select('id, story_id, version, payload_blob_hash, config_mechanics, config_interpreter, config_narrator, config_ui, config_engine, creation_manifest, prompt_interpreter_logic, prompt_narrator_style, snapshot_world, snapshot_entities, created_at')
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

    return this.mapCompiledStory(data);
  }

  /**
   * Get just the creation manifest and world snapshot for a story
   * Optimized for Character Forge loading
   */
  async getManifestByKey(storyKey: string): Promise<{ creation_manifest: any, snapshot_world: any } | null> {
    const { data, error } = await (this.supabase
      .from('chimera_compiled_stories') as any)
      .select('creation_manifest, snapshot_world')
      .eq('story_id', storyKey)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    return {
      creation_manifest: data.creation_manifest,
      snapshot_world: data.snapshot_world
    };
  }

  private async mapCompiledStory(data: any): Promise<CompiledStory> {
    let payload: Record<string, any> | null = null;
    if (data.payload_blob_hash) {
      const {data:blob, error} = await (this.supabase.from('chimera_content_blobs') as any)
        .select('body').eq('sha256', data.payload_blob_hash).single();
      if (error || !blob) throw new Error(`Frozen compiled payload is unavailable: ${error?.message ?? data.payload_blob_hash}`);
      payload = blob.body?.body ?? null;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Frozen compiled payload has an invalid body');
    }
    return {
      id:data.id,
      story_key:data.story_id ?? undefined,
      config_engine:payload?.config_engine ?? data.config_engine ?? {},
      creation_manifest:payload?.creation_manifest ?? data.creation_manifest ?? {},
      prompt_interpreter_logic:payload?.prompt_interpreter_logic ?? data.prompt_interpreter_logic,
      prompt_narrator_style:payload?.prompt_narrator_style ?? data.prompt_narrator_style,
      snapshot_world:payload?.snapshot_world ?? data.snapshot_world ?? {},
      snapshot_entities:payload?.snapshot_entities ?? data.snapshot_entities ?? [],
      tier1_allowlist:new Set([]),
      tier0_allowlist:new Set([]),
      version:data.version,
      updated_at:data.created_at,
      ...payload,
    } as any;
  }
}
