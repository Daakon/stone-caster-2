import { describe, it, expect, vi } from "vitest";
import { ContentDeployHistoryService } from "./content-deploy-history.service.js";
import { ContentDeployHistorySchema } from "../../../../shared/src/types/chimera-content-deploy.js";
const legacy = {
  id: "00000000-0000-4000-8000-000000000001",
  generation: "1",
  manifest_hash: "a".repeat(64),
  item_count: 1,
  actor: "stonecaster_content_deployer",
  deployed_at: "2026-10-01T00:00:00Z",
  provenance: "legacy" as const,
  commit_sha: null,
  format_version: null,
  changed_keys: null,
  old_new_hashes: null,
  outcome: null,
};
describe("admin deployment history contract", () => {
  it("preserves legacy unknowns and integer cursor precision", async () => {
    const view = {
      items: [
        legacy,
        {
          ...legacy,
          generation: "9007199254740993",
          provenance: "recorded",
          commit_sha: "b".repeat(40),
          format_version: 1,
          changed_keys: [],
          old_new_hashes: [],
          outcome: "applied",
        },
      ],
      next_before_generation: "9007199254740993",
    };
    const repo = { page: vi.fn().mockResolvedValue(view) };
    expect(
      await new ContentDeployHistoryService(repo).page({
        limit: "2",
        before_generation: "9007199254740994",
      }),
    ).toEqual(view);
    expect(repo.page).toHaveBeenCalledWith({
      limit: 2,
      before_generation: "9007199254740994",
    });
  });
  it.each([
    { limit: 0 },
    { limit: 101 },
    { limit: 1.5 },
    { before_generation: "0" },
    { before_generation: "9223372036854775808" },
    { before_generation: ["1"] },
    { unexpected: true },
  ])("refuses invalid paging %j", async (query) => {
    const repo = { page: vi.fn() };
    await expect(
      new ContentDeployHistoryService(repo).page(query),
    ).rejects.toThrow();
    expect(repo.page).not.toHaveBeenCalled();
  });
  it("returns a typed unavailable error for corrupt history or repository failure", async () => {
    const repo = {
      page: vi
        .fn()
        .mockResolvedValueOnce({
          items: [{ ...legacy, provenance: "recorded" }],
          next_before_generation: null,
        })
        .mockRejectedValueOnce(new Error("private")),
    };
    const service = new ContentDeployHistoryService(repo);
    await expect(service.page({})).rejects.toMatchObject({ statusCode: 503 });
    await expect(service.page({})).rejects.toThrow("history is unavailable");
    expect(
      ContentDeployHistorySchema.safeParse({
        items: [{ ...legacy, body: { secret: true } }],
        next_before_generation: null,
      }).success,
    ).toBe(false);
  });
});
