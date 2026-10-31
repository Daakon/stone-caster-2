import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ContentCatalogRepository } from "./content-catalog.repo.js";
describe("request-scoped internal cache audience repository", () => {
  it("checks the authenticated admin RPC with a bounded deadline", async () => {
    const overrideTypes = vi
      .fn()
      .mockResolvedValue({ data: true, error: null });
    const abortSignal = vi.fn(() => ({ overrideTypes }));
    const rpc = vi.fn(() => ({ abortSignal }));
    expect(
      await new ContentCatalogRepository({
        rpc,
      } as unknown as SupabaseClient).cacheAudience(),
    ).toBe(true);
    expect(rpc).toHaveBeenCalledWith("is_admin");
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
  it("does not infer admin privileges from an authorization error", async () => {
    const rpc = vi.fn(() => ({
      abortSignal: () => ({
        overrideTypes: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "private detail" },
        }),
      }),
    }));
    await expect(
      new ContentCatalogRepository({
        rpc,
      } as unknown as SupabaseClient).cacheAudience(),
    ).rejects.toThrow("Unable to verify content cache audience");
  });
});
