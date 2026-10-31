import { describe, expect, it, vi } from "vitest";
import { EntitlementsService } from "./entitlements.service.js";

const repository = () => ({
  active: vi.fn(),
  choose: vi.fn(),
  assertGameWritable: vi.fn(),
  policies: vi.fn(),
  setTier: vi.fn(),
  assign: vi.fn(),
  createStory: vi.fn(),
});

describe("entitlement boundary", () => {
  it("reports missing configuration without inventing a tier or limits", async () => {
    const repo = repository();
    repo.active.mockResolvedValue({ state: "configuration_pending" });
    expect(await new EntitlementsService(repo).active()).toEqual({
      state: "configuration_pending",
    });
  });
  it("validates selections before touching the database", async () => {
    const repo = repository();
    await expect(
      new EntitlementsService(repo).choose({
        story_ids: ["bad"],
        game_ids: [],
      }),
    ).rejects.toThrow();
    expect(repo.choose).not.toHaveBeenCalled();
  });
  it("returns a safe typed reason for a read-only game", async () => {
    const repo = repository();
    repo.assertGameWritable.mockRejectedValue(
      new Error("GAME_READ_ONLY_TIER_LIMIT"),
    );
    await expect(
      new EntitlementsService(repo).assertGameWritable(
        "00000000-0000-4000-8000-00000000a001",
      ),
    ).rejects.toMatchObject({
      error: {
        code: "FORBIDDEN",
        details: { entitlement_code: "GAME_READ_ONLY_TIER_LIMIT" },
      },
    });
  });
  it("hides raw database errors", async () => {
    const repo = repository();
    repo.active.mockRejectedValue(
      new Error("private postgres connection details"),
    );
    await expect(new EntitlementsService(repo).active()).rejects.toThrow(
      "Unable to load entitlement settings",
    );
  });
});
