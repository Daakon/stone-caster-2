import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ContentChangesRepository } from "./content-changes.repo.js";
describe("bounded metadata-only content change repository", () => {
  it("uses the fixed batched RPC with a deadline, without reading source bodies", async () => {
    const overrideTypes = vi
      .fn()
      .mockResolvedValue({ data: { shared: {} }, error: null });
    const abortSignal = vi.fn(() => ({ overrideTypes }));
    const rpc = vi.fn(() => ({ abortSignal }));
    const repo = new ContentChangesRepository({
      rpc,
    } as unknown as SupabaseClient);
    const owners = [
      {
        user_id: "00000000-0000-4000-8000-000000000001",
        after_seq: "9007199254740993",
      },
    ];
    expect(await repo.page("9007199254740992", owners)).toEqual({ shared: {} });
    expect(rpc).toHaveBeenCalledWith("chimera_content_change_page", {
      p_after_seq: "9007199254740992",
      p_owners: owners,
      p_limit: 100,
    });
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
  it("does not expose database details or fall back to bodies", async () => {
    const rpc = vi.fn(() => ({
      abortSignal: () => ({
        overrideTypes: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "private database detail" },
        }),
      }),
    }));
    await expect(
      new ContentChangesRepository({ rpc } as unknown as SupabaseClient).page(
        null,
        [],
      ),
    ).rejects.toThrow("Unable to read content changes");
    expect(rpc).toHaveBeenCalledOnce();
  });
});
