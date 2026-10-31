import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiGet, apiPut, apiPatch, apiPost } from "@/lib/api";
import { entitlementsClient } from "./chimera.entitlements";
vi.mock("@/lib/api", () => ({
  apiGet: vi.fn(),
  apiPut: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
});
describe("entitlement API boundary", () => {
  it("preserves pending state without inventing any limits", async () => {
    vi.mocked(apiGet).mockResolvedValue({
      ok: true,
      data: { state: "configuration_pending" },
    });
    expect(await entitlementsClient.active()).toEqual({
      state: "configuration_pending",
    });
  });
  it("rejects malformed successful responses and surfaces safe API errors", async () => {
    vi.mocked(apiGet)
      .mockResolvedValueOnce({ ok: true, data: { state: "ready" } })
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "http_error", http: 503, message: "Unavailable" },
      });
    await expect(entitlementsClient.active()).rejects.toThrow(
      "could not be read",
    );
    await expect(entitlementsClient.active()).rejects.toThrow("Unavailable");
  });
  it("writes complete ordered choices and validates before network", async () => {
    const choice = {
      story_ids: ["a0000000-0000-4000-8000-000000000001"],
      game_ids: [],
    };
    vi.mocked(apiPut).mockResolvedValue({
      ok: true,
      data: { state: "configuration_pending" },
    });
    await entitlementsClient.choose(choice);
    expect(apiPut).toHaveBeenCalledWith("/api/me/entitlements/active", choice);
    await expect(
      entitlementsClient.choose({ story_ids: ["invalid"], game_ids: [] }),
    ).rejects.toThrow();
    expect(apiPut).toHaveBeenCalledTimes(1);
  });
  it("reads policies, writes explicit zero caps, and assigns a validated account", async () => {
    const view = { tiers: [], default_tier_key: null };
    vi.mocked(apiGet).mockResolvedValue({ ok: true, data: view });
    expect(await entitlementsClient.policies()).toEqual(view);
    vi.mocked(apiPatch).mockResolvedValue({ ok: true, data: view });
    const policy = {
      tier_key: "fixture",
      max_owned_stories: 0,
      max_saved_games: 0,
      make_default: false,
    };
    await entitlementsClient.setTier(policy);
    expect(apiPatch).toHaveBeenCalledWith("/api/admin/tier-limits", policy);
    vi.mocked(apiPost).mockResolvedValue({
      ok: true,
      data: { assigned: true },
    });
    const id = "a0000000-0000-4000-8000-000000000001";
    await entitlementsClient.assign(id, "fixture");
    expect(apiPost).toHaveBeenCalledWith(`/api/admin/users/${id}/tier`, {
      tier_key: "fixture",
    });
    await expect(
      entitlementsClient.assign("invalid", "fixture"),
    ).rejects.toThrow();
    expect(apiPost).toHaveBeenCalledTimes(1);
  });
});
