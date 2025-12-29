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
      .from('compiled_stories')
      .insert({
        story_key: key,
        compiled: validated as unknown as Record<string, unknown>,
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
  async createGameState(
    storyId: string,
    initialState: GameState,
    playerId: string
  ): Promise<string> {
    // Validate the game state
    const validated = GameStateSchema.parse(initialState);

    const { data, error } = await this.supabase
      .from('chimera_game_states')
      .insert({
        story_id: storyId,
        state: validated as unknown as Record<string, unknown>,
        player_id: playerId,
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
   * @returns GameState or null if not found
   */
  async loadGameState(id: string): Promise<GameState | null> {
    const { data, error } = await this.supabase
      .from('chimera_game_states')
      .select('state')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to load game state: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return GameStateSchema.parse(data.state);
  }

  /**
   * Update a game state
   * @param id - The game state ID
   * @param newState - The updated GameState
   */
  async updateGameState(id: string, newState: GameState): Promise<void> {
    // Validate the game state
    const validated = GameStateSchema.parse(newState);

    const { error } = await this.supabase
      .from('chimera_game_states')
      .update({
        state: validated as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update game state: ${error.message}`);
    }
  }

  /**
   * Get a compiled story by key
   * @param storyKey - The story key
   * @returns CompiledStory or null if not found
   */
  async getCompiledStory(storyKey: string): Promise<CompiledStory | null> {
    const { data, error } = await this.supabase
      .from('compiled_stories')
      .select('compiled')
      .eq('story_key', storyKey)
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

    return CompiledStorySchema.parse(data.compiled);
  }

  /**
   * Get a compiled story by ID
   * @param id - The compiled story ID
   * @returns CompiledStory or null if not found
   */
  async getCompiledStoryById(id: string): Promise<CompiledStory | null> {
    const { data, error } = await this.supabase
      .from('compiled_stories')
      .select('compiled')
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

    return CompiledStorySchema.parse(data.compiled);
  }

  /**
   * Get a compiled story by its draft Story ID.
   * This is useful when the frontend only has the Draft ID (URL param).
   * @param storyId - The Draft Story ID
   * @returns CompiledStory or null if not found
   */
  async getCompiledStoryByDraftId(storyId: string): Promise<CompiledStory | null> {
    // Find the latest compiled version for this story_id
    // Phase 4: We assume 'story_id' column exists in 'compiled_stories'
    // If not, we might need to rely on 'story_key' actually being the Draft ID (which is common)
    // But let's try the explicit column first if user evidence suggests 'story_id' field exists.

    // User evidence showed: [{"idx":0,"id":"...","story_id":"97af...","version":12, ...}]
    // So 'story_id' column DEFINITELY exists in 'compiled_stories'.

    const { data, error } = await this.supabase
      .from('compiled_stories')
      .select('compiled')
      .eq('story_id', storyId)
      .order('version', { ascending: false }) // Get latest version
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

    return CompiledStorySchema.parse(data.compiled);
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

