import type { Request } from "express";
import { z } from "zod";
import { TagContentReadRepository } from "../../db/repos/tag-content-read.repo.js";
import { ServiceError } from "../../utils/serviceError.js";
import { ApiErrorCode } from "../../../../shared/src/types/api.js";
import type {
  TagRead,
  TagReadQuery,
} from "../../../../shared/src/types/chimera-tag-read.js";

/** Approval is not publication. Every selector page rechecks DB release/owner access. */
export class TagContentReadService {
  static forRequest(req: Request, traceId: string): TagContentReadService {
    return new TagContentReadService(
      TagContentReadRepository.forRequest(req),
      req.user?.id ?? null,
      traceId,
    );
  }
  constructor(
    private readonly repo: Pick<TagContentReadRepository, "list">,
    private readonly owner: string | null,
    private readonly traceId: string,
  ) {
    if (owner !== null) z.string().uuid().parse(owner);
  }
  async list(params: TagReadQuery): Promise<TagRead[]> {
    try {
      if (this.owner === null)
        throw new ServiceError(401, {
          code: ApiErrorCode.UNAUTHORIZED,
          message: "Authentication required.",
        });
      return await this.repo.list(params);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      console.error(
        JSON.stringify({
          level: "error",
          event: "tag_content_read_failed",
          traceId: this.traceId,
        }),
      );
      throw new ServiceError(503, {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: "Tags are temporarily unavailable.",
      });
    }
  }
}
