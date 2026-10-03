import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ContentDeployHistoryRepository } from "./content-deploy-history.repo.js";
describe("JWT-scoped history repository", () => {
  it("forwards an integer-string cursor without numeric coercion", async () => {
    const overrideTypes = vi.fn().mockResolvedValue({
      data: { items: [], next_before_generation: null },
      error: null,
    });
    const rpc = vi.fn(() => ({ overrideTypes }));
    const repo = new ContentDeployHistoryRepository({
      rpc,
    } as unknown as SupabaseClient);
    expect(
      await repo.page({ limit: 10, before_generation: "9007199254740993" }),
    ).toEqual({ items: [], next_before_generation: null });
    expect(rpc).toHaveBeenCalledWith("chimera_admin_content_deploy_log", {
      p_limit: 10,
      p_before_generation: "9007199254740993",
    });
  });
  it("sends null for the first page and sanitizes DB errors", async () => {
    const rpc = vi.fn(() => ({
      overrideTypes: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "private" } }),
    }));
    await expect(
      new ContentDeployHistoryRepository({
        rpc,
      } as unknown as SupabaseClient).page({ limit: 25 }),
    ).rejects.toThrow("Unable to read");
    expect(rpc).toHaveBeenCalledWith("chimera_admin_content_deploy_log", {
      p_limit: 25,
      p_before_generation: null,
    });
  });
});
