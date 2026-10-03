import { randomBytes } from "node:crypto";
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { bootstrapLocalContentFleet } from "./bootstrap-local-content-fleet.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localEnv = dotenv.parse(
  fs.readFileSync(path.join(root, ".env.stonecaster-local")),
);
const adminUrl = process.env.DATABASE_URL || localEnv.DATABASE_URL;
if (!adminUrl) throw new Error("The local database URL is missing.");
const adminDatabaseUrl = new URL(adminUrl);
if (
  !["localhost", "127.0.0.1", "::1", "[::1]"].includes(
    adminDatabaseUrl.hostname.toLowerCase(),
  )
) {
  throw new Error(
    "Refusing to provision the content deploy role for a non-local database.",
  );
}
if (adminDatabaseUrl.pathname !== "/postgres")
  throw new Error(
    "Local content seeding requires the Supabase postgres database.",
  );
if (
  adminDatabaseUrl.port !== "54422" ||
  adminDatabaseUrl.search ||
  adminDatabaseUrl.hash
)
  throw new Error(
    "Local content seeding requires the isolated stack without URL overrides.",
  );

const deployPassword = randomBytes(32).toString("base64url");
const admin = new pg.Client({
  connectionString: adminUrl,
  application_name: "stonecaster-local-content-role",
});
try {
  await admin.connect();
  await admin.query("begin");
  const commitSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  await bootstrapLocalContentFleet(admin, commitSha);
  const { rows } = await admin.query(
    "select format('alter role stonecaster_content_deployer login noinherit password %L', $1::text) as statement",
    [deployPassword],
  );
  await admin.query(rows[0].statement);
  await admin.query("commit");
} catch (error) {
  await admin.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await admin.end().catch(() => undefined);
}

const deployUrl = new URL(adminUrl);
deployUrl.username = "stonecaster_content_deployer";
deployUrl.password = deployPassword;
const run = spawnSync("npm.cmd run content:sync -- --target=local", {
  cwd: root,
  env: {
    ...process.env,
    ...localEnv,
    CONTENT_DEPLOY_DATABASE_URL: deployUrl.toString(),
  },
  shell: true,
  stdio: "inherit",
});
if (run.status !== 0) process.exit(run.status ?? 1);

const acceptance = spawnSync("npm.cmd run test:f0a:local", {
  cwd: root,
  env: {
    ...process.env,
    ...localEnv,
    LOCAL_DATABASE_URL: adminUrl,
    CONTENT_DEPLOY_DATABASE_URL: deployUrl.toString(),
  },
  shell: true,
  stdio: "inherit",
});
if (acceptance.status !== 0) process.exit(acceptance.status ?? 1);
