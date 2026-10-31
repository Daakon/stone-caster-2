import { rootCertificates } from "node:tls";
import { describe, expect, it } from "vitest";
import { ContentSyncTargetService } from "./content-sync-target.service.js";

const service = new ContentSyncTargetService();
const local = {
  CONTENT_DEPLOY_DATABASE_URL:
    "postgresql://stonecaster_content_deployer:secret@127.0.0.1:54422/postgres",
};
const hosted = {
  GITHUB_ACTIONS: "true",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REF: "refs/heads/main",
  GITHUB_REPOSITORY: "Daakon/stone-caster-2",
  GITHUB_WORKFLOW_REF:
    "Daakon/stone-caster-2/.github/workflows/deploy-content.yml@refs/heads/main",
  CONTENT_DEPLOY_DATABASE_URL:
    "postgresql://stonecaster_content_deployer.projectref:secret@pooler.example.com:5432/postgres",
  CONTENT_DEPLOY_EXPECTED_HOST: "pooler.example.com",
  CONTENT_DEPLOY_EXPECTED_DATABASE: "postgres",
  CONTENT_DEPLOY_EXPECTED_APP: "stonecaster-staging",
  CONTENT_DEPLOY_TLS_CA: rootCertificates[0],
};
describe("explicit content deployment targets", () => {
  it("retains the isolated dedicated local target", () => {
    expect(service.resolve(["--target=local"], local)).toEqual({
      connectionString: local.CONTENT_DEPLOY_DATABASE_URL,
      policy: { target: "local" },
    });
  });
  it.each(
    [
      [],
      ["--target=other"],
      ["--target=local", "--target=local"],
      ["local"],
      ["--target=local", "--force"],
    ].map((args) => ({ args })),
  )("rejects ambiguous or unsupported arguments %j", ({ args }) => {
    expect(() => service.resolve(args, local)).toThrow("exactly one");
  });
  it.each([
    "postgresql://postgres:secret@127.0.0.1:54422/postgres",
    "postgresql://stonecaster_content_deployer:secret@remote.example.com:54422/postgres",
    "postgresql://stonecaster_content_deployer:secret@127.0.0.1:5432/postgres",
    "postgresql://stonecaster_content_deployer:secret@127.0.0.1:54422/other",
    "postgresql://stonecaster_content_deployer:secret@127.0.0.1:54422/postgres?sslmode=disable",
    "postgresql://stonecaster_content_deployer:secret@127.0.0.1:54422/postgres#override",
    "https://stonecaster_content_deployer:secret@127.0.0.1:54422/postgres",
    "postgresql://stonecaster_content_deployer@127.0.0.1:54422/postgres",
    "not-a-url",
  ])(
    "refuses unsafe local connections without echoing credentials",
    (connectionString) => {
      try {
        service.resolve(["--target=local"], {
          CONTENT_DEPLOY_DATABASE_URL: connectionString,
        });
        throw new Error("accepted unsafe connection");
      } catch (error) {
        expect(error).toMatchObject({ exitCode: 2 });
        expect(String(error)).not.toContain("secret");
      }
    },
  );
  it("requires its own credential without app credential fallback", () => {
    expect(() =>
      service.resolve(["--target=local"], {
        DATABASE_URL: local.CONTENT_DEPLOY_DATABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: "secret",
      }),
    ).toThrow("CONTENT_DEPLOY_DATABASE_URL is required");
  });
  it.each(["staging", "production"])(
    "resolves %s with CA and server identity verification",
    (target) => {
      expect(service.resolve([`--target=${target}`], hosted).policy).toEqual({
        target,
        expectedDatabase: "postgres",
        expectedApp: "stonecaster-staging",
        tls: {
          ca: hosted.CONTENT_DEPLOY_TLS_CA,
          servername: "pooler.example.com",
          rejectUnauthorized: true,
          minVersion: "TLSv1.2",
        },
      });
    },
  );
  it.each([
    "GITHUB_ACTIONS",
    "GITHUB_EVENT_NAME",
    "GITHUB_REF",
    "GITHUB_WORKFLOW_REF",
    "CONTENT_DEPLOY_EXPECTED_HOST",
    "CONTENT_DEPLOY_EXPECTED_DATABASE",
    "CONTENT_DEPLOY_EXPECTED_APP",
    "CONTENT_DEPLOY_TLS_CA",
  ])("rejects missing required hosted configuration %s", (key) => {
    expect(() =>
      service.resolve(["--target=staging"], { ...hosted, [key]: undefined }),
    ).toThrow();
  });
  it.each([
    { CONTENT_DEPLOY_TLS_CA: "not-a-certificate" },
    { CONTENT_DEPLOY_EXPECTED_HOST: "UPPER.example.com" },
    { CONTENT_DEPLOY_EXPECTED_APP: "bad app" },
    { CONTENT_DEPLOY_EXPECTED_DATABASE: "bad/db" },
    {
      CONTENT_DEPLOY_DATABASE_URL: hosted.CONTENT_DEPLOY_DATABASE_URL.replace(
        "pooler.example.com",
        "other.example.com",
      ),
    },
    {
      CONTENT_DEPLOY_DATABASE_URL: hosted.CONTENT_DEPLOY_DATABASE_URL.replace(
        "5432",
        "6543",
      ),
    },
    {
      CONTENT_DEPLOY_DATABASE_URL: hosted.CONTENT_DEPLOY_DATABASE_URL.replace(
        "/postgres",
        "/other",
      ),
    },
    {
      CONTENT_DEPLOY_DATABASE_URL: hosted.CONTENT_DEPLOY_DATABASE_URL.replace(
        "stonecaster_content_deployer.projectref",
        "postgres.projectref",
      ),
    },
    {
      CONTENT_DEPLOY_EXPECTED_HOST: "localhost",
      CONTENT_DEPLOY_DATABASE_URL: hosted.CONTENT_DEPLOY_DATABASE_URL.replace(
        "pooler.example.com",
        "localhost",
      ),
    },
  ])(
    "rejects hosted overrides before a database connection %j",
    (overrides) => {
      expect(() =>
        service.resolve(["--target=production"], { ...hosted, ...overrides }),
      ).toThrow();
    },
  );
});
