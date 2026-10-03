import { randomUUID } from "node:crypto";
import { ContentProvenanceService } from "./content-provenance.service.js";
import { ServiceError } from "../../utils/serviceError.js";
import { ApiErrorCode } from "../../../../shared/src/types/api.js";
import {
  ContentSourceService,
  type ValidatedContentBundle,
} from "./content-source.service.js";
import {
  ContentSyncRepository,
  type ContentSyncReceipt,
} from "../../db/repos/content-sync.repo.js";

export class ContentSyncError extends ServiceError {
  constructor(
    message: string,
    public readonly exitCode: number,
  ) {
    super(exitCode === 2 ? 400 : 500, {
      code:
        exitCode === 2
          ? ApiErrorCode.VALIDATION_FAILED
          : ApiErrorCode.INTERNAL_ERROR,
      message,
    });
    this.name = "ContentSyncError";
  }
}

export class ContentSyncService {
  constructor(
    private readonly source: Pick<
      ContentSourceService,
      "loadAndValidate"
    > = new ContentSourceService(),
    private readonly repository: Pick<
      ContentSyncRepository,
      "apply"
    > = new ContentSyncRepository(),
    private readonly provenance: Pick<
      ContentProvenanceService,
      "resolve" | "read"
    > = new ContentProvenanceService(),
  ) {}

  validate(reader?: (file: string) => string): ValidatedContentBundle {
    try {
      return this.source.loadAndValidate(reader);
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "content_validate_failed",
          traceId: "content-sync-cli",
          message:
            error instanceof Error ? error.message : "unknown validation error",
        }),
      );
      throw new ContentSyncError(
        error instanceof Error
          ? error.message
          : "First-party content validation failed",
        2,
      );
    }
  }

  async sync(connectionString: string): Promise<ContentSyncReceipt> {
    let metadata;
    try {
      metadata = this.provenance.resolve();
    } catch {
      console.error(
        JSON.stringify({
          level: "error",
          event: "content_provenance_failed",
          traceId: "content-sync-cli",
        }),
      );
      throw new ContentSyncError(
        "Content deployment requires committed content/first-party files and a valid Git HEAD.",
        2,
      );
    }
    const validated = this.validate((file) =>
      this.provenance.read(metadata, file),
    );
    try {
      const receipt = await this.repository.apply(
        connectionString,
        randomUUID(),
        validated.bundle,
        metadata,
      );
      if (
        receipt.manifest_hash !== validated.manifestHash ||
        receipt.item_count !== validated.itemCount ||
        receipt.commit_sha !== metadata.commit_sha
      )
        throw new ContentSyncError(
          "Content deployment receipt did not match the validated Git content.",
          1,
        );
      return receipt;
    } catch {
      console.error(
        JSON.stringify({
          level: "error",
          event: "content_sync_failed",
          traceId: "content-sync-cli",
          target: "local",
          commit_sha: metadata.commit_sha,
        }),
      );
      throw new ContentSyncError(
        "First-party content sync failed; no deployment success receipt was accepted.",
        1,
      );
    }
  }
}
