import type { SupabaseClient } from "@supabase/supabase-js";
import type { Request } from "express";
import { z } from "zod";
import {
  getChimeraSupabaseAdminClient,
  getChimeraSupabaseClient,
} from "../supabase-client.js";
import type {
  WorldReadLane,
  WorldReadQuery,
} from "../../../../shared/src/types/chimera-world-read.js";

const WorldIdentitySchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  slug: z.string(),
  content_key: z.string(),
  owner_kind: z.enum(["first_party", "player"]),
  owner_namespace: z.string(),
  owner_user_id: z.string().uuid().nullable(),
  visibility: z.string(),
});
export type WorldIdentity = z.infer<typeof WorldIdentitySchema>;
const row = z
  .object({
    content_key: z.string(),
    owner_namespace: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();
export type WorldContentRow = z.infer<typeof row>;
const playerColumns =
  "id,key,slug,name,definition,description_short,description_long,character_schema_contributions,tags,genre_tags,genre,setting,owner_kind,owner_namespace,owner_user_id,content_key,visibility,release_state,created_at,updated_at";
const identityColumns =
  "id,key,slug,content_key,owner_kind,owner_namespace,owner_user_id,visibility";
const sourceColumns =
  "content_key,owner_namespace,body,release_state,created_at,updated_at";
const like = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
const literal = (value: string) =>
  `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** Bodies use the request's RLS client; service role resolves identity columns only. */
export class WorldContentReadRepository {
  static forRequest(req?: Request): WorldContentReadRepository {
    return new WorldContentReadRepository(getChimeraSupabaseClient(req));
  }
  constructor(
    private readonly client: SupabaseClient,
    private readonly metadata: SupabaseClient = getChimeraSupabaseAdminClient() as SupabaseClient,
  ) {}
  async isAdmin(): Promise<boolean> {
    const { data, error } = await this.client
      .rpc("is_admin")
      .abortSignal(AbortSignal.timeout(1000))
      .overrideTypes<unknown, { merge: false }>();
    if (error) throw new Error("World audience unavailable");
    return z.boolean().parse(data);
  }
  async resolve(id: string): Promise<WorldIdentity | null> {
    let query = this.metadata.from("chimera_worlds").select(identityColumns);
    query = z.string().uuid().safeParse(id).success
      ? query.eq("id", id)
      : query.or(`key.eq.${id},slug.eq.${id}`);
    const { data, error } = await query
      .limit(2)
      .abortSignal(AbortSignal.timeout(1000));
    if (error) throw new Error("World identity unavailable");
    const rows = z.array(WorldIdentitySchema).parse(data);
    // Owner-scoped keys/slugs can repeat: never choose an arbitrary owner's row.
    return rows.length === 1 ? (rows[0] ?? null) : null;
  }
  async list(
    lane: WorldReadLane,
    admin: boolean,
    owner: string | null,
    params: WorldReadQuery,
    recent = false,
  ): Promise<WorldContentRow[]> {
    const result: WorldContentRow[] = [];
    let query =
      lane === "first_party"
        ? this.client
            .from("chimera_content_source_items")
            .select(sourceColumns)
            .eq("content_kind", "world")
            .eq("owner_namespace", "first_party")
        : this.client
            .from("chimera_worlds")
            .select(playerColumns)
            .eq("owner_kind", "player");
    if (lane === "first_party" && !admin)
      query = query.eq("release_state", "published");
    if (lane === "owner") query = query.eq("owner_user_id", owner);
    if (lane === "public") query = query.eq("visibility", "public");
    const tags = lane === "first_party" ? "body->tags" : "tags";
    if (params.tag)
      query = query.contains(
        tags,
        lane === "first_party" ? JSON.stringify([params.tag]) : [params.tag],
      );
    if (params.search) {
      const searchTags =
        lane === "first_party"
          ? JSON.stringify([params.search])
          : `{${literal(params.search)}}`;
      query = query.or(
        `${lane === "first_party" ? "body->>name" : "name"}.ilike.${literal(like(params.search))},${tags}.cs.${literal(searchTags)}`,
      );
    }
    query = (
      recent
        ? query.order("created_at", { ascending: false })
        : query.order(lane === "first_party" ? "body->>name" : "name")
    )
      .order("owner_namespace")
      .order("content_key");
    const end = params.offset + params.limit;
    for (let start = 0; start < end; start += 200) {
      const stop = Math.min(start + 200, end);
      const { data, error } = await query
        .range(start, stop - 1)
        .abortSignal(AbortSignal.timeout(2000));
      if (error) throw new Error("World list unavailable");
      const page = z.array(row).parse(data);
      result.push(...page);
      if (page.length < stop - start) break;
    }
    return result;
  }
  async firstPartyAliases(keys: string[]): Promise<WorldIdentity[]> {
    if (keys.length === 0) return [];
    const aliases: WorldIdentity[] = [];
    for (let start = 0; start < keys.length; start += 200) {
      const { data, error } = await this.metadata
        .from("chimera_worlds")
        .select(identityColumns)
        .eq("owner_kind", "first_party")
        .in("content_key", keys.slice(start, start + 200))
        .abortSignal(AbortSignal.timeout(1000));
      if (error) throw new Error("World aliases unavailable");
      aliases.push(...z.array(WorldIdentitySchema).parse(data));
    }
    return aliases;
  }
  async find(
    namespace: string,
    key: string,
    admin: boolean,
    owner: string | null,
  ): Promise<WorldContentRow | null> {
    let query =
      namespace === "first_party"
        ? this.client
            .from("chimera_content_source_items")
            .select(sourceColumns)
            .eq("content_kind", "world")
        : this.client
            .from("chimera_worlds")
            .select(playerColumns)
            .eq("owner_kind", "player");
    query = query.eq("owner_namespace", namespace).eq("content_key", key);
    if (namespace === "first_party" && !admin)
      query = query.eq("release_state", "published");
    if (namespace !== "first_party")
      query =
        owner === namespace
          ? query.eq("owner_user_id", owner)
          : query.eq("visibility", "public");
    const { data, error } = await query
      .abortSignal(AbortSignal.timeout(2000))
      .maybeSingle();
    if (error) throw new Error("World unavailable");
    return data === null ? null : row.parse(data);
  }
}
