import { z } from "zod";
import { NpcCatalogReadRepository } from "../../db/repos/npc-catalog-read.repo.js";
import {
  EntityContentReadService,
  mapEntityContentRow,
} from "./entity-content-read.service.js";
import {
  getContentCache,
  type ContentCacheService,
} from "./content-cache.service.js";
import { ServiceError } from "../../utils/serviceError.js";
import { ApiErrorCode } from "../../../../shared/src/types/api.js";
import type { EntityRead } from "../../../../shared/src/types/chimera-entity-read.js";
import type {
  NpcCatalogRead,
  NpcCatalogQuery,
  NpcCatalogPage,
} from "../../../../shared/src/types/chimera-npc-catalog-read.js";

const text = (v: unknown): string | null => (typeof v === "string" ? v : null);
function npc(entity: EntityRead): NpcCatalogRead {
  if (entity.entity_type !== "NPC")
    throw new ServiceError(404, {
      code: ApiErrorCode.NOT_FOUND,
      message: "NPC not found.",
    });
  const raw = entity.raw_data;
  const cover = entity.images[0];
  const image = cover == null ? null : z.record(z.unknown()).parse(cover);
  return {
    id: entity.id,
    name: entity.display_name,
    slug: entity.slug,
    description:
      entity.description_short ??
      text(raw.description) ??
      entity.description_long,
    worldId: entity.world_id ?? text(raw.world_id),
    status: text(raw.status),
    visibility: entity.visibility,
    archetype: text(raw.archetype),
    roleTags: z.array(z.string()).parse(raw.role_tags ?? raw.tags ?? []),
    portraitUrl: text(raw.portrait_url) ?? entity.primary_image_url,
    cover_media:
      image === null
        ? null
        : {
            id: text(image.id),
            provider_key: text(image.url) ?? text(image.provider_key),
          },
    doc: raw,
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
  };
}
/** Public authoring catalog; it is not the session's learned-NPC knowledge view. */
export class NpcCatalogReadService {
  static forPublic(traceId: string): NpcCatalogReadService {
    return new NpcCatalogReadService(
      NpcCatalogReadRepository.forPublic(),
      EntityContentReadService.forRequest(undefined, traceId),
      traceId,
    );
  }
  constructor(
    private readonly repo: Pick<
      NpcCatalogReadRepository,
      "list" | "worldKey" | "firstPartyAliases"
    >,
    private readonly entities: Pick<EntityContentReadService, "find">,
    private readonly traceId: string,
    private readonly cache: Pick<
      ContentCacheService,
      "read"
    > = getContentCache(),
  ) {}
  private async safe<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      console.error(
        JSON.stringify({
          level: "error",
          event: "npc_catalog_read_failed",
          traceId: this.traceId,
        }),
      );
      throw new ServiceError(503, {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: "NPC content is temporarily unavailable.",
      });
    }
  }
  list(params: NpcCatalogQuery): Promise<NpcCatalogPage> {
    return this.safe(async () => {
      const worldKey = params.world
        ? await this.repo.worldKey(params.world)
        : null;
      // Both canonical keys and UUID world references participate in this merged page.
      // Unknown facets conservatively invalidate it; never AND incompatible world facets.
      const filter = {
        entity_type: "NPC",
        catalog_world: params.world ?? "",
        canonical_world: worldKey ?? "",
        search: params.q || params.search || "",
        active_only: String(params.activeOnly),
      };
      return this.cache.read<NpcCatalogPage>(
        {
          type: "list",
          scope: "shared",
          kind: "entity",
          audience: "npc-catalog:published",
          filter,
          page: `${String(params.offset)}:${String(params.limit)}`,
        },
        async () => {
          const result = await this.repo.list(params, worldKey);
          const aliases = await this.repo.firstPartyAliases(
            result.items
              .filter((r) => r.owner_namespace === "first_party")
              .map((r) => r.content_key),
          );
          return {
            items: result.items.map((row) =>
              npc(
                mapEntityContentRow(
                  row,
                  aliases.find((a) => a.content_key === row.content_key),
                ),
              ),
            ),
            total: result.total,
            limit: params.limit,
            offset: params.offset,
          };
        },
        this.traceId,
      );
    });
  }
  find(id: string): Promise<NpcCatalogRead> {
    return this.safe(async () => npc(await this.entities.find(id)));
  }
}
