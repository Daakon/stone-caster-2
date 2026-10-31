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
  it("registers the actual machine version with this build's compiled range in one bounded probe", async () => {
    const overrideTypes = vi
      .fn()
      .mockResolvedValue({ data: { catalog_generation: "0" }, error: null });
    const abortSignal = vi.fn(() => ({ overrideTypes }));
    const rpc = vi.fn(() => ({ abortSignal }));
    const runtime = {
      app_name: "stonecaster",
      machine_id: "abcdef01",
      machine_version: "VERSION1",
      image_ref: "registry.fly.io/stonecaster:deployment-one",
    };
    await new ContentFormatRepository({
      rpc,
    } as unknown as SupabaseClient).inventory(runtime);
    expect(rpc).toHaveBeenCalledWith("chimera_register_content_runtime", {
      p_app_name: runtime.app_name,
      p_machine_id: runtime.machine_id,
      p_machine_version: runtime.machine_version,
      p_image_ref: runtime.image_ref,
      p_format_min: 1,
      p_format_max: 1,
    });
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(rpc).toHaveBeenCalledOnce();
  });
});
