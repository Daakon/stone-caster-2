import { describe, it, expect, vi } from "vitest";
import { ContentSyncService } from "./content-sync.service.js";
import type { ValidatedContentBundle } from "./content-source.service.js";
const validated: ValidatedContentBundle = {
  manifest: {
    format_version: 1,
    namespace: "first_party",
    release_state: "internal",
    files: ["worlds.json"],
  },
  bundle: { items: [] },
  itemCount: 1,
  itemHashes: [],
  manifestHash: "b".repeat(64),
};
const receipt = {
  generation: 2,
  manifest_hash: validated.manifestHash,
  item_count: 1,
  deploy_id: "00000000-0000-4000-8000-000000000001",
  commit_sha: "a".repeat(40),
  format_version: 1 as const,
  changed_keys: [],
  old_new_hashes: [],
  outcome: "applied" as const,
};
function setup() {
  const source = { loadAndValidate: vi.fn().mockReturnValue(validated) },
    repo = { apply: vi.fn().mockResolvedValue(receipt) },
    provenance = {
      resolve: vi.fn().mockReturnValue({ commit_sha: receipt.commit_sha }),
      read: vi.fn().mockReturnValue("committed"),
    };
  return {
    source,
    repo,
    provenance,
    service: new ContentSyncService(source, repo, provenance),
  };
}
describe("provenance-aware standalone content sync", () => {
  it("validates the committed file reader and sends matching provenance", async () => {
    const { source, repo, provenance, service } = setup();
    source.loadAndValidate.mockImplementation(
      (reader?: (file: string) => string) => {
        expect(reader?.("worlds.json")).toBe("committed");
        return validated;
      },
    );
    expect(await service.sync("operator connection")).toEqual(receipt);
    expect(provenance.read).toHaveBeenCalledWith(
      { commit_sha: receipt.commit_sha },
      "worlds.json",
    );
    expect(repo.apply).toHaveBeenCalledWith(
      "operator connection",
      expect.any(String),
      validated.bundle,
      { commit_sha: receipt.commit_sha },
    );
  });
  it("keeps standalone validation usable for uncommitted content", () => {
    const { service, provenance } = setup();
    expect(service.validate()).toEqual(validated);
    expect(provenance.resolve).not.toHaveBeenCalled();
  });
  it("does not connect if the source or Git proof fails", async () => {
    const { source, repo, provenance, service } = setup();
    provenance.resolve.mockImplementationOnce(() => {
      throw new Error("dirty");
    });
    await expect(service.sync("operator")).rejects.toMatchObject({
      exitCode: 2,
      statusCode: 400,
    });
    source.loadAndValidate.mockImplementationOnce(() => {
      throw new Error("bad graph");
    });
    await expect(service.sync("operator")).rejects.toMatchObject({
      exitCode: 2,
    });
    expect(repo.apply).not.toHaveBeenCalled();
  });
  it.each([
    { ...receipt, commit_sha: "c".repeat(40) },
    { ...receipt, item_count: 2 },
    { ...receipt, manifest_hash: "c".repeat(64) },
  ])("rejects mismatched success receipts", async (output) => {
    const { service, repo } = setup();
    repo.apply.mockResolvedValueOnce(output);
    await expect(service.sync("operator")).rejects.toMatchObject({
      exitCode: 1,
    });
  });
  it("does not expose connection credentials from database errors", async () => {
    const { service, repo } = setup();
    repo.apply.mockRejectedValue(new Error("postgresql://operator:secret@db"));
    await expect(service.sync("operator")).rejects.toThrow(
      "no deployment success receipt",
    );
  });
});
