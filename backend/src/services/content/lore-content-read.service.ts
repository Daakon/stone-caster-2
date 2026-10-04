import { z } from "zod";
import type { Request } from "express";
import {
  LoreContentReadRepository,
  type LoreContentRow,
  type LoreIdentity,
} from "../../db/repos/lore-content-read.repo.js";
import { WorldContentReadService } from "./world-content-read.service.js";
import { EntityContentReadService } from "./entity-content-read.service.js";
import { StoryContentReadService } from "./story-content-read.service.js";
import {
  getContentCache,
  type ContentCacheService,
} from "./content-cache.service.js";
import { ServiceError } from "../../utils/serviceError.js";
import { ApiErrorCode } from "../../../../shared/src/types/api.js";
import {
  EntityReadIdSchema,
  type EntityReadLane,
} from "../../../../shared/src/types/chimera-entity-read.js";
import type {
  LoreRead,
  LoreReadQuery,
  LoreReadContext,
  LoreContextQuery,
} from "../../../../shared/src/types/chimera-lore-read.js";
const object = (v: unknown): Record<string, unknown> =>
  z.record(z.unknown()).parse(v ?? {});
const text = (v: unknown): string | null => (typeof v === "string" ? v : null);
function dto(row: LoreContentRow, alias?: LoreIdentity): LoreRead {
  const first = row.owner_namespace === "first_party",
    body = first ? object(row.body) : row,
    fragment = object(body.fragment);
  const entry = text(fragment.entry_text) ?? text(fragment.content);
  return {
    id: first
      ? (alias?.id ?? row.content_key)
      : z.string().uuid().parse(row.id),
    content_key: row.content_key,
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
    world_id: text(body.world_id) ?? (first ? text(body.world_key) : null),
    entity_id: text(body.entity_id) ?? (first ? text(body.entity_key) : null),
    story_id: text(body.story_id),
    fragment,
    keywords: z.array(z.string()).parse(body.keywords ?? []),
    display_name: text(fragment.display_name),
    entry_text: entry,
    content_chunk: entry,
    type: text(fragment.type),
    embedding: null,
    tags: first ? z.array(z.string()).parse(fragment.tags ?? []) : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
/** Cache authored bodies only. Context access and tag relations stay fresh per request. */
export class LoreContentReadService {
  static forRequest(req: Request, traceId: string): LoreContentReadService {
    return new LoreContentReadService(
      LoreContentReadRepository.forRequest(req),
      {
        world: WorldContentReadService.forRequest(req, traceId),
        entity: EntityContentReadService.forRequest(req, traceId),
        story: StoryContentReadService.forRequest(req, traceId),
      },
      req.user?.id ?? null,
      traceId,
    );
  }
  private audience: Promise<boolean> | undefined;
  constructor(
    private readonly repo: Pick<
      LoreContentReadRepository,
      "isAdmin" | "resolve" | "firstPartyAliases" | "list" | "find" | "tags"
    >,
    private readonly parents: {
      world: Pick<WorldContentReadService, "find">;
      entity: Pick<EntityContentReadService, "find">;
      story: Pick<StoryContentReadService, "find">;
    },
    private readonly owner: string | null,
    private readonly traceId: string,
    private readonly cache: Pick<
      ContentCacheService,
      "read"
    > = getContentCache(),
  ) {
    if (owner !== null) z.string().uuid().parse(owner);
  }
  private async safe<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      console.error(
        JSON.stringify({
          level: "error",
          event: "lore_content_read_failed",
          traceId: this.traceId,
        }),
      );
      throw new ServiceError(503, {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: "Lore content is temporarily unavailable.",
      });
    }
  }
  private user(): string {
    if (this.owner === null)
      throw new ServiceError(401, {
        code: ApiErrorCode.UNAUTHORIZED,
        message: "Authentication required.",
      });
    return this.owner;
  }
  private admin(): Promise<boolean> {
    return (this.audience ??= this.repo.isAdmin());
  }
  private allowed(v: LoreRead, admin: boolean): boolean {
    return v.owner_kind === "first_party"
      ? admin || v.release_state === "published"
      : v.owner_user_id === this.owner || v.visibility === "public";
  }
  private missing(): never {
    throw new ServiceError(404, {
      code: ApiErrorCode.NOT_FOUND,
      message: "Lore entry not found.",
    });
  }
  private async context(q: LoreContextQuery): Promise<LoreReadContext> {
    if (q.entity_id) {
      const v = await this.parents.entity.find(q.entity_id);
      return {
        kind: "entity",
        id: z.string().uuid().safeParse(v.id).success ? v.id : null,
        key: v.content_key,
        namespace: v.owner_namespace,
      };
    }
    if (q.story_id) {
      const v = await this.parents.story.find(q.story_id);
      return {
        kind: "story",
        id: v.id,
        key: v.content_key,
        namespace: v.owner_namespace,
      };
    }
    if (q.world_id) {
      const v = await this.parents.world.find(q.world_id);
      return {
        kind: "world",
        id: z.string().uuid().safeParse(v.id).success ? v.id : null,
        key: v.content_key,
        namespace: v.owner_namespace,
      };
    }
    throw new ServiceError(422, {
      code: ApiErrorCode.VALIDATION_FAILED,
      message: "Lore context is required.",
    });
  }
  private async relations(rows: LoreRead[]): Promise<LoreRead[]> {
    const links = await this.repo.tags(
      rows.filter((r) => r.owner_kind === "player").map((r) => r.id),
    );
    return rows.map((r) =>
      r.owner_kind === "first_party"
        ? r
        : {
            ...r,
            tags: links.filter((l) => l.asset_id === r.id).map((l) => l.tag),
          },
    );
  }
  private lane(
    lane: EntityReadLane,
    admin: boolean,
    params: LoreReadQuery,
    context: LoreReadContext | null,
  ): Promise<LoreRead[]> {
    const filter: Record<string, string> = context
      ? { lore_context: JSON.stringify(context) }
      : {};
    const owner = this.user(),
      address = {
        type: "list" as const,
        kind: "lore",
        audience: `lore-reader:${lane}:${admin ? "admin" : "published"}`,
        filter,
        page: `${String(params.offset)}:${String(params.limit)}`,
      };
    return this.cache.read<LoreRead[]>(
      lane === "owner"
        ? { ...address, scope: "owner", owner }
        : { ...address, scope: "shared" },
      async () => {
        const rows = await this.repo.list(lane, admin, owner, params, context),
          aliases =
            lane === "first_party"
              ? await this.repo.firstPartyAliases(
                  rows.map((r) => r.content_key),
                )
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
              (lane !== "owner" || v.owner_user_id === owner) &&
              (lane !== "public" || v.visibility === "public"),
          );
      },
      this.traceId,
    );
  }
  list(params: LoreReadQuery): Promise<LoreRead[]> {
    return this.safe(async () => {
      this.user();
      const admin = await this.admin();
      return this.relations(
        (await this.lane("owner", admin, params, null)).slice(
          params.offset,
          params.offset + params.limit,
        ),
      );
    });
  }
  listContext(params: LoreContextQuery): Promise<LoreRead[]> {
    return this.safe(async () => {
      this.user();
      const admin = await this.admin(),
        context = await this.context(params);
      const rows = (
        await Promise.all(
          (["first_party", "public", "owner"] as const).map((l) =>
            this.lane(l, admin, params, context),
          ),
        )
      ).flat();
      const seen = new Set<string>();
      return this.relations(
        rows
          .filter((r) => {
            const key = `${r.owner_namespace}:${r.content_key}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(params.offset, params.offset + params.limit),
      );
    });
  }
  find(id: string): Promise<LoreRead> {
    return this.safe(async () => {
      const owner = this.user();
      EntityReadIdSchema.parse(id);
      const admin = await this.admin(),
        identity = await this.repo.resolve(id),
        namespace = identity?.owner_namespace ?? "first_party",
        key = identity?.content_key ?? id;
      if (
        namespace !== "first_party" &&
        namespace !== owner &&
        identity?.visibility !== "public"
      )
        return this.missing();
      const address = {
        type: "source" as const,
        kind: "lore",
        namespace,
        key,
        audience: `lore-reader:${admin ? "admin" : "published"}`,
      };
      const value = await this.cache.read<LoreRead | null>(
        namespace === owner
          ? { ...address, scope: "owner", owner }
          : { ...address, scope: "shared" },
        async () => {
          const row = await this.repo.find(namespace, key, admin, owner);
          if (row === null) return null;
          const v = dto(row, identity ?? undefined);
          return this.allowed(v, admin) ? v : null;
        },
        this.traceId,
      );
      if (value === null) return this.missing();
      return (await this.relations([value]))[0] ?? this.missing();
    });
  }
}
