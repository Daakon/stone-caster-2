import { ContentChangesRepository } from "../../db/repos/content-changes.repo.js";
import {
  ContentChangePageSchema,
  type ContentOwnerCursor,
} from "../../../../shared/src/types/chimera-content-changes.js";
import { ApiErrorCode } from "../../../../shared/src/types/api.js";
import { ServiceError } from "../../utils/serviceError.js";

export class ContentChangePollerService {
  constructor(
    private readonly repo: Pick<
      ContentChangesRepository,
      "page"
    > = new ContentChangesRepository(),
  ) {}
  async page(
    after: string | null,
    owners: ContentOwnerCursor[],
    traceId: string,
  ) {
    try {
      const page = ContentChangePageSchema.parse(
        await this.repo.page(after, owners),
      );
      const expected = new Set(owners.map((owner) => owner.user_id));
      if (
        page.owners.length !== expected.size ||
        new Set(page.owners.map((owner) => owner.user_id)).size !==
          expected.size ||
        page.owners.some((owner) => !expected.has(owner.user_id))
      )
        throw new ServiceError(503, {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: "Content owner probe did not match the active owner set.",
        });
      return page;
    } catch {
      console.error(
        JSON.stringify({
          level: "error",
          event: "content_change_probe_failed",
          traceId,
        }),
      );
      throw new ServiceError(503, {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: "Content changes are temporarily unavailable.",
      });
    }
  }
}
