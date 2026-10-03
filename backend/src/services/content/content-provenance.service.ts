import {
  ContentDeployMetadataSchema,
  type ContentDeployMetadata,
} from "../../../../shared/src/types/chimera-content-deploy.js";
import { ApiErrorCode } from "../../../../shared/src/types/api.js";
import { ContentGitRepository } from "../../db/repos/content-git.repo.js";
import { ServiceError } from "../../utils/serviceError.js";

export class ContentProvenanceService {
  constructor(
    private readonly repository: Pick<
      ContentGitRepository,
      "head" | "read"
    > = new ContentGitRepository(),
  ) {}
  resolve(): ContentDeployMetadata {
    try {
      return ContentDeployMetadataSchema.parse({
        commit_sha: this.repository.head(),
      });
    } catch {
      console.error(
        JSON.stringify({
          level: "error",
          event: "content_provenance_failed",
          traceId: "content-sync-cli",
        }),
      );
      throw new ServiceError(400, {
        code: ApiErrorCode.VALIDATION_FAILED,
        message:
          "Content deployment requires a Git commit and a clean content/first-party tree. Commit content changes before syncing.",
      });
    }
  }
  read(metadata: ContentDeployMetadata, file: string): string {
    try {
      const commit = ContentDeployMetadataSchema.parse(metadata).commit_sha;
      if (!/^[a-z][a-z-]*\.json$/.test(file))
        throw new ServiceError(400, {
          code: ApiErrorCode.VALIDATION_FAILED,
          message: "Invalid content file",
        });
      return this.repository.read(commit, file);
    } catch {
      console.error(
        JSON.stringify({
          level: "error",
          event: "content_commit_read_failed",
          traceId: "content-sync-cli",
        }),
      );
      throw new ServiceError(400, {
        code: ApiErrorCode.VALIDATION_FAILED,
        message: "Unable to read committed first-party content.",
      });
    }
  }
}
