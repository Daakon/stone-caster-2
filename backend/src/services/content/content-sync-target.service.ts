import { X509Certificate } from "node:crypto";
import type { ContentDeploymentConnection } from "../../../../shared/src/types/chimera-content-deploy.js";
import { ContentSyncError } from "./content-sync.service.js";

export class ContentSyncTargetService {
  resolve(
    args: string[],
    env: NodeJS.ProcessEnv,
  ): {
    connectionString: string;
    policy: ContentDeploymentConnection;
  } {
    const target = args[0]?.slice("--target=".length);
    if (
      args.length !== 1 ||
      !args[0]?.startsWith("--target=") ||
      !["local", "staging", "production"].includes(target ?? "")
    )
      throw new ContentSyncError(
        "Content sync requires exactly one --target=local|staging|production argument.",
        2,
      );
    const connectionString = env.CONTENT_DEPLOY_DATABASE_URL;
    if (!connectionString)
      throw new ContentSyncError(
        "CONTENT_DEPLOY_DATABASE_URL is required; no app or service-role credential is accepted.",
        2,
      );
    let url: URL;
    try {
      url = new URL(connectionString);
    } catch {
      throw new ContentSyncError(
        "The dedicated content deploy PostgreSQL URL is invalid.",
        2,
      );
    }
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      url.search ||
      url.hash ||
      !url.password
    )
      throw new ContentSyncError(
        "The dedicated deploy URL must use PostgreSQL with a password and without URL overrides.",
        2,
      );
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
      url.hostname.toLowerCase(),
    );
    if (target === "local") {
      if (
        !loopback ||
        url.port !== "54422" ||
        url.username !== "stonecaster_content_deployer" ||
        url.pathname !== "/postgres"
      )
        throw new ContentSyncError(
          "Local sync requires the dedicated deploy login on loopback port 54422 in database postgres.",
          2,
        );
      return { connectionString, policy: { target } };
    }
    if (
      env.GITHUB_ACTIONS !== "true" ||
      env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
      env.GITHUB_REF !== "refs/heads/main" ||
      !env.GITHUB_REPOSITORY ||
      env.GITHUB_WORKFLOW_REF !==
        `${env.GITHUB_REPOSITORY}/.github/workflows/deploy-content.yml@refs/heads/main`
    )
      throw new ContentSyncError(
        "Hosted sync requires the protected manual content deployment workflow on main.",
        2,
      );
    const host = env.CONTENT_DEPLOY_EXPECTED_HOST;
    const database = env.CONTENT_DEPLOY_EXPECTED_DATABASE;
    const app = env.CONTENT_DEPLOY_EXPECTED_APP;
    const ca = env.CONTENT_DEPLOY_TLS_CA;
    if (
      !host ||
      !database ||
      !app ||
      !ca ||
      !/^[a-z0-9][a-z0-9.-]+$/.test(host) ||
      !/^[a-z0-9_]+$/.test(database) ||
      !/^[a-z0-9][a-z0-9-]+$/.test(app)
    )
      throw new ContentSyncError(
        "Hosted deployment requires explicit protected environment host, database, Fly app, and TLS CA configuration.",
        2,
      );
    if (
      loopback ||
      url.hostname !== host ||
      url.port !== "5432" ||
      url.pathname !== `/${database}` ||
      !/^stonecaster_content_deployer(?:\.[a-z0-9]+)?$/.test(url.username)
    )
      throw new ContentSyncError(
        "Hosted deploy URL does not match the approved host, database, port 5432, and dedicated deploy login.",
        2,
      );
    try {
      new X509Certificate(ca);
    } catch {
      throw new ContentSyncError(
        "The protected deployment TLS CA must be a valid PEM certificate.",
        2,
      );
    }
    return {
      connectionString,
      policy: {
        target: target as "staging" | "production",
        expectedDatabase: database,
        expectedApp: app,
        tls: {
          ca,
          servername: host,
          rejectUnauthorized: true,
          minVersion: "TLSv1.2",
        },
      },
    };
  }
}
