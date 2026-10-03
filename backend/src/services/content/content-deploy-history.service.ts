import type { Request } from "express";
import {
  ContentDeployHistorySchema,
  ContentDeployHistoryQuerySchema,
  type ContentDeployHistory,
} from "../../../../shared/src/types/chimera-content-deploy.js";
import { ApiErrorCode } from "../../../../shared/src/types/api.js";
import { ContentDeployHistoryRepository } from "../../db/repos/content-deploy-history.repo.js";
import { getTraceId } from "../../utils/response.js";
import { ServiceError } from "../../utils/serviceError.js";

export class ContentDeployHistoryService {
  constructor(
    private readonly repo: Pick<ContentDeployHistoryRepository, "page">,
    private readonly traceId = "content-deploy-history",
  ) {}
  static forRequest(request: Request) {
    return new ContentDeployHistoryService(
      ContentDeployHistoryRepository.forRequest(request),
      getTraceId(request),
    );
  }
  async page(input: unknown): Promise<ContentDeployHistory> {
    const query = ContentDeployHistoryQuerySchema.parse(input);
    try {
      return ContentDeployHistorySchema.parse(await this.repo.page(query));
    } catch {
      console.error(
        JSON.stringify({
          level: "error",
          event: "content_deploy_history_failed",
          traceId: this.traceId,
        }),
      );
      throw new ServiceError(503, {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: "Content deployment history is unavailable.",
      });
    }
  }
}
