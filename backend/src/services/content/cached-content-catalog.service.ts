import { z } from "zod";
import type { ContentKeyRef } from "../../../../shared/src/types/chimera-content.js";
import { ContentCatalogRepository } from "../../db/repos/content-catalog.repo.js";
import {
  getContentCache,
  type ContentCacheService,
} from "./content-cache.service.js";
import { ServiceError } from "../../utils/serviceError.js";
import { ApiErrorCode } from "../../../../shared/src/types/api.js";

/** Authorize the request before using the process-wide internal-content cache. */
export class CachedContentCatalogService {
  private audience: Promise<boolean> | undefined;
  constructor(
    private readonly repo: Pick<
      ContentCatalogRepository,
      "getGeneration" | "find" | "cacheAudience"
    >,
    private readonly traceId: string,
    private readonly cache: () => Pick<
      ContentCacheService,
      "read"
    > = getContentCache,
  ) {}
  getGeneration() {
    return this.repo.getGeneration();
  }
  async find(ref: ContentKeyRef) {
    this.audience ??= this.authorize();
    if (!(await this.audience) || ref.owner_namespace !== "first_party")
      return this.repo.find(ref);
    return this.cache().read(
      {
        scope: "shared",
        type: "source",
        kind: ref.kind,
        namespace: ref.owner_namespace,
        key: ref.key,
        audience: "admin",
      },
      () => this.repo.find(ref),
      this.traceId,
    );
  }
  private async authorize() {
    try {
      return z.boolean().parse(await this.repo.cacheAudience());
    } catch {
      console.error(
        JSON.stringify({
          level: "error",
          event: "content_cache_authorization_failed",
          traceId: this.traceId,
        }),
      );
      throw new ServiceError(503, {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: "Content authorization is temporarily unavailable.",
      });
    }
  }
}
