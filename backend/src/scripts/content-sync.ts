import {
  ContentSyncService,
  ContentSyncError,
} from "../services/content/content-sync.service.js";
import { ContentSyncTargetService } from "../services/content/content-sync-target.service.js";

try {
  const { connectionString, policy } = new ContentSyncTargetService().resolve(
    process.argv.slice(2),
    process.env,
  );
  const receipt = await new ContentSyncService().sync(connectionString, policy);
  console.log(JSON.stringify({ target: policy.target, ...receipt }));
} catch (error) {
  console.error(
    error instanceof ContentSyncError ? error.message : "Content sync failed",
  );
  process.exitCode = error instanceof ContentSyncError ? error.exitCode : 1;
}
