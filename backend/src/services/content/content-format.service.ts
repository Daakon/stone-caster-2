import type { Request } from "express";
import {
  ContentFormatInventorySchema,
  ContentReadinessSchema,
  SUPPORTED_CONTENT_FORMAT,
  type ContentReadiness,
} from "../../../../shared/src/types/chimera-content-readiness.js";
import { ApiErrorCode } from "../../../../shared/src/types/api.js";
import { ContentFormatRepository } from "../../db/repos/content-format.repo.js";
import { getTraceId } from "../../utils/response.js";
import { ServiceError } from "../../utils/serviceError.js";

export class ContentFormatService {
  constructor(
    private readonly repo: Pick<
      ContentFormatRepository,
      "inventory"
    > = new ContentFormatRepository(),
    private readonly traceId = "content-readiness",
  ) {}
  static forRequest(request: Request) {
    return new ContentFormatService(
      new ContentFormatRepository(),
      getTraceId(request),
    );
  }
  async readiness(): Promise<ContentReadiness> {
    let inventory;
    try {
      inventory = ContentFormatInventorySchema.parse(
        await this.repo.inventory(),
      );
    } catch {
      console.error(
        JSON.stringify({
          level: "error",
          event: "content_readiness_unavailable",
          traceId: this.traceId,
        }),
      );
      throw this.unavailable(false, "Content readiness is unavailable.");
    }
    const { min, max } = SUPPORTED_CONTENT_FORMAT;
    if (
      [
        inventory.source_min,
        inventory.source_max,
        inventory.blob_min,
        inventory.blob_max,
      ].some((version) => version !== null && (version < min || version > max))
    ) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "content_format_unsupported",
          traceId: this.traceId,
        }),
      );
      throw this.unavailable(
        true,
        "This build cannot read the stored content format.",
      );
    }
    return this.state(true, true);
  }
  private state(db: boolean, contentFormats: boolean): ContentReadiness {
    return ContentReadinessSchema.parse({
      status: db && contentFormats ? "ready" : "not_ready",
      checks: { db, contentFormats },
      timestamp: new Date().toISOString(),
    });
  }
  private unavailable(db: boolean, message: string) {
    return new ServiceError(503, {
      code: ApiErrorCode.INTERNAL_ERROR,
      message,
      details: this.state(db, false),
    });
  }
}
