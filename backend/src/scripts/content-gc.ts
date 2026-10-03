import {
  ContentGcService,
  parseContentGcArgs,
} from "../services/content/content-gc.service.js";
import { ServiceError } from "../utils/serviceError.js";
import { ApiErrorCode } from "../../../shared/src/types/api.js";

try {
  const request = parseContentGcArgs(process.argv.slice(2));
  const connectionString = process.env.CONTENT_GC_DATABASE_URL;
  if (!connectionString)
    throw new ServiceError(400, {
      code: ApiErrorCode.VALIDATION_FAILED,
      message:
        "CONTENT_GC_DATABASE_URL is required; application or content-deployer credentials are not used.",
    });
  const receipt = await new ContentGcService().collect(
    connectionString,
    request,
  );
  console.log(
    JSON.stringify({
      event: "content_gc_completed",
      target: "local",
      ...receipt,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      event: "content_gc_failed",
      message:
        error instanceof ServiceError
          ? error.message
          : "Snapshot cleanup failed.",
    }),
  );
  process.exitCode =
    error instanceof ServiceError && error.statusCode === 400 ? 2 : 1;
}
