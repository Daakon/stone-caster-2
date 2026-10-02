import type { Request } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase-client.js";
import {
  CompiledStorySchema,
  type CompiledStory,
} from "../../../../shared/src/types/chimera-compiled.js";
import {
  GameStateSchema,
  type GameState,
} from "../../../../shared/src/types/chimera-runtime.js";
import { getChimeraSupabaseClient } from "../supabase-client.js";
import { StoriesRepository } from "./stories.repo.js";

export class PlayViewRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  static forRequest(request: Request): PlayViewRepository {
    return new PlayViewRepository(getChimeraSupabaseClient(request));
  }

  async loadOwnedSession(
    id: string,
    userId: string,
  ): Promise<GameState | null> {
    const client = this.client as SupabaseClient;
    const { data, error } = await client
      .from("chimera_game_states")
      .select(
        "id, story_id, player_id, compiled_story_id, player_character_id, state_initialization_version, mechanical_state, narrative_focus, scene_registry, action_queue, updated_at",
      )
      .eq("id", id)
      .eq("player_id", userId)
      .maybeSingle();
    if (error) throw Error("Failed to load owned play session");
    return data ? GameStateSchema.parse(data) : null;
  }

  async loadPinnedCompile(id: string): Promise<CompiledStory | null> {
    const compiled: unknown = await new StoriesRepository(
      this.client,
    ).getCompiledStoryById(id);
    return compiled ? CompiledStorySchema.parse(compiled) : null;
  }
}
