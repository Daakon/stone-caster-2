import type { SupabaseClient } from "@supabase/supabase-js";
import type { Request } from "express";
import { z } from "zod";
import {
  getChimeraSupabaseClient,
  getChimeraSupabaseAdminClient,
} from "../supabase-client.js";
import type {
  EntityReadLane,
  EntityReadQuery,
} from "../../../../shared/src/types/chimera-entity-read.js";

const identitySchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  slug: z.string(),
  content_key: z.string(),
  owner_kind: z.enum(["first_party", "player"]),
  owner_namespace: z.string(),
  owner_user_id: z.string().uuid().nullable(),
  visibility: z.string(),
});
export type EntityIdentity = z.infer<typeof identitySchema>;
const rowSchema = z
  .object({
    content_key: z.string(),
    owner_namespace: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();
export type EntityContentRow = z.infer<typeof rowSchema>;
const identityColumns =
  "id,key,slug,content_key,owner_kind,owner_namespace,owner_user_id,visibility";
const playerColumns =
  "id,key,slug,content_key,owner_kind,owner_namespace,owner_user_id,release_state,visibility,display_name,entity_type,raw_data,world_id,primary_image_url,icon_image_url,created_at,updated_at";
const sourceColumns =
  "content_key,owner_namespace,body,release_state,created_at,updated_at";

/** Request RLS reads bodies and tag relations. Service role reads fixed identity columns only. */
export class EntityContentReadRepository {
  static forRequest(req?: Request): EntityContentReadRepository {
    return new EntityContentReadRepository(getChimeraSupabaseClient(req));
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
    if (error) throw new Error("Entity audience unavailable");
    return z.boolean().parse(data);
  }
  private async identity(
    table: "chimera_entities" | "chimera_worlds",
    id: string,
  ): Promise<EntityIdentity | null> {
    let query = this.metadata.from(table).select(identityColumns);
    query = z.string().uuid().safeParse(id).success
      ? query.eq("id", id)
      : query.or(`key.eq.${id},slug.eq.${id}`);
    const { data, error } = await query
      .limit(2)
      .abortSignal(AbortSignal.timeout(1000));
    if (error) throw new Error("Entity identity unavailable");
    const rows = z.array(identitySchema).parse(data);
    return rows.length === 1 ? (rows[0] ?? null) : null;
  }
  resolve(id: string): Promise<EntityIdentity | null> {
    return this.identity("chimera_entities", id);
  }
  async worldKey(id: string): Promise<string | null> {
    const world = await this.identity("chimera_worlds", id);
    if (world !== null)
      return world.owner_kind === "first_party" ? world.content_key : null;
    return z.string().uuid().safeParse(id).success ? null : id;
  }
  async firstPartyAliases(keys: string[]): Promise<EntityIdentity[]> {
    const result: EntityIdentity[] = [];
    for (let start = 0; start < keys.length; start += 200) {
      const { data, error } = await this.metadata
        .from("chimera_entities")
        .select(identityColumns)
        .eq("owner_kind", "first_party")
        .in("content_key", keys.slice(start, start + 200))
        .abortSignal(AbortSignal.timeout(1000));
      if (error) throw new Error("Entity aliases unavailable");
      result.push(...z.array(identitySchema).parse(data));
    }
    return result;
  }
  async list(
    lane: EntityReadLane,
    admin: boolean,
    owner: string | null,
    params: EntityReadQuery,
    worldKey: string | null,
    order: "created_at" | "updated_at",
  ): Promise<EntityContentRow[]> {
    if (
      params.world_id &&
      ((lane === "first_party" && worldKey === null) ||
        (lane !== "first_party" &&
          !z.string().uuid().safeParse(params.world_id).success))
    )
      return [];
    let query =
      lane === "first_party"
        ? this.client
            .from("chimera_content_source_items")
            .select(sourceColumns)
            .eq("content_kind", "entity")
            .eq("owner_namespace", "first_party")
        : this.client
            .from("chimera_entities")
            .select(playerColumns)
            .eq("owner_kind", "player");
    if (lane === "first_party" && !admin)
      query = query.eq("release_state", "published");
    if (lane === "owner") query = query.eq("owner_user_id", owner);
    if (lane === "public") query = query.eq("visibility", "public");
    if (params.world_id)
      query = query.eq(
        lane === "first_party" ? "body->>world_key" : "world_id",
        lane === "first_party" ? worldKey : params.world_id,
      );
    query = query
      .order(order, { ascending: false })
      .order("owner_namespace")
      .order("content_key");
    const result: EntityContentRow[] = [],
      end = params.offset + params.limit;
    for (let start = 0; start < end; start += 200) {
      const stop = Math.min(start + 200, end);
      const { data, error } = await query
        .range(start, stop - 1)
        .abortSignal(AbortSignal.timeout(2000));
      if (error) throw new Error("Entity list unavailable");
      const page = z.array(rowSchema).parse(data);
      result.push(...page);
      if (page.length < stop - start) break;
    }
    return result;
  }
  async find(
    namespace: string,
    key: string,
    admin: boolean,
    owner: string | null,
  ): Promise<EntityContentRow | null> {
    let query =
      namespace === "first_party"
        ? this.client
            .from("chimera_content_source_items")
            .select(sourceColumns)
            .eq("content_kind", "entity")
        : this.client
            .from("chimera_entities")
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
    if (error) throw new Error("Entity unavailable");
    return data === null ? null : rowSchema.parse(data);
  }
  async tags(id: string): Promise<{ id: string; tag_name: string }[]> {
    const { data, error } = await this.client
      .from("chimera_asset_tags")
      .select("tag:chimera_tags!tag_id(id,tag_name)")
      .eq("asset_id", id)
      .eq("asset_type", "entity_template")
      .abortSignal(AbortSignal.timeout(2000));
    if (error) throw new Error("Entity tags unavailable");
    return z
      .array(
        z.object({
          tag: z
            .object({ id: z.string().uuid(), tag_name: z.string() })
            .nullable(),
        }),
      )
      .parse(data)
      .flatMap((link) => (link.tag === null ? [] : [link.tag]));
  }
}
