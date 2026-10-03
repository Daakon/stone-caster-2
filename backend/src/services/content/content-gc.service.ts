import { ApiErrorCode } from "../../../../shared/src/types/api.js";
import {
  ContentGcRequestSchema,
  ContentGcReceiptSchema,
  type ContentGcRequest,
  type ContentGcReceipt,
} from "../../../../shared/src/types/chimera-content-gc.js";
import { ContentGcRepository } from "../../db/repos/content-gc.repo.js";
import { ServiceError } from "../../utils/serviceError.js";

function invalid(message: string): ServiceError {
  return new ServiceError(400, {
    code: ApiErrorCode.VALIDATION_FAILED,
    message,
  });
}
export function parseContentGcArgs(args: string[]): ContentGcRequest {
  const targets = args.filter((arg) => arg.startsWith("--target="));
  const batches = args.filter((arg) => arg.startsWith("--batch-size="));
  if (
    targets.length !== 1 ||
    targets[0] !== "--target=local" ||
    batches.length !== 1 ||
    args.filter((arg) => arg === "--apply").length > 1 ||
    args.some(
      (arg) =>
        arg !== "--target=local" &&
        arg !== "--apply" &&
        !arg.startsWith("--batch-size="),
    )
  )
    throw invalid(
      "Use --target=local --batch-size=1..1000; add --apply only to perform cleanup.",
    );
  const text = batches[0]?.slice("--batch-size=".length);
  if (!text || !/^\d+$/.test(text))
    throw invalid("The GC batch size must be a whole number from 1 to 1000.");
  const parsed = ContentGcRequestSchema.safeParse({
    batch_size: Number(text),
    dry_run: !args.includes("--apply"),
  });
  if (!parsed.success)
    throw invalid("The GC batch size must be a whole number from 1 to 1000.");
  return parsed.data;
}
export class ContentGcService {
  constructor(
    private readonly repository: Pick<
      ContentGcRepository,
      "collect"
    > = new ContentGcRepository(),
  ) {}
  async collect(
    connectionString: string,
    request: ContentGcRequest,
  ): Promise<ContentGcReceipt> {
    const input = ContentGcRequestSchema.safeParse(request);
    if (!input.success)
      throw invalid(
        "GC requires explicit bounded batch size and dry-run flag.",
      );
    let endpoint: URL;
    try {
      endpoint = new URL(connectionString);
    } catch {
      throw invalid("A local PostgreSQL operator connection is required.");
    }
    if (
      endpoint.search ||
      endpoint.hash ||
      !["postgres:", "postgresql:"].includes(endpoint.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname) ||
      endpoint.port !== "54422"
    )
      throw invalid(
        "This GC slice accepts only the isolated local PostgreSQL port 54422.",
      );
    try {
      const output = ContentGcReceiptSchema.parse(
        await this.repository.collect(connectionString, input.data),
      );
      if (
        output.dry_run !== input.data.dry_run ||
        output.batch_size !== input.data.batch_size ||
        output.compiled_candidates > input.data.batch_size ||
        output.blob_candidates > input.data.batch_size ||
        output.compiled_deleted > output.compiled_candidates ||
        output.blobs_deleted > output.blob_candidates ||
        BigInt(output.bytes_reclaimed) > BigInt(output.bytes_eligible) ||
        (input.data.dry_run &&
          (output.compiled_deleted !== 0 ||
            output.blobs_deleted !== 0 ||
            output.bytes_reclaimed !== "0"))
      )
        throw new ServiceError(500, {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: "Invalid GC receipt",
        });
      return output;
    } catch {
      throw new ServiceError(500, {
        code: ApiErrorCode.INTERNAL_ERROR,
        message:
          "Snapshot cleanup failed. Check operator permissions and the GC migration; no success receipt was accepted.",
      });
    }
  }
}
