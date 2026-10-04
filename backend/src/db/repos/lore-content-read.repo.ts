import type { SupabaseClient } from "@supabase/supabase-js";
import type { Request } from "express";
import { z } from "zod";
import {
  getChimeraSupabaseClient,
  getChimeraSupabaseAdminClient,
} from "../supabase-client.js";
import type {
  LoreReadContext,
  LoreReadQuery,
} from "../../../../shared/src/types/chimera-lore-read.js";
import type { EntityReadLane } from "../../../../shared/src/types/chimera-entity-read.js";

const identitySchema = z.object({
  id: z.string().uuid(),
  content_key: z.string(),
  owner_kind: z.enum(["first_party", "player"]),
  owner_namespace: z.string(),
  owner_user_id: z.string().uuid().nullable(),
  visibility: z.string(),
});
export type LoreIdentity = z.infer<typeof identitySchema>;
const rowSchema = z
  .object({
    content_key: z.string(),
    owner_namespace: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();
export type LoreContentRow = z.infer<typeof rowSchema>;
const identityColumns =
  "id,content_key,owner_kind,owner_namespace,owner_user_id,visibility";
const playerColumns =
  "id,content_key,owner_kind,owner_namespace,owner_user_id,visibility,release_state,is_official,fragment,keywords,world_id,entity_id,story_id,created_at,updated_at";
const sourceColumns =
  "content_key,owner_namespace,release_state,body,created_at,updated_at";

/** Request RLS reads bodies/relations; service role resolves fixed identity metadata only. */
export class LoreContentReadRepository {
  static forRequest(req: Request): LoreContentReadRepository {
    return new LoreContentReadRepository(getChimeraSupabaseClient(req));
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
    if (error) throw new Error("Lore audience unavailable");
    return z.boolean().parse(data);
  }
  async resolve(id: string): Promise<LoreIdentity | null> {
    let q = this.metadata.from("chimera_lore").select(identityColumns);
    q = z.string().uuid().safeParse(id).success
      ? q.eq("id", id)
      : q.eq("content_key", id);
    const { data, error } = await q
      .limit(2)
      .abortSignal(AbortSignal.timeout(1000));
    if (error) throw new Error("Lore identity unavailable");
    const rows = z.array(identitySchema).parse(data);
    return rows.length === 1 ? (rows[0] ?? null) : null;
  }
  async firstPartyAliases(keys: string[]): Promise<LoreIdentity[]> {
    const result: LoreIdentity[] = [];
    for (let start = 0; start < keys.length; start += 200) {
      const { data, error } = await this.metadata
        .from("chimera_lore")
        .select(identityColumns)
        .eq("owner_kind", "first_party")
        .in("content_key", keys.slice(start, start + 200))
        .abortSignal(AbortSignal.timeout(1000));
      if (error) throw new Error("Lore aliases unavailable");
      result.push(...z.array(identitySchema).parse(data));
    }
    return result;
  }
  async list(
    lane: EntityReadLane,
    admin: boolean,
    owner: string,
    params: LoreReadQuery,
    context: LoreReadContext | null,
  ): Promise<LoreContentRow[]> {
    if (
      context &&
      ((lane === "first_party" &&
        (context.namespace !== "first_party" || context.kind === "story")) ||
        (lane !== "first_party" && context.id === null))
    )
      return [];
    let q =
      lane === "first_party"
        ? this.client
            .from("chimera_content_source_items")
            .select(sourceColumns)
            .eq("content_kind", "lore")
            .eq("owner_namespace", "first_party")
        : this.client
            .from("chimera_lore")
            .select(playerColumns)
            .eq("owner_kind", "player");
    if (lane === "first_party" && !admin)
      q = q.eq("release_state", "published");
    if (lane === "public") q = q.eq("visibility", "public");
    if (lane === "owner") q = q.eq("owner_user_id", owner);
    if (context) {
      const field =
        lane === "first_party"
          ? `body->>${context.kind}_key`
          : `${context.kind}_id`;
      q = q.eq(field, lane === "first_party" ? context.key : context.id);
      if (context.kind === "world")
        q = q
          .is(lane === "first_party" ? "body->>entity_key" : "entity_id", null)
          .is(lane === "first_party" ? "body->>story_key" : "story_id", null);
    }
    q = q
      .order("created_at", { ascending: false })
      .order("owner_namespace")
      .order("content_key");
    const result: LoreContentRow[] = [],
      end = params.offset + params.limit;
    for (let start = 0; start < end; start += 200) {
      const stop = Math.min(start + 200, end);
      const { data, error } = await q
        .range(start, stop - 1)
        .abortSignal(AbortSignal.timeout(2000));
      if (error) throw new Error("Lore list unavailable");
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
    owner: string,
  ): Promise<LoreContentRow | null> {
    let q =
      namespace === "first_party"
        ? this.client
            .from("chimera_content_source_items")
            .select(sourceColumns)
            .eq("content_kind", "lore")
        : this.client
            .from("chimera_lore")
            .select(playerColumns)
            .eq("owner_kind", "player");
    q = q.eq("owner_namespace", namespace).eq("content_key", key);
    if (namespace === "first_party" && !admin)
      q = q.eq("release_state", "published");
    if (namespace !== "first_party")
      q =
        namespace === owner
          ? q.eq("owner_user_id", owner)
          : q.eq("visibility", "public");
    const { data, error } = await q
      .abortSignal(AbortSignal.timeout(2000))
      .maybeSingle();
    if (error) throw new Error("Lore unavailable");
    return data === null ? null : rowSchema.parse(data);
  }
  async tags(
    ids: string[],
  ): Promise<{ asset_id: string; tag: { id: string; tag_name: string } }[]> {
    const result: {
      asset_id: string;
      tag: { id: string; tag_name: string };
    }[] = [];
    for (let start = 0; start < ids.length; start += 200) {
      const { data, error } = await this.client
        .from("chimera_asset_tags")
        .select("asset_id,tag:chimera_tags!tag_id(id,tag_name)")
        .eq("asset_type", "lore_entry")
        .in("asset_id", ids.slice(start, start + 200))
        .abortSignal(AbortSignal.timeout(2000));
      if (error) throw new Error("Lore tags unavailable");
      const rows = z
        .array(
          z.object({
            asset_id: z.string().uuid(),
            tag: z
              .object({ id: z.string().uuid(), tag_name: z.string() })
              .nullable(),
          }),
        )
        .parse(data);
      for (const row of rows)
        if (row.tag !== null)
          result.push({ asset_id: row.asset_id, tag: row.tag });
    }
    return result;
  }
}
