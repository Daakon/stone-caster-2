import { z } from "zod";
import type { Request } from "express";
import {
  EntityContentReadRepository,
  type EntityContentRow,
  type EntityIdentity,
} from "../../db/repos/entity-content-read.repo.js";
import {
  getContentCache,
  type ContentCacheService,
} from "./content-cache.service.js";
import { ServiceError } from "../../utils/serviceError.js";
import { ApiErrorCode } from "../../../../shared/src/types/api.js";
import {
  EntityReadIdSchema,
  type EntityRead,
  type EntityReadCard,
  type EntityReadLane,
  type EntityReadMode,
  type EntityReadQuery,
} from "../../../../shared/src/types/chimera-entity-read.js";

const object = (value: unknown): Record<string, unknown> =>
  z.record(z.unknown()).parse(value ?? {});
const text = (value: unknown): string | null =>
  typeof value === "string" ? value : null;
function dto(row: EntityContentRow, alias?: EntityIdentity): EntityRead {
  const first = row.owner_namespace === "first_party",
    body = first ? object(row.body) : row;
  const raw = object(body.raw_data);
  const type = z
    .enum(["NPC", "ITEM", "FACTION", "LOCATION"])
    .parse(body.entity_type ?? raw.entity_type ?? raw.type);
  const state = raw.base_state_json;
  return {
    id: first
      ? (alias?.id ?? row.content_key)
      : z.string().uuid().parse(row.id),
    key: row.content_key,
    content_key: row.content_key,
    slug: text(body.slug) ?? row.content_key,
    owner_kind: first ? "first_party" : "player",
    owner_namespace: row.owner_namespace,
    owner_user_id: first ? null : z.string().uuid().parse(row.owner_user_id),
    release_state: z.enum(["internal", "published"]).parse(row.release_state),
    visibility: first
      ? row.release_state === "published"
        ? "public"
        : "private"
      : z.string().parse(row.visibility),
    is_official: first,
    display_name:
      text(body.display_name) ?? text(raw.display_name) ?? text(raw.name),
    entity_type: type,
    kind: type.toLowerCase(),
    raw_data: raw,
    world_id: text(body.world_id) ?? (first ? text(body.world_key) : null),
    primary_image_url: text(body.primary_image_url),
    icon_image_url: text(body.icon_image_url),
    description_short: text(body.description_short ?? raw.description_short),
    description_long: text(body.description_long ?? raw.description_long),
    images: z.array(z.unknown()).parse(body.images ?? raw.images ?? []),
    tags: z.array(z.string()).parse(first ? (body.tags ?? []) : []),
    ...(state === undefined ? {} : { base_state_json: object(state) }),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
function card(entity: EntityRead): EntityReadCard {
  return {
    id: entity.id,
    slug: entity.slug,
    display_name: entity.display_name,
    entity_type: entity.entity_type,
    primary_image_url: entity.primary_image_url,
    updated_at: entity.updated_at,
    visibility: entity.visibility,
    is_official: entity.is_official,
    owner_user_id: entity.owner_user_id,
    world_id: entity.world_id,
  };
}

/** Audience checks precede every request; mutable values catch up before hits and after fills. */
export class EntityContentReadService {
  static forRequest(req: Request, traceId: string): EntityContentReadService {
    return new EntityContentReadService(
      EntityContentReadRepository.forRequest(req),
      req.user?.id ?? null,
      traceId,
    );
  }
  private audience: Promise<boolean> | undefined;
  constructor(
    private readonly repo: Pick<
      EntityContentReadRepository,
      | "isAdmin"
      | "resolve"
      | "worldKey"
      | "firstPartyAliases"
      | "list"
      | "find"
      | "tags"
    >,
    private readonly owner: string | null,
    private readonly traceId: string,
    private readonly cache: Pick<
      ContentCacheService,
      "read"
    > = getContentCache(),
  ) {
    if (owner !== null) z.string().uuid().parse(owner);
  }
  private admin(): Promise<boolean> {
    return (this.audience ??=
      this.owner === null ? Promise.resolve(false) : this.repo.isAdmin());
  }
  private async safe<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      console.error(
        JSON.stringify({
          level: "error",
          event: "entity_content_read_failed",
          traceId: this.traceId,
        }),
      );
      throw new ServiceError(503, {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: "Entity content is temporarily unavailable.",
      });
    }
  }
  private allowed(value: EntityRead, admin: boolean): boolean {
    return value.owner_kind === "first_party"
      ? admin || value.release_state === "published"
      : value.owner_user_id === this.owner || value.visibility === "public";
  }
  private missing(): never {
    throw new ServiceError(404, {
      code: ApiErrorCode.NOT_FOUND,
      message: "Entity not found.",
    });
  }
  private lane(
    lane: EntityReadLane,
    admin: boolean,
    params: EntityReadQuery,
    worldKey: string | null,
    order: "created_at" | "updated_at",
  ): Promise<EntityRead[]> {
    const filter: Record<string, string> = params.world_id
      ? lane === "first_party"
        ? { world_key: worldKey ?? params.world_id }
        : { world_id: params.world_id }
      : {};
    const address = {
      type: "list" as const,
      kind: "entity",
      audience: `entity-reader:${lane}:${admin ? "admin" : "published"}:${order}`,
      filter,
      page: `${String(params.offset)}:${String(params.limit)}`,
    };
    return this.cache.read<EntityRead[]>(
      lane === "owner"
        ? {
            ...address,
            scope: "owner",
            owner: z.string().uuid().parse(this.owner),
          }
        : { ...address, scope: "shared" },
      async () => {
        const rows = await this.repo.list(
          lane,
          admin,
          this.owner,
          params,
          worldKey,
          order,
        );
        const aliases =
          lane === "first_party"
            ? await this.repo.firstPartyAliases(rows.map((r) => r.content_key))
            : [];
        return rows
          .map((r) =>
            dto(
              r,
              aliases.find((a) => a.content_key === r.content_key),
            ),
          )
          .filter(
            (v) =>
              this.allowed(v, admin) &&
              (lane !== "owner" || v.owner_user_id === this.owner) &&
              (lane !== "public" || v.visibility === "public"),
          );
      },
      this.traceId,
    );
  }
  list(
    params: EntityReadQuery,
    mode: EntityReadMode = "library",
  ): Promise<(EntityRead | EntityReadCard)[]> {
    return this.safe(async () => {
      if (this.owner === null)
        throw new ServiceError(401, {
          code: ApiErrorCode.UNAUTHORIZED,
          message: "Authentication required.",
        });
      const admin = await this.admin();
      const worldKey = params.world_id
        ? await this.repo.worldKey(EntityReadIdSchema.parse(params.world_id))
        : null;
      const lanes: EntityReadLane[] =
        mode === "library" ? ["first_party", "public", "owner"] : ["owner"];
      const rows = (
        await Promise.all(
          lanes.map((l) =>
            this.lane(
              l,
              admin,
              params,
              worldKey,
              mode === "rawOwned" ? "created_at" : "updated_at",
            ),
          ),
        )
      ).flat();
      const seen = new Set<string>();
      const page = rows
        .filter((r) => {
          const key = `${r.owner_namespace}:${r.content_key}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(params.offset, params.offset + params.limit);
      return mode === "rawOwned" ? page : page.map(card);
    });
  }
  find(id: string): Promise<EntityRead> {
    return this.safe(async () => {
      EntityReadIdSchema.parse(id);
      const admin = await this.admin(),
        identity = await this.repo.resolve(id);
      const namespace = identity?.owner_namespace ?? "first_party",
        key = identity?.content_key ?? id;
      const owned = namespace === this.owner;
      if (
        namespace !== "first_party" &&
        !owned &&
        identity?.visibility !== "public"
      )
        return this.missing();
      const address = {
        type: "source" as const,
        kind: "entity",
        namespace,
        key,
        audience: `entity-reader:${admin ? "admin" : "published"}`,
      };
      const value = await this.cache.read<EntityRead | null>(
        owned
          ? { ...address, scope: "owner", owner: this.owner }
          : { ...address, scope: "shared" },
        async () => {
          const row = await this.repo.find(namespace, key, admin, this.owner);
          if (row === null) return null;
          const entity = dto(row, identity ?? undefined);
          return this.allowed(entity, admin) ? entity : null;
        },
        this.traceId,
      );
      if (value === null) return this.missing();
      // Relations have separate tag/asset_tag events, so never store them in entity entries.
      // Canonical source bodies carry authored tags directly; UUID projections use RLS joins.
      if (value.owner_kind === "player")
        return { ...value, tags: await this.repo.tags(value.id) };
      return value;
    });
  }
}
