/**
 * Stories Repository
 * Handles CRUD operations for compiled stories and game states
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase-client.js";
import { getChimeraSupabaseAdminClient } from "../supabase-client.js";
import type { CompiledStory } from "@shared/types/chimera-compiled";
import type { GameState } from "@shared/types/chimera-runtime";
import { CompiledStorySchema } from "@shared/types/chimera-compiled";
import { GameStateSchema } from "@shared/types/chimera-runtime";
import type { CharacterTemplate } from "../../domain/character.types.js";
import { ServiceError } from "../../utils/serviceError.js";
import { ApiErrorCode } from "@shared";
import { EntitlementsRepository } from "./entitlements.repo.js";

export class StoriesRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Save a compiled story
   * @param story - The CompiledStory object
   * @param storyKey - Optional story key (will be generated if not provided)
   * @returns The ID of the saved compiled story
   */
  async saveCompiled(story: CompiledStory, storyKey?: string): Promise<string> {
    CompiledStorySchema.parse(story);
    void storyKey;
    throw new Error(
      "Inline compiled-story writes are disabled; use the stable-key frozen compile service.",
    );
  }

  /** Load only the selected character belonging to this authenticated player. */
  async getOwnedPlayerCharacter(
    id: string,
    userId: string,
  ): Promise<CharacterTemplate | null> {
    const client = this.supabase as SupabaseClient;
    const { data, error } = await client
      .from("chimera_player_characters")
      .select("id, user_id, name, state_snapshot")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error("Failed to load selected player character");
    return data as CharacterTemplate | null;
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
    storyId: string | null,
    bundle: any,
    playerId: string,
    compiledStoryId: string,
    playerCharacterId: string,
  ): Promise<string> {
    return new EntitlementsRepository(this.supabase).createGame(
      playerId,
      compiledStoryId,
      playerCharacterId,
      bundle,
    );
  }

  /**
   * Load a game state by ID
   * @param id - The game state ID
   * @returns GameState or null
   */
  async loadGameState(id: string): Promise<GameState | null> {
    const { data, error } = await this.supabase
      .from("chimera_game_states")
      .select(
        "id, story_id, compiled_story_id, player_character_id, state_initialization_version, player_id, mechanical_state, narrative_focus, scene_registry, action_queue, updated_at",
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to load game state: ${error.message}`);
    }

    if (!data) return null;

    const compiled = await this.getCompiledStoryById(data.compiled_story_id);
    if (!compiled)
      throw new Error(
        `Pinned compiled story not found: ${data.compiled_story_id}`,
      );
    return GameStateSchema.parse({
      id: data.id,
      story_id: data.story_id,
      compiled_story_id: data.compiled_story_id,
      player_character_id: data.player_character_id,
      state_initialization_version: data.state_initialization_version,
      player_id: data.player_id,
      mechanical_state: data.mechanical_state,
      narrative_focus: data.narrative_focus,
      scene_registry: data.scene_registry,
      action_queue: data.action_queue,
      compiled_system_prompt: compiled.prompt_narrator_style ?? "",
      updated_at: data.updated_at,
    });
  }

  /**
   * Update specific shards of the game state
   * @param gameStateId - The ID of the game state
   * @param partialState - The shards to update (mechanical, narrative, registry, etc.)
   */
  async updateGameState(
    gameStateId: string,
    partialState: Partial<GameState>,
    expectedUpdatedAt?: string,
  ): Promise<void> {
    // Map DTO keys to DB columns (they match in the new schema, but good to be explicit)
    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (partialState.mechanical_state)
      updatePayload.mechanical_state = partialState.mechanical_state;
    if (partialState.narrative_focus)
      updatePayload.narrative_focus = partialState.narrative_focus;
    if (partialState.scene_registry)
      updatePayload.scene_registry = partialState.scene_registry;
    if (partialState.action_queue)
      updatePayload.action_queue = partialState.action_queue;

    let query = this.supabase
      .from("chimera_game_states")
      .update(updatePayload)
      .eq("id", gameStateId);

    // Optimistic concurrency: only write if the row hasn't changed since load.
    // Protects against two concurrent turns silently clobbering each other.
    if (expectedUpdatedAt) {
      query = query.eq("updated_at", expectedUpdatedAt);
    }

    const { data, error } = await query.select("id");

    if (error) {
      throw new Error(`Failed to update game state: ${error.message}`);
    }

    if (expectedUpdatedAt && (!data || data.length === 0)) {
      throw new ServiceError(409, {
        code: ApiErrorCode.CONFLICT,
        message: "This game was updated by another action. Please retry.",
      });
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
    directorIntent: any;
    mechanicalDelta: any;
    narratorOutput: any;
  }): Promise<any> {
    // Returns GameTurn logic ideally
    const { data, error } = await this.supabase
      .from("chimera_turns")
      .insert({
        game_state_id: turnData.gameStateId,
        turn_index: turnData.turnIndex,
        player_input: turnData.playerInput,
        director_intent: turnData.directorIntent || {},
        mechanical_delta: turnData.mechanicalDelta || {},
        narrator_output: turnData.narratorOutput || {},
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to record turn: ${error.message}`);
    }
    return data;
  }

  /**
   * Helper to reconstruct CompiledStory from DB row
   */
  private async mapRowToCompiledStory(data: any): Promise<CompiledStory> {
    if (!data.payload_blob_hash)
      throw new Error("Compiled story has no frozen payload hash");
    const { data: blob, error } = await (
      this.supabase.from("chimera_content_blobs") as any
    )
      .select("body")
      .eq("sha256", data.payload_blob_hash)
      .single();
    if (error || !blob)
      throw new Error(
        `Frozen compiled payload is unavailable: ${error?.message ?? data.payload_blob_hash}`,
      );
    const frozenPayload = blob.body?.body;
    if (
      !frozenPayload ||
      typeof frozenPayload !== "object" ||
      Array.isArray(frozenPayload)
    )
      throw new Error("Frozen compiled payload has an invalid body");
    for (const field of [
      "config_engine",
      "prompt_interpreter_logic",
      "prompt_narrator_style",
      "snapshot_world",
      "snapshot_entities",
    ]) {
      if (!Object.hasOwn(frozenPayload, field))
        throw new Error(`Frozen compiled payload is missing ${field}`);
    }
    return CompiledStorySchema.parse({
      ...frozenPayload,
      id: data.id,
      source_manifest: data.source_manifest,
      frozen_title: data.frozen_title,
      story_key: data.story_id ?? undefined,
      tier1_allowlist: new Set(),
      tier0_allowlist: new Set(),
      version: data.version,
      updated_at: data.created_at || new Date().toISOString(),
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
      .from("chimera_compiled_stories")
      .select(
        "id, story_id, version, payload_blob_hash, source_manifest, frozen_title, created_at",
      )
      .eq("story_id", storyKey) // Check story_id column (which often holds the key/slug/uuid)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
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
      .from("chimera_compiled_stories")
      .select(
        "id, story_id, version, payload_blob_hash, source_manifest, frozen_title, created_at",
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
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
  async getCompiledStoryByDraftId(
    storyId: string,
  ): Promise<CompiledStory | null> {
    const { data, error } = await this.supabase
      .from("chimera_compiled_stories")
      .select(
        "id, story_id, version, payload_blob_hash, source_manifest, frozen_title, created_at",
      )
      .eq("story_id", storyId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw new Error(
        `Failed to get compiled story by Draft ID: ${error.message}`,
      );
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
  async getCompiledStoryIdFromGameState(
    gameStateId: string,
  ): Promise<string | null> {
    const { data, error } = await this.supabase
      .from("chimera_game_states")
      .select("compiled_story_id")
      .eq("id", gameStateId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw new Error(
        `Failed to get compiled story pin from game state: ${error.message}`,
      );
    }

    if (!data) {
      return null;
    }

    return data.compiled_story_id;
  }
  /**
   * Get the next turn index for a game state
   * @param gameStateId - The game state ID
   * @returns The next turn index (0 if no turns exist)
   */
  async getNextTurnIndex(gameStateId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from("chimera_turns")
      .select("turn_index")
      .eq("game_state_id", gameStateId)
      .order("turn_index", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return 0; // No turns found, start at 0
      }
      // If there's a real error, we might log it but falling back to 0 or throwing depends on strictness.
      // For now, let's throw to be safe.
      throw new Error(`Failed to get next turn index: ${error.message}`);
    }

    return (data?.turn_index ?? -1) + 1;
  }

  /**
   * Writes the per-turn AI audit row (already linked to its turn). Best-effort: never fails a turn.
   */
  async recordTurnAudit(params: {
    gameId: string;
    turnId: string;
    turnIndex: number;
    actionType: string;
    promptText: string;
    rawResponse: string;
    tokenUsage: Record<string, unknown>;
    modelUsed: string;
  }): Promise<string | null> {
    // Audit rows are system-written (no INSERT policy for players): use the service client
    const { data, error } = await (getChimeraSupabaseAdminClient() as any)
      .from("ai_audit_logs")
      .insert({
        game_id: params.gameId,
        turn_id: params.turnId,
        turn_index: params.turnIndex,
        action_type: params.actionType,
        prompt_text: params.promptText,
        raw_response: params.rawResponse,
        token_usage: params.tokenUsage,
        cost_stones: 0,
        model_used: params.modelUsed.slice(0, 100),
      })
      .select("id")
      .single();
    if (error) {
      console.warn(
        `[StoriesRepo] Failed to record audit for turn ${params.turnId}: ${error.message}`,
      );
      return null;
    }
    return data?.id ?? null;
  }

  /**
   * Links an existing AI Audit Log to a newly created turn
   * @param traceId - The trace ID (PK of ai_audit_logs)
   * @param turnId - The UUID of the chimera_turn
   */
  async linkAuditLogToTurn(traceId: string, turnId: string): Promise<void> {
    const { error } = await this.supabase
      .from("ai_audit_logs")
      .update({ turn_id: turnId })
      .eq("id", traceId);

    if (error) {
      console.warn(
        `[StoriesRepo] Failed to link Audit ${traceId} to Turn ${turnId}: ${error.message}`,
      );
    }
  }
}
