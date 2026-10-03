import pg from "pg";
import type { ContentSyncBundleV1 } from "../../../../shared/src/types/chimera-content.js";
import {
  ContentDeployReceiptSchema,
  type ContentDeployMetadata,
  type ContentDeployReceipt,
} from "../../../../shared/src/types/chimera-content-deploy.js";

export type ContentSyncReceipt = ContentDeployReceipt;
export class ContentFleetGateError extends Error {
  constructor(public readonly reason: "unreported" | "unsupported") {
    super(
      reason === "unreported"
        ? "Content deployment is blocked until the verified runtime fleet is fully reported."
        : "Content deployment is blocked because a registered runtime build cannot read this format.",
    );
    this.name = "ContentFleetGateError";
  }
}

export class ContentSyncRepository {
  async apply(
    connectionString: string,
    deployId: string,
    bundle: ContentSyncBundleV1,
    metadata: ContentDeployMetadata,
  ): Promise<ContentSyncReceipt> {
    const client = new pg.Client({
      connectionString,
      application_name: "stonecaster-content-sync",
      connectionTimeoutMillis: 5000,
      statement_timeout: 30000,
      lock_timeout: 5000,
    });
    try {
      await client.connect();
      const { rows: generationRows } = await client.query<{
        catalog_generation: string;
        deployment_provenance_version: number;
        runtime_format_contract_version: number;
      }>(
        "select catalog_generation::text,deployment_provenance_version,runtime_format_contract_version from content_deploy.validation_formats limit 1",
      );
      if (!generationRows.length)
        throw new Error(
          "The content deploy role cannot read the validation format view",
        );
      if (generationRows[0]?.deployment_provenance_version !== 1)
        throw new Error(
          "Apply the content deployment provenance migration before syncing content",
        );
      if (generationRows[0]?.runtime_format_contract_version !== 1)
        throw new ContentFleetGateError("unreported");
      const expectedGeneration = Number(generationRows[0].catalog_generation);
      if (!Number.isSafeInteger(expectedGeneration))
        throw new Error("The content catalog generation is invalid");
      const { rows } = await client.query<{
        content_sync_apply: ContentSyncReceipt;
      }>(
        "select content_deploy.content_sync_apply($1::bigint, $2::uuid, $3::jsonb) as content_sync_apply",
        [
          expectedGeneration,
          deployId,
          JSON.stringify({ ...bundle, deployment: metadata }),
        ],
      );
      return ContentDeployReceiptSchema.parse(rows[0]?.content_sync_apply);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error.code === "P0F01" || error.code === "P0F02")
      )
        throw new ContentFleetGateError(
          error.code === "P0F01" ? "unreported" : "unsupported",
        );
      throw error;
    } finally {
      await client.end().catch(() => undefined);
    }
  }
}
