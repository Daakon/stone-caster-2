import type { Request } from "express";
import { z } from "zod";
import {
  AssetTagNamesSchema,
  AssetTagTypeSchema,
  type AssetTagType,
} from "../../../../shared/src/types/chimera-asset-tags.js";
import { ApiErrorCode } from "../../../../shared/src/types/api.js";
import {
  AssetTagWriteRepository,
  AssetTagWriteRepositoryError,
} from "../../db/repos/asset-tag-write.repo.js";
import { ServiceError } from "../../utils/serviceError.js";

export class AssetTagWriteService {
  static forRequest(req: Request, traceId: string) {
    return new AssetTagWriteService(
      AssetTagWriteRepository.forRequest(req),
      req.user?.id ?? null,
      traceId,
    );
  }
  constructor(
    private readonly repo: Pick<AssetTagWriteRepository, "replace">,
    private readonly owner: string | null,
    private readonly traceId: string,
  ) {}
  async replace(type: AssetTagType, id: string, names: string[]) {
    try {
      if (this.owner === null)
        throw new ServiceError(401, {
          code: ApiErrorCode.UNAUTHORIZED,
          message: "Authentication required.",
        });
      let input: { type: AssetTagType; id: string; names: string[] };
      try {
        input = {
          type: AssetTagTypeSchema.parse(type),
          id: z.string().uuid().parse(id),
          names: AssetTagNamesSchema.parse(names),
        };
      } catch (error) {
        if (error instanceof z.ZodError)
          throw new ServiceError(422, {
            code: ApiErrorCode.VALIDATION_FAILED,
            message: "Invalid asset tags.",
          });
        throw error;
      }
      return await this.repo.replace(input.type, input.id, input.names);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      if (error instanceof AssetTagWriteRepositoryError) {
        if (error.code === "P0002")
          throw new ServiceError(404, {
            code: ApiErrorCode.NOT_FOUND,
            message: "Owned asset not found.",
          });
        if (error.code === "42501")
          throw new ServiceError(403, {
            code: ApiErrorCode.FORBIDDEN,
            message: "Tag changes are not permitted.",
          });
        if (["22023", "22P02", "23514"].includes(error.code))
          throw new ServiceError(422, {
            code: ApiErrorCode.VALIDATION_FAILED,
            message: "Invalid asset tags.",
          });
        if (["23505", "40001", "40P01"].includes(error.code))
          throw new ServiceError(409, {
            code: ApiErrorCode.CONFLICT,
            message: "Tags changed concurrently. Reload before trying again.",
          });
      }
      console.error(
        JSON.stringify({
          level: "error",
          event: "asset_tag_write_failed",
          traceId: this.traceId,
        }),
      );
      throw new ServiceError(503, {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: "Tag changes are temporarily unavailable.",
      });
    }
  }
}
