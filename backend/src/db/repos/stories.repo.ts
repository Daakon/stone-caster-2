/**
 * Stories Repository
 * Handles CRUD operations for compiled stories and game states
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase-client.js';
import type { CompiledStory } from '@shared/types/chimera-compiled';
import type { GameState } from '@shared/types/chimera-runtime';
import { CompiledStorySchema } from '@shared/types/chimera-compiled';
import { GameStateSchema } from '@shared/types/chimera-runtime';

export class StoriesRepository {
  constructor(private supabase: SupabaseClient<Database>) { }

  /**
   * Save a compiled story
   * @param story - The CompiledStory object
   * @param storyKey - Optional story key (will be generated if not provided)
   * @returns The ID of the saved compiled story
   */
  async saveCompiled(story: CompiledStory, storyKey?: string): Promise<string> {
    // Validate the compiled story
    const validated = CompiledStorySchema.parse(story);

    // Generate a story key if not provided
    const key = storyKey || `story_${Date.now()}`;

    const { data, error } = await this.supabase
      .from('chimera_compiled_stories')
      .insert({
        story_id: validated.story_key, // Mapping story_key to story_id column as per schema
        version: validated.version,
        config_engine: validated.config_engine as unknown as Record<string, unknown>,
        prompt_interpreter_logic: validated.prompt_interpreter_logic,
        prompt_narrator_style: validated.prompt_narrator_style,
        snapshot_world: validated.snapshot_world as unknown as Record<string, unknown>,
        snapshot_entities: validated.snapshot_entities as unknown as Record<string, unknown>,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to save compiled story: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to save compiled story: No data returned');
    }

    return data.id;
  }

  /**
   * Create a new game state
   * @param storyId - The ID of the compiled story
   * @param initialState - The initial GameState
   * @param playerId - The player's user ID
   * @returns The ID of the created game state
   */
  /**
   * Create a new game state from a bundle
   * @param storyId - The ID of the compiled story
   * @param bundle - The GameStateBundle
   * @param playerId - The player's user ID
   * @returns The ID of the created game state
   */
  async createGameState(
    storyId: string,
    bundle: any, // Typed as GameStateBundle in service, but using any here to avoid strict circular deps if needed
    playerId: string
  ): Promise<string> {
    const { mechanical, narrative, registry, queue } = bundle;

    const { data, error } = await this.supabase
      .from('chimera_game_states')
      .insert({
        story_id: storyId,
        player_id: playerId,
        mechanical_state: mechanical,
        narrative_focus: narrative,
        scene_registry: registry,
        action_queue: queue || []
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create game state: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to create game state: No data returned');
    }

    return data.id;
  }

  /**
   * Load a game state by ID
   * @param id - The game state ID
   * @returns GameStateBundle or null
   */
  async loadGameState(id: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from('chimera_game_states')
      .select('mechanical_state, narrative_focus, scene_registry, action_queue')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to load game state: ${error.message}`);
    }

    if (!data) return null;

    return {
      mechanical: data.mechanical_state,
      narrative: data.narrative_focus,
      registry: data.scene_registry,
      queue: data.action_queue
    };
  }

  /**
   * Helper to reconstruct CompiledStory from DB row
   */
  private mapRowToCompiledStory(data: any): CompiledStory {
    return CompiledStorySchema.parse({
      id: data.id,
      story_key: data.story_id, // Map back story_id column to story_key field
      config_engine: data.config_engine,
      prompt_interpreter_logic: data.prompt_interpreter_logic,
      prompt_narrator_style: data.prompt_narrator_style,
      snapshot_world: data.snapshot_world,
      snapshot_entities: data.snapshot_entities,
      tier1_allowlist: new Set(),
      tier0_allowlist: new Set(),
      version: data.version,
      updated_at: data.created_at || new Date().toISOString()
    });
  }

  /**
   * Get a compiled story by key (Draft/Story ID or Key)
   * The schema is ambiguous here, usually story_id stores the UUID of the draft.
   * @param storyKey - The story key
   * @returns CompiledStory or null if not found
   */
  async getCompiledStory(storyKey: string): Promise<CompiledStory | null> {
    const { data, error } = await this.supabase
      .from('chimera_compiled_stories')
      .select('id, story_id, version, config_engine, prompt_interpreter_logic, prompt_narrator_style, snapshot_world, snapshot_entities, created_at')
      .eq('story_id', storyKey) // Check story_id column (which often holds the key/slug/uuid)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get compiled story: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return this.mapRowToCompiledStory(data);
  }

  /**
   * Get a compiled story by ID (The Compiled Cartridge ID)
   * @param id - The compiled story ID
   * @returns CompiledStory or null if not found
   */
  async getCompiledStoryById(id: string): Promise<CompiledStory | null> {
    const { data, error } = await this.supabase
      .from('chimera_compiled_stories')
      .select('id, story_id, version, config_engine, prompt_interpreter_logic, prompt_narrator_style, snapshot_world, snapshot_entities, created_at')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get compiled story by ID: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return this.mapRowToCompiledStory(data);
  }

  /**
  * Get a compiled story by its draft Story ID.
  * @param storyId - The Draft Story ID
  * @returns CompiledStory or null if not found
  */
  async getCompiledStoryByDraftId(storyId: string): Promise<CompiledStory | null> {
    const { data, error } = await this.supabase
      .from('chimera_compiled_stories')
      .select('id, story_id, version, config_engine, prompt_interpreter_logic, prompt_narrator_style, snapshot_world, snapshot_entities, created_at')
      .eq('story_id', storyId)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get compiled story by Draft ID: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return this.mapRowToCompiledStory(data);
  }

  /**
   * Get the story ID for a game state
   * @param gameStateId - The game state ID
   * @returns The story ID or null if not found
   */
  async getStoryIdFromGameState(gameStateId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('chimera_game_states')
      .select('story_id')
      .eq('id', gameStateId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get story ID from game state: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return data.story_id;
  }
}
