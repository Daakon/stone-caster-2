import { ContentDeploymentGateService } from "../services/content/content-deployment-gate.service.js";
import { ContentSyncError } from "../services/content/content-sync.service.js";

try {
  await new ContentDeploymentGateService().check(
    process.argv.slice(2),
    process.env,
  );
  console.log(
    JSON.stringify({
      event: "content_deployment_protection_verified",
      commit_sha: process.env.GITHUB_SHA,
    }),
  );
} catch (error) {
  console.error(
    error instanceof ContentSyncError
      ? error.message
      : "Content deployment protection check failed.",
  );
  process.exitCode = error instanceof ContentSyncError ? error.exitCode : 1;
}
