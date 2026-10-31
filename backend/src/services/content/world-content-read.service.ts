import { z } from "zod";
import type { Request } from "express";
import {
  WorldContentReadRepository,
  type WorldContentRow,
  type WorldIdentity,
} from "../../db/repos/world-content-read.repo.js";
import {
  getContentCache,
  type ContentCacheService,
} from "./content-cache.service.js";
import { ServiceError } from "../../utils/serviceError.js";
import { ApiErrorCode } from "../../../../shared/src/types/api.js";
import type {
  WorldRead,
  WorldReadLane,
  WorldReadQuery,
  WorldCatalogRead,
} from "../../../../shared/src/types/chimera-world-read.js";

const object = (value: unknown): Record<string, unknown> =>
  z.record(z.unknown()).parse(value ?? {});
const text = (value: unknown): string | null =>
  typeof value === "string" ? value : null;
const strings = (value: unknown): string[] =>
  value == null ? [] : z.array(z.string()).parse(value);

function dto(row: WorldContentRow, alias?: WorldIdentity): WorldRead {
  const firstParty = row.owner_namespace === "first_party";
  const body = firstParty ? object(row.body) : row;
  const definition = object(body.definition);
  const name = z.string().parse(body.name);
  const key = row.content_key;
  return {
    id: firstParty ? (alias?.id ?? key) : z.string().uuid().parse(row.id),
    key,
    content_key: key,
    owner_kind: firstParty ? "first_party" : "player",
    owner_namespace: row.owner_namespace,
    owner_user_id: firstParty
      ? null
      : z.string().uuid().parse(row.owner_user_id),
    release_state: z.enum(["internal", "published"]).parse(row.release_state),
    visibility: firstParty
      ? row.release_state === "published"
        ? "public"
        : "private"
      : z.string().parse(row.visibility),
    is_official: firstParty,
    name,
    display_name: name,
    slug: text(body.slug) ?? key,
    definition,
    description_short: text(body.description_short),
    description_long: text(body.description_long),
    character_schema_contributions: object(
      body.character_schema_contributions ??
        definition.character_schema_contributions,
    ),
    tags: strings(body.tags),
    genre_tags: strings(body.genre_tags),
    images: z.array(z.unknown()).parse(definition.images ?? body.images ?? []),
    genre: text(body.genre ?? definition.genre),
    setting: text(body.setting ?? definition.setting),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Shared published/admin and authenticated owner values never share an address. */
export class WorldContentReadService {
  static forRequest(
    req: Request | undefined,
    traceId: string,
  ): WorldContentReadService {
    return new WorldContentReadService(
      WorldContentReadRepository.forRequest(req),
      req?.user?.id ?? null,
      traceId,
    );
  }
  private audience: Promise<boolean> | undefined;
  constructor(
    private readonly repo: Pick<
      WorldContentReadRepository,
      "isAdmin" | "resolve" | "list" | "find" | "firstPartyAliases"
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
  private admin() {
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
          event: "world_content_read_failed",
          traceId: this.traceId,
        }),
      );
      throw new ServiceError(503, {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: "World content is temporarily unavailable.",
      });
    }
  }
  private async lane(
    lane: WorldReadLane,
    admin: boolean,
    params: WorldReadQuery,
    recent: boolean,
  ) {
    const address = {
      type: "list" as const,
      kind: "world",
      audience: `world-reader:${lane}:${admin ? "admin" : "published"}:${recent ? "recent" : "name"}`,
      filter: {
        ...(params.tag ? { tags: params.tag } : {}),
        ...(params.search ? { search: params.search } : {}),
      },
      page: `${String(params.offset)}:${String(params.limit)}`,
    };
    return this.cache.read<WorldRead[]>(
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
          recent,
        );
        const aliases =
          lane === "first_party"
            ? await this.repo.firstPartyAliases(
                rows.map((row) => row.content_key),
              )
            : [];
        return rows
          .map((row) =>
            dto(
              row,
              aliases.find((alias) => alias.content_key === row.content_key),
            ),
          )
          .filter(
            (world) =>
              this.allowed(world, admin) &&
              (lane !== "owner" || world.owner_user_id === this.owner) &&
              (lane !== "public" || world.visibility === "public"),
          );
      },
      this.traceId,
    );
  }
  list(params: WorldReadQuery, ownedOnly = false): Promise<WorldRead[]> {
    return this.safe(async () => {
      if (ownedOnly && this.owner === null)
        throw new ServiceError(401, {
          code: ApiErrorCode.UNAUTHORIZED,
          message: "Authentication required.",
        });
      const admin = await this.admin();
      const lanes: WorldReadLane[] = ownedOnly
        ? ["owner"]
        : [
            "first_party",
            "public",
            ...(this.owner === null ? [] : ["owner" as const]),
          ];
      const rows = (
        await Promise.all(
          lanes.map((lane) => this.lane(lane, admin, params, ownedOnly)),
        )
      ).flat();
      const seen = new Set<string>();
      return rows
        .filter((row) => {
          const key = `${row.owner_namespace}:${row.content_key}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(params.offset, params.offset + params.limit);
    });
  }
  find(id: string): Promise<WorldRead> {
    return this.safe(async () => {
      const admin = await this.admin();
      const identity = await this.repo.resolve(id);
      const namespace = identity?.owner_namespace ?? "first_party";
      const key = identity?.content_key ?? id;
      const owned = namespace === this.owner;
      if (
        namespace !== "first_party" &&
        !owned &&
        identity?.visibility !== "public"
      )
        return this.missing();
      const address = {
        type: "source" as const,
        kind: "world",
        namespace,
        key,
        audience: `world-reader:${admin ? "admin" : "published"}`,
      };
      const value = await this.cache.read<WorldRead | null>(
        owned
          ? { ...address, scope: "owner", owner: this.owner }
          : { ...address, scope: "shared" },
        async () => {
          const row = await this.repo.find(namespace, key, admin, this.owner);
          if (row === null) return null;
          const world = dto(row, identity ?? undefined);
          return this.allowed(world, admin) ? world : null;
        },
        this.traceId,
      );
      return value ?? this.missing();
    });
  }
  async rulesets(id: string): Promise<unknown[]> {
    await this.find(id);
    // The existing endpoint returns no linked rulesets; no module is invented.
    return [];
  }
  private missing(): never {
    throw new ServiceError(404, {
      code: ApiErrorCode.NOT_FOUND,
      message: "World not found.",
    });
  }
  private allowed(world: WorldRead, admin: boolean): boolean {
    return world.owner_kind === "first_party"
      ? admin || world.release_state === "published"
      : world.owner_user_id === this.owner || world.visibility === "public";
  }
  async catalogList(params: WorldReadQuery): Promise<WorldCatalogRead[]> {
    return (await this.list(params)).map((world) => this.catalog(world));
  }
  async catalogFind(id: string): Promise<WorldCatalogRead> {
    return this.catalog(await this.find(id));
  }
  private catalog(world: WorldRead): WorldCatalogRead {
    const image = z.record(z.unknown()).safeParse(world.images[0]);
    const definition = world.definition;
    return {
      id: world.id,
      name: world.name,
      slug: world.slug,
      tagline: text(definition.tagline) ?? "",
      short_desc:
        text(
          definition.summary ?? definition.short_desc ?? definition.description,
        ) ??
        world.description_short ??
        "",
      hero_quote: text(definition.hero_quote) ?? "",
      status: "active",
      cover_media: image.success
        ? {
            id: text(image.data.id),
            provider_key: text(image.data.url ?? image.data.provider_key),
          }
        : null,
      created_at: world.created_at,
      updated_at: world.updated_at,
    };
  }
}
