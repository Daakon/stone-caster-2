import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EntityContentReadRepository } from "./entity-content-read.repo.js";
import {
  EntityReadIdSchema,
  EntityReadQuerySchema,
} from "../../../../shared/src/types/chimera-entity-read.js";
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
const row = { ...identity, created_at: "now", updated_at: "now" };
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

describe("entity read RLS projections and bounded filters", () => {
  it("verifies admin with the request client and fails closed", async () => {
    const f = fixture(true),
      repo = new EntityContentReadRepository(f.client, f.client);
    expect(await repo.isAdmin()).toBe(true);
    expect(f.rpc).toHaveBeenCalledWith("is_admin");
    f.result.mockResolvedValue({ data: null, error: true });
    await expect(repo.isAdmin()).rejects.toThrow("Entity audience unavailable");
  });
  it("resolves fixed identity metadata and refuses ambiguous aliases", async () => {
    const bodies = fixture(),
      f = fixture([identity]);
    const repo = new EntityContentReadRepository(bodies.client, f.client);
    expect(await repo.resolve(owner)).toEqual(identity);
    expect(f.query.eq).toHaveBeenCalledWith("id", owner);
    expect(await repo.resolve("sample")).toEqual(identity);
    expect(f.query.or).toHaveBeenCalledWith("key.eq.sample,slug.eq.sample");
    expect(f.query.select.mock.calls.flat().join()).not.toMatch(
      /raw_data|body/,
    );
    expect(bodies.from).not.toHaveBeenCalled();
    f.result.mockResolvedValue({ data: [identity, identity], error: null });
    expect(await repo.resolve("sample")).toBeNull();
    f.result.mockResolvedValue({ data: null, error: true });
    await expect(repo.resolve("sample")).rejects.toThrow(
      "Entity identity unavailable",
    );
  });
  it("maps world UUID aliases only for first-party filters", async () => {
    const f = fixture([identity]),
      repo = new EntityContentReadRepository(f.client, f.client);
    expect(await repo.worldKey(owner)).toBeNull();
    f.result.mockResolvedValue({
      data: [{ ...identity, owner_kind: "first_party" }],
      error: null,
    });
    expect(await repo.worldKey(owner)).toBe("sample");
    expect(f.from).toHaveBeenCalledWith("chimera_worlds");
    f.result.mockResolvedValue({ data: [], error: null });
    expect(await repo.worldKey("canonical-world")).toBe("canonical-world");
    expect(await repo.worldKey(owner)).toBeNull();
  });
  it("reads canonical bodies with release/world gates and player bodies with explicit owner/public gates", async () => {
    const f = fixture([row]),
      repo = new EntityContentReadRepository(f.client, f.client);
    const params = EntityReadQuerySchema.parse({ world_id: owner });
    await repo.list("first_party", false, owner, params, "world", "updated_at");
    expect(f.from).toHaveBeenCalledWith("chimera_content_source_items");
    expect(f.query.eq).toHaveBeenCalledWith("release_state", "published");
    expect(f.query.eq).toHaveBeenCalledWith("body->>world_key", "world");
    f.query.eq.mockClear();
    await repo.list("first_party", true, owner, params, "world", "updated_at");
    expect(f.query.eq).not.toHaveBeenCalledWith("release_state", "published");
    await repo.list("owner", false, owner, params, null, "created_at");
    expect(f.query.eq).toHaveBeenCalledWith("owner_user_id", owner);
    expect(f.query.eq).toHaveBeenCalledWith("world_id", owner);
    expect(f.query.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    await repo.list("public", false, owner, params, null, "updated_at");
    expect(f.query.eq).toHaveBeenCalledWith("visibility", "public");
    expect(f.query.eq).toHaveBeenCalledWith("owner_kind", "player");
    expect(f.query.select.mock.calls.flat().join()).not.toMatch(/\*|,kind,/);
    expect(
      await repo.list("first_party", false, owner, params, null, "updated_at"),
    ).toEqual([]);
    expect(
      await repo.list(
        "public",
        false,
        owner,
        EntityReadQuerySchema.parse({ world_id: "world" }),
        "world",
        "updated_at",
      ),
    ).toEqual([]);
    f.result.mockResolvedValue({ data: null, error: true });
    await expect(
      repo.list(
        "owner",
        false,
        owner,
        EntityReadQuerySchema.parse({}),
        null,
        "updated_at",
      ),
    ).rejects.toThrow("Entity list unavailable");
  });
  it("chunks deep pages and alias batches", async () => {
    const f = fixture(),
      repo = new EntityContentReadRepository(f.client, f.client);
    f.result
      .mockResolvedValueOnce({
        data: Array.from({ length: 200 }, () => row),
        error: null,
      })
      .mockResolvedValueOnce({ data: [row], error: null });
    expect(
      (
        await repo.list(
          "public",
          false,
          owner,
          EntityReadQuerySchema.parse({ offset: 250 }),
          null,
          "updated_at",
        )
      ).length,
    ).toBe(201);
    expect(f.query.range.mock.calls).toEqual([
      [0, 199],
      [200, 299],
    ]);
    expect(await repo.firstPartyAliases([])).toEqual([]);
    f.result.mockResolvedValue({ data: [identity], error: null });
    expect(
      (
        await repo.firstPartyAliases(
          Array.from({ length: 201 }, (_, i) => String(i)),
        )
      ).length,
    ).toBe(2);
    expect(f.query.in.mock.calls.map((c) => c[1].length)).toEqual([200, 1]);
    f.result.mockResolvedValue({ data: null, error: true });
    await expect(repo.firstPartyAliases(["sample"])).rejects.toThrow(
      "Entity aliases unavailable",
    );
  });
  it("uses exact authorized namespaces for detail and fresh RLS tag joins", async () => {
    const f = fixture(row),
      repo = new EntityContentReadRepository(f.client, f.client);
    expect(await repo.find("first_party", "sample", false, owner)).toEqual(row);
    expect(f.query.eq).toHaveBeenCalledWith("release_state", "published");
    f.query.eq.mockClear();
    await repo.find("first_party", "sample", true, owner);
    expect(f.query.eq).not.toHaveBeenCalledWith("release_state", "published");
    await repo.find(owner, "sample", false, owner);
    expect(f.query.eq).toHaveBeenCalledWith("owner_user_id", owner);
    await repo.find(owner, "sample", false, null);
    expect(f.query.eq).toHaveBeenCalledWith("visibility", "public");
    expect(f.query.eq).toHaveBeenCalledWith("owner_namespace", owner);
    f.result.mockResolvedValue({ data: null, error: null });
    expect(await repo.find("first_party", "absent", false, null)).toBeNull();
    f.result.mockResolvedValue({ data: null, error: true });
    await expect(repo.find(owner, "sample", false, owner)).rejects.toThrow(
      "Entity unavailable",
    );
    await expect(repo.tags(owner)).rejects.toThrow("Entity tags unavailable");
    const tag = { id: owner, tag_name: "CURRENT" };
    f.result.mockResolvedValue({ data: [{ tag }, { tag: null }], error: null });
    expect(await repo.tags(owner)).toEqual([tag]);
    expect(f.from).toHaveBeenCalledWith("chimera_asset_tags");
    expect(f.query.eq).toHaveBeenCalledWith("asset_type", "entity_template");
    expect(f.query.eq).toHaveBeenCalledWith("asset_id", owner);
  });
  it("rejects ID/filter injection and enforces pagination bounds", () => {
    expect(
      EntityReadIdSchema.safeParse("id,visibility.eq.private").success,
    ).toBe(false);
    expect(EntityReadIdSchema.safeParse("entity.name:v1").success).toBe(true);
    expect(
      EntityReadQuerySchema.safeParse({ world_id: "bad,(id)" }).success,
    ).toBe(false);
    expect(EntityReadQuerySchema.safeParse({ offset: 1001 }).success).toBe(
      false,
    );
    expect(EntityReadQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(EntityReadQuerySchema.parse({ limit: "1", offset: "2" })).toEqual({
      limit: 1,
      offset: 2,
    });
  });
});
