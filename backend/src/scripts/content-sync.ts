import { ContentSyncService } from "../services/content/content-sync.service.js";

function targetFromArgs(): string | undefined {
  return process.argv
    .slice(2)
    .find((argument) => argument.startsWith("--target="))
    ?.slice("--target=".length);
}

const target = targetFromArgs();
if (target !== "local") {
  console.error(
    "Content sync accepts only --target=local. Hosted targets require a later approved release gate.",
  );
  process.exit(2);
}
if (process.argv.slice(2).some((argument) => argument !== "--target=local")) {
  console.error("Unsupported content sync argument.");
  process.exit(2);
}
const connectionString = process.env.CONTENT_DEPLOY_DATABASE_URL;
if (!connectionString) {
  console.error(
    "CONTENT_DEPLOY_DATABASE_URL is required; no app or service-role credential is accepted.",
  );
  process.exit(2);
}
let databaseUrl: URL;
try {
  databaseUrl = new URL(connectionString);
} catch {
  console.error(
    "CONTENT_DEPLOY_DATABASE_URL must be a valid local PostgreSQL URL.",
  );
  process.exit(2);
}
if (
  databaseUrl.search ||
  databaseUrl.hash ||
  !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
  databaseUrl.port !== "54422" ||
  databaseUrl.username !== "stonecaster_content_deployer" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(
    databaseUrl.hostname.toLowerCase(),
  )
) {
  console.error(
    "Refusing content sync: --target=local requires the dedicated deploy login on loopback port 54422 without URL overrides.",
  );
  process.exit(2);
}

try {
  const receipt = await new ContentSyncService().sync(connectionString);
  console.log(
    JSON.stringify({
      target: "local",
      generation: receipt.generation,
      manifest_hash: receipt.manifest_hash,
      item_count: receipt.item_count,
      deploy_id: receipt.deploy_id,
      commit_sha: receipt.commit_sha,
      format_version: receipt.format_version,
      outcome: receipt.outcome,
      changed_keys: receipt.changed_keys,
      old_new_hashes: receipt.old_new_hashes,
    }),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Content sync failed");
  process.exitCode = 1;
}
