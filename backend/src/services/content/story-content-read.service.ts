import type { Request } from "express";
import { z } from "zod";
import { StoryContentReadRepository } from "../../db/repos/story-content-read.repo.js";
import { WorldContentReadService } from "./world-content-read.service.js";
import {
  getContentCache,
  type ContentCacheService,
} from "./content-cache.service.js";
import { ServiceError } from "../../utils/serviceError.js";
import { ApiErrorCode } from "../../../../shared/src/types/api.js";
import {
  StoryReadIdSchema,
  type StorySourceRead,
  type StoryRead,
  type StoryReadQuery,
  type StoryCatalogRead,
} from "../../../../shared/src/types/chimera-story-read.js";
import type { WorldRead } from "../../../../shared/src/types/chimera-world-read.js";

/** Cache source bodies only. World dependencies authorize and catch up separately per request. */
export class StoryContentReadService {
  static forRequest(
    req: Request | undefined,
    traceId: string,
  ): StoryContentReadService {
    return new StoryContentReadService(
      StoryContentReadRepository.forRequest(req),
      WorldContentReadService.forRequest(req, traceId),
      req?.user?.id ?? null,
      traceId,
    );
  }
  constructor(
    private readonly repo: Pick<
      StoryContentReadRepository,
      "resolve" | "list" | "find"
    >,
    private readonly worlds: Pick<WorldContentReadService, "find">,
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
          event: "story_content_read_failed",
          traceId: this.traceId,
        }),
      );
      throw new ServiceError(503, {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: "Story content is temporarily unavailable.",
      });
    }
  }
  private missing(): never {
    throw new ServiceError(404, {
      code: ApiErrorCode.NOT_FOUND,
      message: "Story not found.",
    });
  }
  private allowed(s: StorySourceRead): boolean {
    return (
      s.owner_namespace === s.owner_user_id &&
      (s.owner_user_id === this.owner || s.visibility === "public")
    );
  }
  private playable(s: StorySourceRead): boolean {
    return (
      (s.status === "compiled" || s.status === "bound") &&
      s.current_compiled_id !== null
    );
  }
  private async world(id: string | null): Promise<WorldRead | null> {
    if (id === null) return null;
    try {
      return await this.worlds.find(id);
    } catch (error) {
      if (error instanceof ServiceError && error.statusCode === 404)
        return null;
      throw error;
    }
  }
  private sourceList(
    params: StoryReadQuery,
    owned: boolean,
  ): Promise<StorySourceRead[]> {
    const filter: Record<string, string> = params.search
      ? { search: params.search }
      : {};
    const address = {
      type: "list" as const,
      kind: "story",
      audience: `story-reader:${owned ? "owner" : "public-playable"}`,
      filter,
      page: `${String(params.offset)}:${String(params.limit)}`,
    };
    return this.cache.read<StorySourceRead[]>(
      owned
        ? {
            ...address,
            scope: "owner",
            owner: z.string().uuid().parse(this.owner),
          }
        : { ...address, scope: "shared" },
      async () => {
        const rows = await this.repo.list(owned ? this.owner : null, params);
        return rows.filter(
          (s) =>
            this.allowed(s) &&
            (owned
              ? s.owner_user_id === this.owner
              : s.visibility === "public" && this.playable(s)),
        );
      },
      this.traceId,
    );
  }
  list(params: StoryReadQuery): Promise<StoryRead[]> {
    return this.safe(async () => {
      if (this.owner === null)
        throw new ServiceError(401, {
          code: ApiErrorCode.UNAUTHORIZED,
          message: "Authentication required.",
        });
      const rows = await this.sourceList(params, true);
      const worlds = new Map<string, Promise<WorldRead | null>>();
      return Promise.all(
        rows.map(async (s) => {
          let world: WorldRead | null = null;
          if (s.world_id !== null) {
            let pending = worlds.get(s.world_id);
            if (pending === undefined) {
              pending = this.world(s.world_id);
              worlds.set(s.world_id, pending);
            }
            world = await pending;
          }
          return {
            ...s,
            world:
              world === null
                ? null
                : {
                    id: world.id,
                    name: world.name,
                    description_short: world.description_short,
                  },
          };
        }),
      );
    });
  }
  private async source(id: string): Promise<StorySourceRead> {
    StoryReadIdSchema.parse(id);
    const identity = await this.repo.resolve(id);
    if (
      identity === null ||
      identity.owner_kind !== "player" ||
      (identity.owner_user_id !== this.owner &&
        identity.visibility !== "public")
    )
      return this.missing();
    const address = {
      type: "source" as const,
      kind: "story",
      namespace: identity.owner_namespace,
      key: identity.content_key,
      audience: "story-reader:player",
    };
    const value = await this.cache.read<StorySourceRead | null>(
      identity.owner_user_id === this.owner
        ? {
            ...address,
            scope: "owner",
            owner: z.string().uuid().parse(this.owner),
          }
        : { ...address, scope: "shared" },
      async () => {
        const s = await this.repo.find(
          identity.owner_namespace,
          identity.content_key,
          this.owner,
        );
        return s !== null && this.allowed(s) ? s : null;
      },
      this.traceId,
    );
    return value ?? this.missing();
  }
  find(id: string): Promise<StoryRead> {
    return this.safe(async () => {
      const s = await this.source(id),
        w = await this.world(s.world_id);
      return {
        ...s,
        world:
          w === null
            ? null
            : {
                id: w.id,
                name: w.name,
                description_short: w.description_short,
              },
      };
    });
  }
  catalogList(params: StoryReadQuery): Promise<StoryCatalogRead[]> {
    return this.safe(async () =>
      (await this.sourceList(params, false)).map((s) => this.catalog(s, null)),
    );
  }
  catalogFind(id: string): Promise<StoryCatalogRead> {
    return this.safe(async () => {
      const s = await this.source(id);
      if (s.visibility !== "public" || !this.playable(s)) return this.missing();
      return this.catalog(s, await this.world(s.world_id));
    });
  }
  private catalog(s: StorySourceRead, w: WorldRead | null): StoryCatalogRead {
    return {
      id: s.id,
      slug: s.id,
      type: "story",
      title: s.title || s.display_name,
      subtitle: null,
      description: s.description ?? s.description_short,
      synopsis: s.description_short,
      tags: [],
      world_id: s.world_id,
      world_name: w?.name ?? null,
      world_slug: w?.slug ?? null,
      content_rating: s.content_rating,
      is_playable: this.playable(s),
      has_prompt:
        typeof s.opening_text === "string" && s.opening_text.trim().length > 0,
      cover_media:
        s.image_url === null
          ? null
          : { id: null, provider_key: s.image_url, url: s.image_url },
      rulesets: z.array(z.string()).parse(s.configuration?.rulesetIds ?? []),
      created_at: s.created_at,
      updated_at: s.updated_at,
    };
  }
}
