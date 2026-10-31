import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ContentSyncRepository,
  ContentFleetGateError,
  ContentDeployTargetError,
} from "./content-sync.repo.js";
const db = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
  construct: vi.fn((options: unknown) => options),
}));
vi.mock("pg", () => ({
  default: {
    Client: class {
      constructor(options: unknown) {
        db.construct(options);
      }
      connect = db.connect;
      query = db.query;
      end = db.end;
    },
  },
}));
const metadata = { commit_sha: "a".repeat(40) },
  id = "00000000-0000-4000-8000-000000000001";
const receipt = {
  generation: 2,
  manifest_hash: "b".repeat(64),
  item_count: 1,
  deploy_id: id,
  commit_sha: metadata.commit_sha,
  format_version: 1,
  changed_keys: [],
  old_new_hashes: [],
  outcome: "applied",
};
beforeEach(() => {
  vi.resetAllMocks();
  db.connect.mockResolvedValue(undefined);
  db.end.mockResolvedValue(undefined);
});
const identity = {
  catalog_generation: "1",
  deployment_provenance_version: 1,
  runtime_format_contract_version: 1,
  deployment_target_contract_version: 1,
  runtime_app_name: "stonecaster-staging",
  real_players_started: false,
  deploy_role: "stonecaster_content_deployer",
  database_name: "postgres",
};
const policy = {
  target: "staging" as const,
  expectedDatabase: "postgres",
  expectedApp: "stonecaster-staging",
  tls: {
    ca: "approved-ca",
    servername: "db.example.com",
    rejectUnauthorized: true as const,
    minVersion: "TLSv1.2" as const,
  },
};
describe("approved hosted database identity", () => {
  it("passes certificate-verified TLS and validates database identity before writing", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [identity] })
      .mockResolvedValueOnce({ rows: [{ content_sync_apply: receipt }] });
    expect(
      await new ContentSyncRepository().apply(
        "operator",
        id,
        { items: [] },
        metadata,
        policy,
      ),
    ).toEqual(receipt);
    expect(db.construct).toHaveBeenCalledWith(
      expect.objectContaining({
        ssl: policy.tls,
        connectionString: "operator",
      }),
    );
    expect(db.query).toHaveBeenCalledTimes(2);
  });
  it.each([
    { ...identity, deployment_target_contract_version: 0 },
    { ...identity, deploy_role: "postgres" },
    { ...identity, database_name: "other" },
    { ...identity, runtime_app_name: "stonecaster-production" },
    { ...identity, runtime_app_name: null },
    { ...identity, real_players_started: true },
    { ...identity, real_players_started: undefined },
  ])(
    "refuses wrong or missing identity and launched databases before mutation",
    async (row) => {
      db.query.mockResolvedValue({ rows: [row] });
      await expect(
        new ContentSyncRepository().apply(
          "operator",
          id,
          { items: [] },
          metadata,
          policy,
        ),
      ).rejects.toEqual(new ContentDeployTargetError());
      expect(db.query).toHaveBeenCalledOnce();
      expect(db.end).toHaveBeenCalledOnce();
    },
  );
  it("leaves isolated local connections without TLS and requires their deploy session role", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [identity] })
      .mockResolvedValueOnce({ rows: [{ content_sync_apply: receipt }] });
    await new ContentSyncRepository().apply(
      "local",
      id,
      { items: [] },
      metadata,
      { target: "local" },
    );
    expect(db.construct.mock.calls[0]?.[0]).not.toHaveProperty("ssl");
  });
});
describe("dedicated deploy repository", () => {
  it("requires provenance support before applying and decodes the receipt", async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            catalog_generation: "1",
            deployment_provenance_version: 1,
            runtime_format_contract_version: 1,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ content_sync_apply: receipt }] });
    expect(
      await new ContentSyncRepository().apply(
        "operator",
        id,
        { items: [] },
        metadata,
      ),
    ).toEqual(receipt);
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      "select content_deploy.content_sync_apply($1::bigint, $2::uuid, $3::jsonb) as content_sync_apply",
      [1, id, JSON.stringify({ items: [], deployment: metadata })],
    );
    expect(db.end).toHaveBeenCalledOnce();
  });
  it.each([
    { rows: [] },
    { rows: [{ catalog_generation: "1" }] },
    { rows: [{ catalog_generation: "1", deployment_provenance_version: 1 }] },
    {
      rows: [
        {
          catalog_generation: "9007199254740993",
          deployment_provenance_version: 1,
          runtime_format_contract_version: 1,
        },
      ],
    },
  ])(
    "refuses unsupported validation metadata before a write",
    async (response) => {
      db.query.mockResolvedValue(response);
      await expect(
        new ContentSyncRepository().apply(
          "operator",
          id,
          { items: [] },
          metadata,
        ),
      ).rejects.toThrow();
      expect(db.query).toHaveBeenCalledOnce();
      expect(db.end).toHaveBeenCalledOnce();
    },
  );
  it("closes on connection and RPC failure, retaining the original failure", async () => {
    db.connect.mockRejectedValueOnce(new Error("offline"));
    await expect(
      new ContentSyncRepository().apply(
        "operator",
        id,
        { items: [] },
        metadata,
      ),
    ).rejects.toThrow("offline");
    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            catalog_generation: "1",
            deployment_provenance_version: 1,
            runtime_format_contract_version: 1,
          },
        ],
      })
      .mockRejectedValueOnce(new Error("RPC failed"));
    await expect(
      new ContentSyncRepository().apply(
        "operator",
        id,
        { items: [] },
        metadata,
      ),
    ).rejects.toThrow("RPC failed");
    expect(db.end).toHaveBeenCalledTimes(2);
  });
  it("rejects an empty or corrupt RPC receipt", async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            catalog_generation: "1",
            deployment_provenance_version: 1,
            runtime_format_contract_version: 1,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    await expect(
      new ContentSyncRepository().apply(
        "operator",
        id,
        { items: [] },
        metadata,
      ),
    ).rejects.toThrow();
  });
  it.each([
    ["P0F01", "unreported"],
    ["P0F02", "unsupported"],
  ] as const)(
    "maps the transactional fleet denial %s without exposing database details",
    async (code, reason) => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            {
              catalog_generation: "1",
              deployment_provenance_version: 1,
              runtime_format_contract_version: 1,
            },
          ],
        })
        .mockRejectedValueOnce(
          Object.assign(new Error("private database detail"), { code }),
        );
      await expect(
        new ContentSyncRepository().apply(
          "operator",
          id,
          { items: [] },
          metadata,
        ),
      ).rejects.toEqual(new ContentFleetGateError(reason));
      expect(db.end).toHaveBeenCalledOnce();
    },
  );
});
