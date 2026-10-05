import type { Request } from "express";
import {
  LoreContentWriteRepository,
  LoreWriteRepositoryError,
} from "../../db/repos/lore-content-write.repo.js";
import { ServiceError } from "../../utils/serviceError.js";
import { ApiErrorCode } from "../../../../shared/src/types/api.js";
import type {
  LoreCreate,
  LoreUpdate,
} from "../../../../shared/src/types/chimera-lore-write.js";

function tags<T extends LoreCreate | LoreUpdate>(data: T): T {
  if (data.tag_names === undefined) return data;
  const normalized = data.tag_names.map((v) =>
    v
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_")
      .replace(/[^A-Z0-9_]/g, ""),
  );
  if (normalized.some((v) => v.length === 0))
    throw new ServiceError(422, {
      code: ApiErrorCode.VALIDATION_FAILED,
      message: "Tag names must contain supported characters.",
    });
  return { ...data, tag_names: [...new Set(normalized)].sort() };
}
export class LoreContentWriteService {
  static forRequest(req: Request, traceId: string): LoreContentWriteService {
    return new LoreContentWriteService(
      LoreContentWriteRepository.forRequest(req),
      req.user?.id ?? null,
      traceId,
    );
  }
  constructor(
    private readonly repo: Pick<LoreContentWriteRepository, "write">,
    private readonly owner: string | null,
    private readonly traceId: string,
  ) {}
  create(data: LoreCreate) {
    return this.safe(() => this.repo.write("create", null, tags(data)));
  }
  update(id: string, data: LoreUpdate) {
    return this.safe(() => this.repo.write("update", id, tags(data)));
  }
  delete(id: string) {
    return this.safe(() => this.repo.write("delete", id, {}));
  }
  private async safe<T>(action: () => Promise<T>): Promise<T> {
    try {
      if (this.owner === null)
        throw new ServiceError(401, {
          code: ApiErrorCode.UNAUTHORIZED,
          message: "Authentication required.",
        });
      return await action();
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      if (error instanceof LoreWriteRepositoryError) {
        if (error.code === "P0002")
          throw new ServiceError(404, {
            code: ApiErrorCode.NOT_FOUND,
            message: "Owned lore or context not found.",
          });
        if (
          error.code === "42501" ||
          error.reason === "STORY_READ_ONLY_TIER_LIMIT"
        )
          throw new ServiceError(403, {
            code: ApiErrorCode.FORBIDDEN,
            message: "Lore changes are not permitted.",
          });
        if (["22023", "22P02", "23514"].includes(error.code))
          throw new ServiceError(422, {
            code: ApiErrorCode.VALIDATION_FAILED,
            message: "Invalid lore changes.",
          });
        if (["23505", "40001", "40P01"].includes(error.code))
          throw new ServiceError(409, {
            code: ApiErrorCode.CONFLICT,
            message: "Lore changed concurrently. Reload before trying again.",
          });
      }
      console.error(
        JSON.stringify({
          level: "error",
          event: "lore_content_write_failed",
          traceId: this.traceId,
        }),
      );
      throw new ServiceError(503, {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: "Lore changes are temporarily unavailable.",
      });
    }
  }
}
