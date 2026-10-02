import type { Request } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase-client.js";
import {
  getChimeraSupabaseClient,
  getChimeraSupabaseAdminClient,
} from "../supabase-client.js";
import type {
  ActiveContentChoice,
  TierLimits,
} from "../../../../shared/src/types/chimera-entitlements.js";

export class EntitlementsRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}
  static forRequest(request: Request) {
    return new EntitlementsRepository(getChimeraSupabaseClient(request));
  }
  private async call(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    const { data, error } = await (this.client as SupabaseClient)
      .rpc(name, args)
      .overrideTypes<unknown, { merge: false }>();
    if (error) throw new Error(error.message);
    return data;
  }
  active() {
    return this.call("chimera_entitlements_active");
  }
  choose(choice: ActiveContentChoice) {
    return this.call("chimera_set_active_choices", {
      p_story_ids: choice.story_ids,
      p_game_ids: choice.game_ids,
    });
  }
  async assertGameWritable(gameId: string) {
    await this.call("chimera_assert_game_writable", { p_game_id: gameId });
  }
  async policies(): Promise<unknown> {
    const client = this.client as SupabaseClient;
    const [{ data: tiers, error }, { data: config, error: configError }] =
      await Promise.all([
        client
          .from("chimera_tier_limits")
          .select("tier_key,max_owned_stories,max_saved_games")
          .order("tier_key"),
        client
          .from("chimera_entitlement_config")
          .select("default_tier_key")
          .eq("singleton", true)
          .maybeSingle(),
      ]);
    if (error || configError) throw new Error("Unable to load tier policy");
    return {
      tiers,
      default_tier_key:
        (config as { default_tier_key: string } | null)?.default_tier_key ??
        null,
    };
  }
  async setTier(policy: TierLimits, makeDefault: boolean) {
    await this.call("chimera_admin_set_tier", {
      p_tier: policy.tier_key,
      p_stories: policy.max_owned_stories,
      p_games: policy.max_saved_games,
      p_default: makeDefault,
    });
  }
  async assign(userId: string, tier: string) {
    await this.call("chimera_admin_assign_tier", {
      p_user_id: userId,
      p_tier: tier,
    });
  }
  async createStory(
    userId: string,
    story: Record<string, unknown>,
  ): Promise<unknown> {
    const { data, error } = await (
      getChimeraSupabaseAdminClient() as SupabaseClient
    )
      .rpc("chimera_create_owned_story", { p_user_id: userId, p_story: story })
      .overrideTypes<unknown, { merge: false }>();
    if (error) throw new Error(error.message);
    return data;
  }
  async createGame(
    userId: string,
    compiledId: string,
    characterId: string,
    bundle: unknown,
  ): Promise<string> {
    const { data, error } = await (
      getChimeraSupabaseAdminClient() as SupabaseClient
    )
      .rpc("chimera_create_pinned_game", {
        p_user_id: userId,
        p_compiled_id: compiledId,
        p_character_id: characterId,
        p_bundle: bundle,
      })
      .overrideTypes<unknown, { merge: false }>();
    if (error) throw new Error(error.message);
    if (typeof data !== "string")
      throw new Error("Game creation returned no session ID");
    return data;
  }
}
