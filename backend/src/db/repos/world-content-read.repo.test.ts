import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WorldContentReadRepository } from "./world-content-read.repo.js";
import {
  WorldReadIdSchema,
  WorldReadQuerySchema,
} from "../../../../shared/src/types/chimera-world-read.js";
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
describe("world read repository authorization filters and bounded queries", () => {
  it("uses the authenticated client for admin verification and fails safely", async () => {
    const f = fixture(true);
    const repo = new WorldContentReadRepository(f.client, f.client);
    expect(await repo.isAdmin()).toBe(true);
    expect(f.rpc).toHaveBeenCalledWith("is_admin");
    expect(f.query.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
    f.result.mockResolvedValue({ data: null, error: { message: "secret" } });
    await expect(repo.isAdmin()).rejects.toThrow("World audience unavailable");
    f.result.mockResolvedValue({ data: null, error: null });
    await expect(repo.isAdmin()).rejects.toThrow();
  });
  it("resolves only identity metadata and refuses ambiguous owner-scoped aliases", async () => {
    const bodies = fixture(),
      metadata = fixture([identity]);
    const repo = new WorldContentReadRepository(bodies.client, metadata.client);
    expect(await repo.resolve(owner)).toEqual(identity);
    expect(metadata.query.eq).toHaveBeenCalledWith("id", owner);
    expect(await repo.resolve("sample")).toEqual(identity);
    expect(metadata.query.or).toHaveBeenCalledWith(
      "key.eq.sample,slug.eq.sample",
    );
    expect(metadata.query.select.mock.calls.flat().join()).not.toMatch(
      /definition|body/,
    );
    expect(bodies.from).not.toHaveBeenCalled();
    metadata.result.mockResolvedValue({
      data: [
        identity,
        { ...identity, id: "00000000-0000-4000-8000-000000000002" },
      ],
      error: null,
    });
    expect(await repo.resolve("sample")).toBeNull();
    metadata.result.mockResolvedValue({ data: [], error: null });
    expect(await repo.resolve("absent")).toBeNull();
    metadata.result.mockResolvedValue({ data: null, error: true });
    await expect(repo.resolve("sample")).rejects.toThrow(
      "World identity unavailable",
    );
  });
  it("lists canonical first-party rows with a published gate for non-admins and safe filters", async () => {
    const f = fixture([row]);
    const repo = new WorldContentReadRepository(f.client, f.client);
    const search = 'quote",visibility.eq.private,(name.ilike.*)';
    expect(
      await repo.list(
        "first_party",
        false,
        null,
        WorldReadQuerySchema.parse({
          tag: "fantasy",
          search,
          limit: 2,
          offset: 1,
        }),
      ),
    ).toEqual([row]);
    expect(f.from).toHaveBeenCalledWith("chimera_content_source_items");
    expect(f.query.eq).toHaveBeenCalledWith("release_state", "published");
    expect(f.query.contains).toHaveBeenCalledWith("body->tags", '["fantasy"]');
    expect(f.query.or.mock.calls[0]?.[0]).toContain(
      'quote\\",visibility.eq.private',
    );
    expect(f.query.range).toHaveBeenCalledWith(0, 2);
    expect(f.query.order).toHaveBeenCalledWith("body->>name");
    f.query.eq.mockClear();
    await repo.list("first_party", true, owner, WorldReadQuerySchema.parse({}));
    expect(f.query.eq).not.toHaveBeenCalledWith("release_state", "published");
  });
  it("separates public and authenticated owner lanes with explicit predicates", async () => {
    const f = fixture([row]);
    const repo = new WorldContentReadRepository(f.client, f.client);
    await repo.list(
      "public",
      true,
      owner,
      WorldReadQuerySchema.parse({ search: "100%_\\" }),
    );
    expect(f.query.eq).toHaveBeenCalledWith("owner_kind", "player");
    expect(f.query.eq).toHaveBeenCalledWith("visibility", "public");
    expect(f.query.or.mock.calls[0]?.[0]).toContain("100\\\\%\\\\_\\\\\\\\");
    await repo.list("owner", false, owner, WorldReadQuerySchema.parse({}));
    expect(f.query.eq).toHaveBeenCalledWith("owner_user_id", owner);
    await repo.list(
      "owner",
      false,
      owner,
      WorldReadQuerySchema.parse({}),
      true,
    );
    expect(f.query.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    f.result.mockResolvedValue({ data: null, error: true });
    await expect(
      repo.list("owner", false, owner, WorldReadQuerySchema.parse({})),
    ).rejects.toThrow("World list unavailable");
  });
  it("chunks a deep page window and stops on the last short database page", async () => {
    const f = fixture(Array.from({ length: 200 }, () => row));
    const repo = new WorldContentReadRepository(f.client, f.client);
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
          null,
          WorldReadQuerySchema.parse({ offset: 250, limit: 50 }),
        )
      ).length,
    ).toBe(201);
    expect(f.query.range.mock.calls).toEqual([
      [0, 199],
      [200, 299],
    ]);
  });
  it("fetches first-party aliases by bounded key batches without source bodies", async () => {
    const f = fixture([identity]);
    const repo = new WorldContentReadRepository(f.client, f.client);
    expect(await repo.firstPartyAliases([])).toEqual([]);
    expect(f.from).not.toHaveBeenCalled();
    expect(
      (
        await repo.firstPartyAliases(
          Array.from({ length: 201 }, (_, i) => String(i)),
        )
      ).length,
    ).toBe(2);
    expect(f.query.in.mock.calls.map((call) => call[1].length)).toEqual([
      200, 1,
    ]);
    f.result.mockResolvedValue({ data: null, error: true });
    await expect(repo.firstPartyAliases(["sample"])).rejects.toThrow(
      "World aliases unavailable",
    );
  });
  it("looks up first-party and player bodies through their exact authorized namespaces", async () => {
    const f = fixture(row);
    const repo = new WorldContentReadRepository(f.client, f.client);
    expect(await repo.find("first_party", "sample", false, null)).toEqual(row);
    expect(f.query.eq).toHaveBeenCalledWith("release_state", "published");
    f.query.eq.mockClear();
    await repo.find("first_party", "sample", true, owner);
    expect(f.query.eq).not.toHaveBeenCalledWith("release_state", "published");
    await repo.find(owner, "sample", false, owner);
    expect(f.query.eq).toHaveBeenCalledWith("owner_user_id", owner);
    await repo.find(owner, "sample", false, null);
    expect(f.query.eq).toHaveBeenCalledWith("visibility", "public");
    expect(f.query.eq).toHaveBeenCalledWith("owner_namespace", owner);
    expect(f.query.eq).toHaveBeenCalledWith("content_key", "sample");
    f.result.mockResolvedValue({ data: null, error: null });
    expect(await repo.find("first_party", "absent", false, null)).toBeNull();
    f.result.mockResolvedValue({ data: null, error: true });
    await expect(repo.find(owner, "sample", false, owner)).rejects.toThrow(
      "World unavailable",
    );
  });
  it("rejects filter injection in IDs and enforces query bounds", () => {
    expect(
      WorldReadIdSchema.safeParse("id,visibility.eq.private").success,
    ).toBe(false);
    expect(WorldReadIdSchema.safeParse("world.name:v1").success).toBe(true);
    expect(WorldReadQuerySchema.safeParse({ offset: 1001 }).success).toBe(
      false,
    );
    expect(WorldReadQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(
      WorldReadQuerySchema.parse({ limit: "1", offset: "2" }),
    ).toMatchObject({ limit: 1, offset: 2 });
  });
});
