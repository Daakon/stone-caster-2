import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TagContentReadRepository } from "./tag-content-read.repo.js";
import { TagReadQuerySchema } from "../../../../shared/src/types/chimera-tag-read.js";

function fixture(data: unknown = [], error: unknown = null) {
  const overrideTypes = vi.fn().mockResolvedValue({ data, error });
  const abortSignal = vi.fn().mockReturnValue({ overrideTypes });
  const rpc = vi.fn().mockReturnValue({ abortSignal });
  return {
    repo: new TagContentReadRepository({ rpc } as unknown as SupabaseClient),
    rpc,
    abortSignal,
  };
}
describe("tag selector request-RLS repository", () => {
  it("passes only bounded pagination, never caller-supplied ownership or admin claims", async () => {
    const f = fixture([
      { id: "canonical-key", tag_name: "AUTHORED", is_approved: true },
    ]);
    expect(
      await f.repo.list(
        TagReadQuerySchema.parse({
          limit: "2",
          offset: "1",
          owner_user_id: "foreign",
          admin: true,
        }),
      ),
    ).toEqual([
      { id: "canonical-key", tag_name: "AUTHORED", is_approved: true },
    ]);
    expect(f.rpc).toHaveBeenCalledWith("chimera_approved_tag_page", {
      p_limit: 2,
      p_offset: 1,
    });
    expect(f.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
  it("preserves empty pages and default bounds", async () => {
    const f = fixture();
    expect(await f.repo.list(TagReadQuerySchema.parse({}))).toEqual([]);
    expect(f.rpc).toHaveBeenCalledWith("chimera_approved_tag_page", {
      p_limit: 50,
      p_offset: 0,
    });
  });
  it.each([
    null,
    [{}],
    [{ id: "key", tag_name: "NAME", is_approved: false }],
    [{ id: "key", tag_name: "", is_approved: true }],
  ])("rejects malformed/unapproved data %s", async (data) => {
    await expect(
      fixture(data).repo.list(TagReadQuerySchema.parse({})),
    ).rejects.toThrow();
  });
  it("rejects an oversized result instead of bypassing the request bound", async () => {
    const tag = { id: "key", tag_name: "NAME", is_approved: true };
    await expect(
      fixture([tag, tag]).repo.list(TagReadQuerySchema.parse({ limit: 1 })),
    ).rejects.toThrow();
  });
  it("masks database diagnostics", async () => {
    await expect(
      fixture(null, { message: "private database detail" }).repo.list(
        TagReadQuerySchema.parse({}),
      ),
    ).rejects.toThrow("Tag selector unavailable");
  });
  it.each([
    { limit: 0 },
    { limit: 51 },
    { limit: 1.5 },
    { offset: -1 },
    { offset: 1001 },
    { offset: "bad" },
    { limit: ["1", "2"] },
  ])("rejects invalid pagination %s", (query) => {
    expect(TagReadQuerySchema.safeParse(query).success).toBe(false);
  });
});
