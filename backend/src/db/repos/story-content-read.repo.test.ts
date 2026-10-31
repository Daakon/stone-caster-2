import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { StoryContentReadRepository } from "./story-content-read.repo.js";
import {
  StoryReadIdSchema,
  StoryReadQuerySchema,
} from "../../../../shared/src/types/chimera-story-read.js";
import { storyFixture } from "../../__tests__/fixtures/story-read.js";
const owner = "00000000-0000-4000-8000-000000000001";
const identity = {
  id: owner,
  key: "sample",
  slug: "sample",
  content_key: "sample",
  owner_kind: "player",
  owner_namespace: owner,
  owner_user_id: owner,
  visibility: "private",
};
const row = storyFixture();
function fixture(data: unknown = [], error: unknown = null) {
  const result = vi
    .fn<[], Promise<{ data: unknown; error: unknown }>>()
    .mockResolvedValue({ data, error });
  const query = {
    select: vi.fn<[string], unknown>(),
    eq: vi.fn<[string, unknown], unknown>(),
    or: vi.fn<[string], unknown>(),
    limit: vi.fn<[number], unknown>(),
    in: vi.fn<[string, string[]], unknown>(),
    range: vi.fn<[number, number], unknown>(),
    not: vi.fn<[string, string, unknown], unknown>(),
    contains: vi.fn<[string, string | string[]], unknown>(),
    ilike: vi.fn<[string, string], unknown>(),
    order: vi.fn<[string, { ascending: boolean }?], unknown>(),
    abortSignal: vi.fn<[AbortSignal], unknown>(),
    maybeSingle: vi.fn<[], unknown>(),
    overrideTypes: vi.fn<[], unknown>(),
    then: (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => result().then(resolve, reject),
  };
  for (const fn of [
    query.select,
    query.eq,
    query.or,
    query.limit,
    query.in,
    query.range,
    query.not,
    query.contains,
    query.ilike,
    query.order,
    query.abortSignal,
    query.maybeSingle,
    query.overrideTypes,
  ])
    fn.mockReturnValue(query);
  const client = {
    from: vi.fn().mockReturnValue(query),
    rpc: vi.fn().mockReturnValue(query),
  };
  return {
    query,
    result,
    client: client as unknown as SupabaseClient,
    from: client.from,
    rpc: client.rpc,
  };
}

describe("story repository RLS, identity and bounded search", () => {
  it("reads fixed identity metadata without bodies", async () => {
    const bodies = fixture(),
      metadata = fixture({ ...identity, visibility: "private" }),
      repo = new StoryContentReadRepository(bodies.client, metadata.client);
    expect(await repo.resolve(owner)).toMatchObject({ owner_user_id: owner });
    expect(metadata.query.eq).toHaveBeenCalledWith("id", owner);
    expect(metadata.query.select.mock.calls.flat().join()).not.toMatch(
      /definition|configuration|world/,
    );
    expect(bodies.from).not.toHaveBeenCalled();
    metadata.result.mockResolvedValue({ data: null, error: null });
    expect(await repo.resolve(owner)).toBeNull();
    metadata.result.mockResolvedValue({ data: null, error: true });
    await expect(repo.resolve(owner)).rejects.toThrow(
      "Story identity unavailable",
    );
  });
  it("uses explicit owner/public and compile gates with safe literal search and bounded pages", async () => {
    const f = fixture([row]),
      repo = new StoryContentReadRepository(f.client, f.client);
    const search = 'quote",visibility.eq.private,(title.ilike.*)';
    expect(
      await repo.list(
        null,
        StoryReadQuerySchema.parse({ search, offset: 7, limit: 2 }),
      ),
    ).toEqual([row]);
    expect(f.query.eq).toHaveBeenCalledWith("owner_kind", "player");
    expect(f.query.eq).toHaveBeenCalledWith("visibility", "public");
    expect(f.query.in).toHaveBeenCalledWith("status", ["compiled", "bound"]);
    expect(f.query.not).toHaveBeenCalledWith("current_compiled_id", "is", null);
    expect(f.query.or.mock.calls[0]?.[0]).toContain(
      'quote\\",visibility.eq.private',
    );
    expect(f.query.range).toHaveBeenCalledWith(7, 8);
    expect(f.query.order).toHaveBeenCalledWith("id");
    expect(f.query.select.mock.calls.flat().join()).not.toMatch(/\*|world:/);
    f.query.eq.mockClear();
    f.query.in.mockClear();
    await repo.list(owner, StoryReadQuerySchema.parse({ search: "100%_\\" }));
    expect(f.query.eq).toHaveBeenCalledWith("owner_user_id", owner);
    expect(f.query.eq).not.toHaveBeenCalledWith("visibility", "public");
    expect(f.query.in).not.toHaveBeenCalled();
    f.result.mockResolvedValue({ data: null, error: true });
    await expect(
      repo.list(owner, StoryReadQuerySchema.parse({})),
    ).rejects.toThrow("Story list unavailable");
  });
  it("loads exact source keys in authorized namespaces and returns null for missing bodies", async () => {
    const f = fixture(row),
      repo = new StoryContentReadRepository(f.client, f.client);
    expect(await repo.find(owner, "story-key", owner)).toEqual(row);
    expect(f.query.eq).toHaveBeenCalledWith("owner_user_id", owner);
    await repo.find(owner, "story-key", null);
    expect(f.query.eq).toHaveBeenCalledWith("visibility", "public");
    expect(f.query.eq).toHaveBeenCalledWith("owner_namespace", owner);
    expect(f.query.eq).toHaveBeenCalledWith("content_key", "story-key");
    f.result.mockResolvedValue({ data: null, error: null });
    expect(await repo.find(owner, "missing", owner)).toBeNull();
    f.result.mockResolvedValue({ data: null, error: true });
    await expect(repo.find(owner, "story-key", owner)).rejects.toThrow(
      "Story unavailable",
    );
  });
  it("refuses non-UUID IDs, unsafe/broad requests, and malformed database payloads", async () => {
    expect(StoryReadIdSchema.safeParse("canonical-story").success).toBe(false);
    expect(StoryReadIdSchema.safeParse(owner).success).toBe(true);
    expect(StoryReadQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(StoryReadQuerySchema.safeParse({ offset: 1001 }).success).toBe(
      false,
    );
    expect(
      StoryReadQuerySchema.safeParse({ search: "x".repeat(101) }).success,
    ).toBe(false);
    const f = fixture({ id: owner }),
      repo = new StoryContentReadRepository(f.client, f.client);
    await expect(repo.find(owner, "story-key", owner)).rejects.toThrow();
  });
});
