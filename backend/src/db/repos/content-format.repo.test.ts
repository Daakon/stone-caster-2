import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ContentFormatRepository } from "./content-format.repo.js";

describe("restricted format inventory repository", () => {
  it("uses only the fixed metadata RPC with an abort deadline", async () => {
    const overrideTypes = vi
      .fn()
      .mockResolvedValue({ data: { catalog_generation: "0" }, error: null });
    const abortSignal = vi.fn(() => ({ overrideTypes }));
    const rpc = vi.fn(() => ({ abortSignal }));
    const repo = new ContentFormatRepository({
      rpc,
    } as unknown as SupabaseClient);
    expect(await repo.inventory()).toEqual({ catalog_generation: "0" });
    expect(rpc).toHaveBeenCalledWith("chimera_content_format_inventory");
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
  it("does not expose database errors or fall back to source bodies", async () => {
    const rpc = vi.fn(() => ({
      abortSignal: () => ({
        overrideTypes: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "private database detail" },
        }),
      }),
    }));
    await expect(
      new ContentFormatRepository({
        rpc,
      } as unknown as SupabaseClient).inventory(),
    ).rejects.toThrow("Unable to read content format inventory");
    expect(rpc).toHaveBeenCalledOnce();
  });
});
