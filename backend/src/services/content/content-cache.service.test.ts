import { describe, it, expect, vi } from "vitest";
import { ContentCacheService } from "./content-cache.service.js";
import type {
  ContentCacheAddress,
  ContentChange,
  ContentOwnerCursor,
} from "../../../../shared/src/types/chimera-content-changes.js";
const ownerA = "00000000-0000-4000-8000-000000000001",
  ownerB = "00000000-0000-4000-8000-000000000002";
const source: ContentCacheAddress = {
  scope: "shared",
  type: "source",
  kind: "world",
  namespace: "first_party",
  key: "sample",
  audience: "admin",
};
const blob: ContentCacheAddress = { type: "blob", sha256: "a".repeat(64) };
const privateSource = (owner: string): ContentCacheAddress => ({
  scope: "owner",
  type: "source",
  kind: "world",
  namespace: owner,
  key: "sample",
  owner,
  audience: owner,
});
const list = (genre: string, page = "1"): ContentCacheAddress => ({
  scope: "shared",
  type: "list",
  kind: "world",
  audience: "published",
  filter: { genre },
  page,
});
function change(
  seq: number,
  namespace = "first_party",
  old_facets: ContentChange["old_facets"] = { genre: "old" },
  new_facets: ContentChange["new_facets"] = { genre: "new" },
): ContentChange {
  return {
    seq: String(seq),
    generation: String(seq),
    kind: "world",
    namespace,
    key: "sample",
    old_facets,
    new_facets,
  };
}
function setup(capacity = 512) {
  const shared: ContentChange[] = [],
    owners = new Map<string, ContentChange[]>();
  const state = { floor: "0", pageSize: 100 };
  const stream = (
    events: ContentChange[],
    after: string | null,
    floor = "0",
  ) => ({
    generation: events.at(-1)?.generation ?? "0",
    head_seq: events.at(-1)?.seq ?? "0",
    retained_after_seq: floor,
    changes:
      after === null
        ? []
        : events
            .filter((event) => BigInt(event.seq) > BigInt(after))
            .slice(0, state.pageSize),
  });
  const page = vi.fn((after: string | null, requested: ContentOwnerCursor[]) =>
    Promise.resolve({
      shared: stream(shared, after, state.floor),
      owners: requested.map((owner) => ({
        user_id: owner.user_id,
        ...stream(owners.get(owner.user_id) ?? [], owner.after_seq),
      })),
    }),
  );
  return {
    cache: new ContentCacheService({ page }, capacity),
    shared,
    owners,
    state,
    page,
  };
}
describe("durable content cache catch-up", () => {
  it("probes before hits and keeps immutable blob values outside invalidation", async () => {
    const { cache, shared, page } = setup();
    const load = vi
      .fn<[], Promise<{ value: number }>>()
      .mockResolvedValue({ value: 1 });
    const first = await cache.read(source, load);
    first.value = 99;
    expect(await cache.read(source, load)).toEqual({ value: 1 });
    expect(load).toHaveBeenCalledOnce();
    expect(page).toHaveBeenCalledTimes(3);
    const loadBlob = vi.fn().mockResolvedValue({ frozen: true });
    await cache.read(blob, loadBlob);
    shared.push(change(1));
    await cache.read(source, load);
    expect(load).toHaveBeenCalledTimes(2);
    expect(await cache.read(blob, loadBlob)).toEqual({ frozen: true });
    expect(loadBlob).toHaveBeenCalledOnce();
  });
  it("invalidates source, preview, and all old/new matching list pages while retaining other filters", async () => {
    const { cache, shared } = setup();
    const load = vi.fn().mockResolvedValue("value");
    const preview: ContentCacheAddress = { ...source, type: "preview" };
    await cache.read(source, load);
    await cache.read(preview, load);
    await cache.read(list("old", "1"), load);
    await cache.read(list("old", "2"), load);
    await cache.read(list("new"), load);
    await cache.read(list("other"), load);
    shared.push(change(1));
    await cache.read(source, load);
    expect(cache.stats().invalidations).toBe(5);
    expect(await cache.read(list("other"), load)).toBe("value");
    expect(load).toHaveBeenCalledTimes(7);
  });
  it("invalidates unknown listing filters conservatively and matches array facets", async () => {
    const { cache, shared } = setup();
    const load = vi.fn().mockResolvedValue("value");
    const unknown: ContentCacheAddress = {
      scope: "shared",
      type: "list",
      kind: "world",
      audience: "published",
      filter: { search: "term" },
      page: "1",
    };
    const tags: ContentCacheAddress = {
      ...unknown,
      filter: { tags: ["a", "b"] },
      page: "2",
    };
    await cache.read(unknown, load);
    await cache.read(tags, load);
    shared.push(change(1, "first_party", null, { tags: ["a"] }));
    await cache.read(source, load);
    expect(cache.stats().invalidations).toBe(2);
  });
  it("keeps private owners isolated and probes only its active owner set", async () => {
    const { cache, owners, page } = setup();
    const loadA = vi.fn().mockResolvedValue("A"),
      loadB = vi.fn().mockResolvedValue("B");
    await cache.read(privateSource(ownerA), loadA);
    await cache.read(privateSource(ownerB), loadB);
    owners.set(ownerA, [change(1, ownerA)]);
    expect(await cache.read(privateSource(ownerB), loadB)).toBe("B");
    expect(loadB).toHaveBeenCalledOnce();
    await cache.read(privateSource(ownerA), loadA);
    expect(loadA).toHaveBeenCalledTimes(2);
    expect(
      page.mock.calls
        .at(-1)?.[1]
        .map((cursor) => cursor.user_id)
        .sort(),
    ).toEqual([ownerA, ownerB]);
    expect(cache.stats().sharedCursor).toBe("0");
  });
  it("shared visibility transitions invalidate an owner's keys and lists on another instance", async () => {
    const one = setup(),
      two = new ContentCacheService({ page: one.page });
    const load = vi.fn().mockResolvedValue("private");
    const ownerList: ContentCacheAddress = {
      scope: "owner",
      owner: ownerA,
      type: "list",
      kind: "world",
      audience: ownerA,
      filter: {},
      page: "1",
    };
    await one.cache.read(privateSource(ownerA), load);
    await two.read(privateSource(ownerA), load);
    await two.read(ownerList, load);
    one.shared.push(
      change(1, ownerA, { visibility: "private" }, { visibility: "public" }),
    );
    await two.read(privateSource(ownerA), load);
    expect(two.stats().invalidations).toBe(2);
    expect(one.cache.stats().invalidations).toBe(0);
    await one.cache.read(privateSource(ownerA), load);
    expect(one.cache.stats().invalidations).toBe(1);
  });
  it("replays disconnected pages in order before serving a mutable hit", async () => {
    const { cache, shared, state, page } = setup();
    const load = vi.fn().mockResolvedValue("body");
    await cache.read(source, load);
    state.pageSize = 2;
    for (let seq = 1; seq <= 5; seq++)
      shared.push({ ...change(seq), generation: "1" });
    await cache.read(source, load);
    expect(cache.stats().rows).toBe(5);
    expect(cache.stats().sharedCursor).toBe("5");
    expect(page.mock.calls.map((call) => call[0])).toEqual([
      null,
      "0",
      "0",
      "2",
      "4",
      "5",
    ]);
  });
  it("clears mutable caches across a pruned gap and adopts the actual head", async () => {
    const { cache, shared, state } = setup();
    const load = vi.fn().mockResolvedValue("body"),
      loadBlob = vi.fn().mockResolvedValue("frozen");
    await cache.read(source, load);
    await cache.read(blob, loadBlob);
    shared.push(change(3));
    state.floor = "2";
    await cache.read(source, load);
    expect(load).toHaveBeenCalledTimes(2);
    expect(cache.stats().sharedCursor).toBe("3");
    await cache.read(blob, loadBlob);
    expect(loadBlob).toHaveBeenCalledOnce();
  });
  it("does not cache a body filled across a concurrent commit", async () => {
    const { cache, shared } = setup();
    let version = 1;
    const load = vi.fn(() => {
      const body = { version };
      if (version === 1) {
        version = 2;
        shared.push(change(1));
      }
      return Promise.resolve(body);
    });
    expect(await cache.read(source, load)).toEqual({ version: 2 });
    expect(load).toHaveBeenCalledTimes(2);
    expect(await cache.read(source, load)).toEqual({ version: 2 });
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("clears only the affected owner on a pruned owner prefix", async () => {
    const { cache, page, owners } = setup();
    const loadA = vi.fn().mockResolvedValue("A"),
      loadB = vi.fn().mockResolvedValue("B"),
      loadShared = vi.fn().mockResolvedValue("shared");
    await cache.read(source, loadShared);
    await cache.read(privateSource(ownerA), loadA);
    await cache.read(privateSource(ownerB), loadB);
    owners.set(ownerA, [change(3, ownerA)]);
    page.mockResolvedValueOnce({
      shared: {
        generation: "0",
        head_seq: "0",
        retained_after_seq: "0",
        changes: [],
      },
      owners: [
        {
          user_id: ownerA,
          generation: "3",
          head_seq: "3",
          retained_after_seq: "2",
          changes: [],
        },
        {
          user_id: ownerB,
          generation: "0",
          head_seq: "0",
          retained_after_seq: "0",
          changes: [],
        },
      ],
    });
    expect(await cache.read(privateSource(ownerA), loadA)).toBe("A");
    expect(loadA).toHaveBeenCalledTimes(2);
    await cache.read(privateSource(ownerB), loadB);
    await cache.read(source, loadShared);
    expect(loadB).toHaveBeenCalledOnce();
    expect(loadShared).toHaveBeenCalledOnce();
  });
  it("serializes concurrent probes and refuses fills after repeated source changes", async () => {
    const { cache, shared } = setup();
    const load = vi.fn(() => {
      shared.push(change(shared.length + 1));
      return Promise.resolve("candidate");
    });
    await expect(cache.read(source, load)).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(load).toHaveBeenCalledTimes(3);
    const stable = vi.fn().mockResolvedValue("stable");
    expect(
      await Promise.all([
        cache.read(source, stable),
        cache.read({ ...source, key: "second" }, stable),
      ]),
    ).toEqual(["stable", "stable"]);
  });
  it("fails closed on a disconnected probe, drops mutable entries, and can recover", async () => {
    const { cache, page } = setup();
    const load = vi.fn().mockResolvedValue("body");
    await cache.read(source, load);
    page.mockRejectedValueOnce(new Error("private secret"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(
        cache.read(source, load, "request-trace"),
      ).rejects.toMatchObject({ statusCode: 503 });
      expect(log).toHaveBeenCalledWith(
        JSON.stringify({
          level: "error",
          event: "content_cache_catchup_failed",
          traceId: "request-trace",
        }),
      );
    } finally {
      log.mockRestore();
    }
    expect(cache.stats().entries).toBe(0);
    await cache.read(source, load);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("sanitizes a body load failure with the request trace", async () => {
    const { cache } = setup();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(
        cache.read(
          source,
          vi.fn().mockRejectedValue(new Error("private database detail")),
          "fill-trace",
        ),
      ).rejects.toMatchObject({
        statusCode: 503,
        message: "Content cache fill is temporarily unavailable.",
      });
      expect(log).toHaveBeenCalledWith(
        JSON.stringify({
          level: "error",
          event: "content_cache_fill_failed",
          traceId: "fill-trace",
        }),
      );
    } finally {
      log.mockRestore();
    }
  });
  it.each(["gap", "generation", "floor", "missing"])(
    "refuses a malformed %s stream without a stale hit",
    async (bad) => {
      const { cache, page } = setup();
      const load = vi.fn().mockResolvedValue("body");
      await cache.read(source, load);
      page.mockResolvedValueOnce({
        shared: {
          generation: bad === "generation" ? "0" : "1",
          head_seq: "1",
          retained_after_seq: bad === "floor" ? "2" : "0",
          changes:
            bad === "missing"
              ? []
              : [
                  {
                    ...change(bad === "gap" ? 2 : 1),
                    generation: bad === "generation" ? "2" : "1",
                  },
                ],
        },
        owners: [],
      });
      await expect(cache.read(source, load)).rejects.toMatchObject({
        statusCode: 503,
      });
      expect(load).toHaveBeenCalledOnce();
    },
  );
  it("bounds catch-up pages instead of indefinitely serving stale content", async () => {
    const { cache, shared, state } = setup();
    const load = vi.fn().mockResolvedValue("body");
    await cache.read(source, load);
    state.pageSize = 1;
    for (let seq = 1; seq <= 17; seq++) shared.push(change(seq));
    await expect(cache.read(source, load)).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(cache.stats().entries).toBe(0);
  });
  it("enforces a bounded health window on slow probes", async () => {
    const { cache, page } = setup();
    const load = vi.fn().mockResolvedValue("body");
    await cache.read(source, load);
    const now = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(3000);
    try {
      await expect(cache.read(source, load)).rejects.toMatchObject({
        statusCode: 503,
      });
    } finally {
      now.mockRestore();
    }
    expect(page).toHaveBeenCalledTimes(2);
  });
  it("evicts values and owner cursors with a bounded active set", async () => {
    const { cache } = setup(2);
    const load = vi.fn().mockResolvedValue("body");
    await cache.read(source, load);
    await cache.read({ ...source, key: "two" }, load);
    await cache.read({ ...source, key: "three" }, load);
    expect(cache.stats().entries).toBe(2);
    await cache.read(source, load);
    expect(load).toHaveBeenCalledTimes(4);
    for (let index = 1; index <= 33; index++)
      await cache.read(
        privateSource(
          `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        ),
        load,
      );
    expect(cache.stats().activeOwners).toBeLessThanOrEqual(2);
    expect(cache.stats().entries).toBeLessThanOrEqual(2);
    const retained = setup().cache;
    for (let index = 1; index <= 33; index++)
      await retained.read(
        privateSource(
          `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        ),
        load,
      );
    expect(retained.stats().activeOwners).toBe(32);
  });
  it("rejects foreign private namespaces and invalid immutable hashes", async () => {
    const { cache } = setup();
    const load = vi.fn();
    await expect(
      cache.read(
        { ...privateSource(ownerA), namespace: ownerB } as ContentCacheAddress,
        load,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      cache.read({ type: "blob", sha256: "bad" }, load),
    ).rejects.toThrow();
    expect(load).not.toHaveBeenCalled();
  });
});
