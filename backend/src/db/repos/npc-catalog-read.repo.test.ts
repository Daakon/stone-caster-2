import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NpcCatalogReadRepository } from "./npc-catalog-read.repo.js";
import { NpcCatalogQuerySchema } from "../../../../shared/src/types/chimera-npc-catalog-read.js";

function fixture(
  data: unknown = { items: [], total: 0 },
  error: unknown = null,
) {
  const result = { data, error };
  const overrideTypes = vi.fn().mockResolvedValue(result);
  const abortSignal = vi.fn().mockReturnValue({ overrideTypes });
  const rpc = vi.fn().mockReturnValue({ abortSignal });
  return {
    repo: new NpcCatalogReadRepository({ rpc } as unknown as SupabaseClient),
    rpc,
    abortSignal,
  };
}
describe("public NPC bounded database reader", () => {
  it("passes literal search, resolved world, activity and bounded page to caller-RLS RPC", async () => {
    const f = fixture();
    const query = NpcCatalogQuerySchema.parse({
      q: '%,_"\\',
      search: "ignored",
      world: "mystika",
      activeOnly: "true",
      limit: 3,
      offset: 2,
    });
    expect(await f.repo.list(query, "mystika")).toEqual({
      items: [],
      total: 0,
    });
    expect(f.rpc).toHaveBeenCalledWith("chimera_public_npc_page", {
      p_search: '%,_"\\',
      p_world: "mystika",
      p_world_key: "mystika",
      p_active_only: true,
      p_limit: 3,
      p_offset: 2,
    });
    expect(f.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
  it("accepts an empty page with a nonzero filtered total and the search alias", async () => {
    const f = fixture({ items: [], total: 15 });
    expect(
      (
        await f.repo.list(
          NpcCatalogQuerySchema.parse({ search: "guard", offset: 20 }),
          null,
        )
      ).total,
    ).toBe(15);
    expect(f.rpc).toHaveBeenCalledWith(
      "chimera_public_npc_page",
      expect.objectContaining({
        p_search: "guard",
        p_active_only: false,
        p_world: null,
      }),
    );
  });
  it.each([{ items: [], total: -1 }, { items: [{}], total: 1 }, null])(
    "rejects malformed database pages %s",
    async (data) => {
      await expect(
        fixture(data).repo.list(NpcCatalogQuerySchema.parse({}), null),
      ).rejects.toThrow();
    },
  );
  it("fails closed on database errors", async () => {
    await expect(
      fixture(null, true).repo.list(NpcCatalogQuerySchema.parse({}), null),
    ).rejects.toThrow("NPC catalog unavailable");
  });
  it.each([
    { limit: 0 },
    { limit: 101 },
    { offset: -1 },
    { offset: 1001 },
    { limit: 1.1 },
    { world: "a,b" },
    { q: "x".repeat(101) },
    { activeOnly: "yes" },
  ])("rejects unsafe inputs %s", (value) => {
    expect(NpcCatalogQuerySchema.safeParse(value).success).toBe(false);
  });
});
