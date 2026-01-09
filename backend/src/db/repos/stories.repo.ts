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
    bundle: any,
    playerId: string
  ): Promise<string> {
    const { mechanical, narrative, registry, queue, compiled_system_prompt } = bundle;

    const { data, error } = await this.supabase
      .from('chimera_game_states')
      .insert({
        story_id: storyId,
        player_id: playerId,
        mechanical_state: mechanical || {},
        narrative_focus: narrative || {},
        scene_registry: registry || {},
        action_queue: queue || [],
        compiled_system_prompt: compiled_system_prompt || null
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
   * @returns GameState or null
   */
  async loadGameState(id: string): Promise<GameState | null> {
    const { data, error } = await this.supabase
      .from('chimera_game_states')
      .select('id, story_id, player_id, mechanical_state, narrative_focus, scene_registry, action_queue, compiled_system_prompt, updated_at')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to load game state: ${error.message}`);
    }

    if (!data) return null;

    // Direct mapping to GameState interface
    return {
      id: data.id,
      story_id: data.story_id,
      player_id: data.player_id,
      mechanical_state: data.mechanical_state,
      narrative_focus: data.narrative_focus,
      scene_registry: data.scene_registry,
      action_queue: data.action_queue,
      compiled_system_prompt: data.compiled_system_prompt,
      updated_at: data.updated_at
    };
  }

  /**
   * Update specific shards of the game state
   * @param gameStateId - The ID of the game state
   * @param partialState - The shards to update (mechanical, narrative, registry, etc.)
   */
  async updateGameState(gameStateId: string, partialState: Partial<GameState>): Promise<void> {
    // Map DTO keys to DB columns (they match in the new schema, but good to be explicit)
    const updatePayload: any = {
      updated_at: new Date().toISOString()
    };

    if (partialState.mechanical_state) updatePayload.mechanical_state = partialState.mechanical_state;
    if (partialState.narrative_focus) updatePayload.narrative_focus = partialState.narrative_focus;
    if (partialState.scene_registry) updatePayload.scene_registry = partialState.scene_registry;
    if (partialState.action_queue) updatePayload.action_queue = partialState.action_queue;

    const { error } = await this.supabase
      .from('chimera_game_states')
      .update(updatePayload)
      .eq('id', gameStateId);

    if (error) {
      throw new Error(`Failed to update game state: ${error.message}`);
    }
  }

  /**
   * Record a turn in the history log
   * @param turnData - Object containing turn details
   * @returns The created turn record
   */
  async recordTurn(turnData: {
    gameStateId: string;
    turnIndex: number;
    playerInput: string;
    mas1Intent: any;
    mechanicalDelta: any;
    mas2Narration: any;
  }): Promise<any> { // Returns GameTurn logic ideally
    const { data, error } = await this.supabase
      .from('chimera_turns')
      .insert({
        game_state_id: turnData.gameStateId,
        turn_index: turnData.turnIndex,
        player_input: turnData.playerInput,
        mas1_intent: turnData.mas1Intent || {},
        mechanical_delta: turnData.mechanicalDelta || {},
        mas2_narration: turnData.mas2Narration || {}
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to record turn: ${error.message}`);
    }
    return data;
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
      .select('id, story_id, version, config_mechanics, config_interpreter, config_narrator, config_ui, config_engine, prompt_interpreter_logic, prompt_narrator_style, snapshot_world, snapshot_entities, created_at')
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
      .select('id, story_id, version, config_mechanics, config_interpreter, config_narrator, config_ui, config_engine, prompt_interpreter_logic, prompt_narrator_style, snapshot_world, snapshot_entities, created_at')
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
      .select('id, story_id, version, config_mechanics, config_interpreter, config_narrator, config_ui, config_engine, prompt_interpreter_logic, prompt_narrator_style, snapshot_world, snapshot_entities, created_at')
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
  /**
   * Get the next turn index for a game state
   * @param gameStateId - The game state ID
   * @returns The next turn index (0 if no turns exist)
   */
  async getNextTurnIndex(gameStateId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('chimera_turns')
      .select('turn_index')
      .eq('game_state_id', gameStateId)
      .order('turn_index', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return 0; // No turns found, start at 0
      }
      // If there's a real error, we might log it but falling back to 0 or throwing depends on strictness.
      // For now, let's throw to be safe.
      throw new Error(`Failed to get next turn index: ${error.message}`);
    }

    return (data?.turn_index ?? -1) + 1;
  }

  /**
   * Links an existing AI Audit Log to a newly created turn
   * @param traceId - The trace ID (PK of ai_audit_logs)
   * @param turnId - The UUID of the chimera_turn
   */
  async linkAuditLogToTurn(traceId: string, turnId: string): Promise<void> {
    const { error } = await this.supabase
      .from('ai_audit_logs')
      .update({ turn_id: turnId })
      .eq('id', traceId);

    if (error) {
      console.warn(`[StoriesRepo] Failed to link Audit ${traceId} to Turn ${turnId}: ${error.message}`);
    }
  }
}
