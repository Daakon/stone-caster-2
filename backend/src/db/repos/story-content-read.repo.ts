import type { Request } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  getChimeraSupabaseClient,
  getChimeraSupabaseAdminClient,
} from "../supabase-client.js";
import {
  StorySourceReadSchema,
  type StorySourceRead,
  type StoryReadQuery,
} from "../../../../shared/src/types/chimera-story-read.js";

const identitySchema = z.object({
  id: z.string().uuid(),
  owner_kind: z.enum(["player", "first_party"]),
  owner_namespace: z.string(),
  content_key: z.string(),
  owner_user_id: z.string().uuid().nullable(),
  visibility: z.string(),
});
export type StoryIdentity = z.infer<typeof identitySchema>;
const columns =
  "id,display_name,owner_user_id,owner_kind,owner_namespace,content_key,release_state,visibility,version,content_rating,is_system_asset,created_at,updated_at,last_edited_at,story_definition,configuration,genesis_config,description_short,description,title,primary_image_url,image_url,opening_text,world_id,protagonist_id,cast_ids,entity_ids,active_ruleset_ids,status,compile_status,current_compiled_id";
const literal = (v: string) =>
  `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const like = (v: string) => `%${v.replace(/[\\%_]/g, "\\$&")}%`;

/** Story bodies always use RLS. Service role resolves only UUID/ownership identity. */
export class StoryContentReadRepository {
  static forRequest(req?: Request): StoryContentReadRepository {
    return new StoryContentReadRepository(getChimeraSupabaseClient(req));
  }
  constructor(
    private readonly client: SupabaseClient,
    private readonly metadata: SupabaseClient = getChimeraSupabaseAdminClient() as SupabaseClient,
  ) {}
  async resolve(id: string): Promise<StoryIdentity | null> {
    const { data, error } = await this.metadata
      .from("chimera_stories")
      .select(
        "id,owner_kind,owner_namespace,content_key,owner_user_id,visibility",
      )
      .eq("id", id)
      .abortSignal(AbortSignal.timeout(1000))
      .maybeSingle();
    if (error) throw new Error("Story identity unavailable");
    return data === null ? null : identitySchema.parse(data);
  }
  async list(
    owner: string | null,
    params: StoryReadQuery,
  ): Promise<StorySourceRead[]> {
    let query = this.client
      .from("chimera_stories")
      .select(columns)
      .eq("owner_kind", "player");
    query =
      owner === null
        ? query
            .eq("visibility", "public")
            .in("status", ["compiled", "bound"])
            .not("current_compiled_id", "is", null)
        : query.eq("owner_user_id", owner);
    if (params.search) {
      const value = literal(like(params.search));
      query = query.or(
        `title.ilike.${value},display_name.ilike.${value},description.ilike.${value}`,
      );
    }
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id")
      .range(params.offset, params.offset + params.limit - 1)
      .abortSignal(AbortSignal.timeout(2000));
    if (error) throw new Error("Story list unavailable");
    return z.array(StorySourceReadSchema).parse(data);
  }
  async find(
    namespace: string,
    key: string,
    owner: string | null,
  ): Promise<StorySourceRead | null> {
    let query = this.client
      .from("chimera_stories")
      .select(columns)
      .eq("owner_kind", "player")
      .eq("owner_namespace", namespace)
      .eq("content_key", key);
    query =
      namespace === owner
        ? query.eq("owner_user_id", owner)
        : query.eq("visibility", "public");
    const { data, error } = await query
      .abortSignal(AbortSignal.timeout(2000))
      .maybeSingle();
    if (error) throw new Error("Story unavailable");
    return data === null ? null : StorySourceReadSchema.parse(data);
  }
}
