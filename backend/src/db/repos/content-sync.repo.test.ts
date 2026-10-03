import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ContentSyncRepository,
  ContentFleetGateError,
} from "./content-sync.repo.js";
const db = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
}));
vi.mock("pg", () => ({
  default: {
    Client: class {
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
