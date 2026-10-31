import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LoreContentReadRepository } from "./lore-content-read.repo.js";
import {
  LoreReadQuerySchema,
  LoreContextQuerySchema,
} from "../../../../shared/src/types/chimera-lore-read.js";
const owner = "00000000-0000-4000-8000-000000000001";
const identity = {
  id: owner,
  content_key: "lore-key",
  owner_kind: "player",
  owner_namespace: owner,
  owner_user_id: owner,
  visibility: "private",
};
const row = { ...identity, created_at: "now", updated_at: "now" };
function fixture(data: unknown = [], error: unknown = null) {
  const result = vi
    .fn<[], Promise<{ data: unknown; error: unknown }>>()
    .mockResolvedValue({ data, error });
  const q = {
    select: vi.fn<[string], unknown>(),
    eq: vi.fn<[string, unknown], unknown>(),
    is: vi.fn<[string, null], unknown>(),
    limit: vi.fn<[number], unknown>(),
    in: vi.fn<[string, string[]], unknown>(),
    range: vi.fn<[number, number], unknown>(),
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
    q.select,
    q.eq,
    q.is,
    q.limit,
    q.in,
    q.range,
    q.order,
    q.abortSignal,
    q.maybeSingle,
    q.overrideTypes,
  ])
    fn.mockReturnValue(q);
  const from = vi.fn().mockReturnValue(q),
    rpc = vi.fn().mockReturnValue(q);
  return {
    q,
    result,
    from,
    rpc,
    client: { from, rpc } as unknown as SupabaseClient,
  };
}
describe("lore request-RLS projections and strict context filters", () => {
  it("verifies admin via the request RPC and fails closed", async () => {
    const f = fixture(true),
      repo = new LoreContentReadRepository(f.client, f.client);
    expect(await repo.isAdmin()).toBe(true);
    expect(f.rpc).toHaveBeenCalledWith("is_admin");
    f.result.mockResolvedValue({ data: null, error: true });
    await expect(repo.isAdmin()).rejects.toThrow("Lore audience unavailable");
  });
  it("resolves only fixed identity metadata and refuses ambiguous owner-scoped keys", async () => {
    const f = fixture([identity]),
      body = fixture(),
      repo = new LoreContentReadRepository(body.client, f.client);
    expect(await repo.resolve(owner)).toEqual(identity);
    expect(f.q.eq).toHaveBeenCalledWith("id", owner);
    await repo.resolve("lore-key");
    expect(f.q.eq).toHaveBeenCalledWith("content_key", "lore-key");
    expect(f.q.select.mock.calls.flat().join()).not.toMatch(
      /fragment|embedding|world_id/,
    );
    expect(body.from).not.toHaveBeenCalled();
    f.result.mockResolvedValue({ data: [identity, identity], error: null });
    expect(await repo.resolve("lore-key")).toBeNull();
    f.result.mockResolvedValue({ data: null, error: true });
    await expect(repo.resolve(owner)).rejects.toThrow(
      "Lore identity unavailable",
    );
  });
  it("uses canonical release/key filters and excludes specific contexts from world lore", async () => {
    const f = fixture([row]),
      repo = new LoreContentReadRepository(f.client, f.client),
      context = {
        kind: "world" as const,
        id: null,
        key: "mystika",
        namespace: "first_party",
      };
    await repo.list(
      "first_party",
      false,
      owner,
      LoreReadQuerySchema.parse({}),
      context,
    );
    expect(f.from).toHaveBeenCalledWith("chimera_content_source_items");
    expect(f.q.eq).toHaveBeenCalledWith("content_kind", "lore");
    expect(f.q.eq).toHaveBeenCalledWith("release_state", "published");
    expect(f.q.eq).toHaveBeenCalledWith("body->>world_key", "mystika");
    expect(f.q.is).toHaveBeenCalledWith("body->>entity_key", null);
    expect(f.q.is).toHaveBeenCalledWith("body->>story_key", null);
    f.q.eq.mockClear();
    await repo.list(
      "first_party",
      true,
      owner,
      LoreReadQuerySchema.parse({}),
      context,
    );
    expect(f.q.eq).not.toHaveBeenCalledWith("release_state", "published");
  });
  it("requires explicit player owner/public gates with strict entity/story/world scope", async () => {
    const f = fixture([row]),
      repo = new LoreContentReadRepository(f.client, f.client),
      p = LoreReadQuerySchema.parse({});
    for (const kind of ["entity", "story", "world"] as const) {
      await repo.list("public", false, owner, p, {
        kind,
        id: owner,
        key: "key",
        namespace: owner,
      });
      expect(f.q.eq).toHaveBeenCalledWith(`${kind}_id`, owner);
    }
    expect(f.q.eq).toHaveBeenCalledWith("visibility", "public");
    expect(f.q.is).toHaveBeenCalledWith("entity_id", null);
    expect(f.q.is).toHaveBeenCalledWith("story_id", null);
    await repo.list("owner", false, owner, p, null);
    expect(f.q.eq).toHaveBeenCalledWith("owner_user_id", owner);
    expect(f.q.select.mock.calls.flat().join()).not.toMatch(/\*|embedding/);
    expect(
      await repo.list("first_party", false, owner, p, {
        kind: "world",
        id: owner,
        key: "key",
        namespace: owner,
      }),
    ).toEqual([]);
    expect(
      await repo.list("public", false, owner, p, {
        kind: "world",
        id: null,
        key: "key",
        namespace: "first_party",
      }),
    ).toEqual([]);
  });
  it("bounds prefix windows and first-party alias metadata batches", async () => {
    const f = fixture(Array.from({ length: 200 }, () => row)),
      repo = new LoreContentReadRepository(f.client, f.client);
    await repo.list(
      "owner",
      false,
      owner,
      LoreReadQuerySchema.parse({ offset: 200 }),
      null,
    );
    expect(f.q.range.mock.calls).toEqual([
      [0, 199],
      [200, 249],
    ]);
    f.result.mockResolvedValue({ data: [], error: null });
    await repo.firstPartyAliases(
      Array.from({ length: 201 }, (_, i) => String(i)),
    );
    expect(f.q.in.mock.calls.map((c) => c[1].length)).toEqual([200, 1]);
    f.result.mockResolvedValue({ data: null, error: true });
    await expect(repo.firstPartyAliases(["key"])).rejects.toThrow(
      "Lore aliases unavailable",
    );
    await expect(
      repo.list("owner", false, owner, LoreReadQuerySchema.parse({}), null),
    ).rejects.toThrow("Lore list unavailable");
  });
  it("gates body lookup by namespace and own/public/release before returning data", async () => {
    const f = fixture(row),
      repo = new LoreContentReadRepository(f.client, f.client);
    expect(await repo.find(owner, "key", false, owner)).toEqual(row);
    expect(f.q.eq).toHaveBeenCalledWith("owner_user_id", owner);
    await repo.find("other", "key", false, owner);
    expect(f.q.eq).toHaveBeenCalledWith("visibility", "public");
    await repo.find("first_party", "key", false, owner);
    expect(f.q.eq).toHaveBeenCalledWith("release_state", "published");
    f.result.mockResolvedValue({ data: null, error: null });
    expect(await repo.find(owner, "missing", false, owner)).toBeNull();
    f.result.mockResolvedValue({ data: null, error: true });
    await expect(repo.find(owner, "key", false, owner)).rejects.toThrow(
      "Lore unavailable",
    );
  });
  it("reads RLS tag relations in bounded batches, omits hidden tags and fails closed", async () => {
    const f = fixture([
        { asset_id: owner, tag: { id: owner, tag_name: "AUTHORED" } },
        { asset_id: owner, tag: null },
      ]),
      repo = new LoreContentReadRepository(f.client, f.client);
    expect(await repo.tags([owner])).toEqual([
      { asset_id: owner, tag: { id: owner, tag_name: "AUTHORED" } },
    ]);
    expect(f.q.eq).toHaveBeenCalledWith("asset_type", "lore_entry");
    expect(f.q.in).toHaveBeenCalledWith("asset_id", [owner]);
    expect(await repo.tags([])).toEqual([]);
    f.result.mockResolvedValue({ data: null, error: true });
    await expect(repo.tags([owner])).rejects.toThrow("Lore tags unavailable");
  });
  it("requires context and bounds read inputs", () => {
    expect(LoreContextQuerySchema.safeParse({}).success).toBe(false);
    for (const q of [
      { world_id: "bad,id" },
      { story_id: "key" },
      { world_id: "world", limit: 51 },
      { entity_id: "entity", offset: 1001 },
    ])
      expect(LoreContextQuerySchema.safeParse(q).success).toBe(false);
    expect(
      LoreContextQuerySchema.parse({ entity_id: "entity", world_id: "world" }),
    ).toMatchObject({
      entity_id: "entity",
      world_id: "world",
      limit: 50,
      offset: 0,
    });
  });
});
