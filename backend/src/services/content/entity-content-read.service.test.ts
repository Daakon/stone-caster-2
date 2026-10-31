import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "../../utils/serviceError.js";
import { ApiErrorCode } from "../../../../shared/src/types/api.js";
import { EntityContentReadService } from "./entity-content-read.service.js";
import { ContentCacheService } from "./content-cache.service.js";
import type {
  EntityContentRow,
  EntityIdentity,
} from "../../db/repos/entity-content-read.repo.js";
import { EntityReadQuerySchema } from "../../../../shared/src/types/chimera-entity-read.js";
import type {
  EntityReadLane,
  EntityReadQuery,
} from "../../../../shared/src/types/chimera-entity-read.js";
import type {
  ContentChange,
  ContentOwnerCursor,
} from "../../../../shared/src/types/chimera-content-changes.js";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const id = "00000000-0000-4000-8000-000000000003";
const params = EntityReadQuerySchema.parse({});
const source = (): EntityContentRow => ({
  content_key: "sample",
  owner_namespace: "first_party",
  body: {
    display_name: "Current entity",
    entity_type: "ITEM",
    world_key: "world",
    raw_data: { traits: ["authored"] },
    tags: ["canonical"],
  },
  release_state: "internal",
  created_at: "now",
  updated_at: "now",
});
const player = (user = owner): EntityContentRow => ({
  ...source(),
  id,
  owner_kind: "player",
  owner_namespace: user,
  owner_user_id: user,
  display_name: "Owner entity",
  entity_type: "NPC",
  raw_data: {
    identity: { name: "Authored" },
    base_state_json: { declared: 7 },
  },
  visibility: "private",
});
const identity = (user = owner): EntityIdentity => ({
  id,
  key: "sample",
  slug: "owned",
  content_key: "sample",
  owner_kind: "player",
  owner_namespace: user,
  owner_user_id: user,
  visibility: "private",
});
function fixture(admin = false) {
  const shared: ContentChange[] = [],
    privateEvents = new Map<string, ContentChange[]>();
  const page = (after: string | null, owners: ContentOwnerCursor[]) => {
    const stream = (events: ContentChange[], cursor: string | null) => ({
      generation: String(events.length),
      head_seq: String(events.length),
      retained_after_seq: "0",
      changes:
        cursor === null
          ? []
          : events.filter((e) => Number(e.seq) > Number(cursor)),
    });
    return Promise.resolve({
      shared: stream(shared, after),
      owners: owners.map((o) => ({
        ...stream(privateEvents.get(o.user_id) ?? [], o.after_seq),
        user_id: o.user_id,
      })),
    });
  };
  const cache = new ContentCacheService({ page });
  const repo = {
    isAdmin: vi.fn<[], Promise<boolean>>().mockResolvedValue(admin),
    resolve: vi
      .fn<[string], Promise<EntityIdentity | null>>()
      .mockResolvedValue(null),
    find: vi
      .fn<
        [string, string, boolean, string | null],
        Promise<EntityContentRow | null>
      >()
      .mockResolvedValue(source()),
    list: vi
      .fn<
        [EntityReadLane, boolean, string | null, EntityReadQuery],
        Promise<EntityContentRow[]>
      >()
      .mockResolvedValue([]),
    worldKey: vi
      .fn<[string], Promise<string | null>>()
      .mockResolvedValue("world"),
    tags: vi
      .fn<[string], Promise<{ id: string; tag_name: string }[]>>()
      .mockResolvedValue([]),
    firstPartyAliases: vi
      .fn<[string[]], Promise<EntityIdentity[]>>()
      .mockResolvedValue([]),
  };
  const emit = (
    namespace: string,
    oldVisibility: string,
    newVisibility: string,
    privateOnly = false,
  ) => {
    const events = privateOnly ? (privateEvents.get(namespace) ?? []) : shared;
    events.push({
      seq: String(events.length + 1),
      generation: String(events.length + 1),
      kind: "entity",
      namespace,
      key: "sample",
      old_facets: { visibility: oldVisibility },
      new_facets: { visibility: newVisibility },
    });
    if (privateOnly) privateEvents.set(namespace, events);
  };
  return { repo, cache, page, emit };
}
afterEach(() => {
  vi.restoreAllMocks();
});

describe("entity reader authorization and durable cache integration", () => {
  it("uses canonical data, stable keys and UUID aliases without inventing state", async () => {
    const { repo, cache } = fixture(true),
      reader = new EntityContentReadService(repo, owner, "admin", cache);
    const value = await reader.find("sample");
    expect(value).toMatchObject({
      id: "sample",
      entity_type: "ITEM",
      kind: "item",
      display_name: "Current entity",
      tags: ["canonical"],
      world_id: "world",
      is_official: true,
      raw_data: { traits: ["authored"] },
    });
    expect(value).not.toHaveProperty("base_state_json");
    expect(repo.tags).not.toHaveBeenCalled();
    repo.resolve.mockResolvedValue({
      ...identity(),
      owner_kind: "first_party",
      owner_namespace: "first_party",
      owner_user_id: null,
    });
    const separate = new ContentCacheService({ page: fixture().page });
    expect(
      await new EntityContentReadService(repo, owner, "alias", separate).find(
        id,
      ),
    ).toMatchObject({ id });
  });
  it("separates admin/published audiences and rechecks role on each request", async () => {
    const { repo, cache } = fixture(true);
    await new EntityContentReadService(repo, owner, "admin", cache).find(
      "sample",
    );
    repo.find.mockResolvedValue(null);
    repo.isAdmin.mockResolvedValue(false);
    await expect(
      new EntityContentReadService(repo, other, "player", cache).find("sample"),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      new EntityContentReadService(repo, null, "anon", cache).find("sample"),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.find).toHaveBeenCalledTimes(2);
    expect(repo.isAdmin).toHaveBeenCalledTimes(2);
  });
  it("denies foreign private IDs before body/tag access even to an admin", async () => {
    const { repo, cache } = fixture(true);
    repo.resolve.mockResolvedValue(identity());
    repo.find.mockResolvedValue(player());
    await expect(
      new EntityContentReadService(repo, other, "foreign", cache).find(id),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.find).not.toHaveBeenCalled();
    expect(repo.tags).not.toHaveBeenCalled();
    expect(
      await new EntityContentReadService(repo, owner, "owner", cache).find(id),
    ).toMatchObject({ base_state_json: { declared: 7 }, kind: "npc" });
  });
  it("reloads tags on entity cache hits and fails safely on relation errors", async () => {
    const { repo, cache } = fixture();
    repo.resolve.mockResolvedValue(identity());
    repo.find.mockResolvedValue(player());
    const reader = new EntityContentReadService(repo, owner, "tags", cache);
    expect((await reader.find(id)).tags).toEqual([]);
    repo.tags.mockResolvedValue([{ id, tag_name: "RENAMED" }]);
    expect((await reader.find(id)).tags).toEqual([{ id, tag_name: "RENAMED" }]);
    expect(repo.find).toHaveBeenCalledOnce();
    repo.tags.mockRejectedValue(new Error("secret"));
    await expect(reader.find(id)).rejects.toMatchObject({ statusCode: 503 });
  });
  it("replays owner-only edits on two instances without shared invalidation", async () => {
    const { repo, cache, page, emit } = fixture();
    repo.resolve.mockResolvedValue(identity());
    repo.find.mockResolvedValue(player());
    const second = new ContentCacheService({ page });
    const a = new EntityContentReadService(repo, owner, "a", cache),
      b = new EntityContentReadService(repo, owner, "b", second);
    await a.find(id);
    await b.find(id);
    repo.find.mockResolvedValue({ ...player(), display_name: "Updated" });
    emit(owner, "private", "private", true);
    expect((await a.find(id)).display_name).toBe("Updated");
    expect((await b.find(id)).display_name).toBe("Updated");
    expect(cache.stats().sharedCursor).toBe("0");
    expect(second.stats().sharedCursor).toBe("0");
  });
  it("refreshes public/owner values on visibility changes and deletion", async () => {
    const { repo, cache, emit } = fixture();
    repo.resolve.mockResolvedValue({ ...identity(), visibility: "public" });
    repo.find.mockResolvedValue({ ...player(), visibility: "public" });
    const foreign = new EntityContentReadService(repo, other, "public", cache),
      mine = new EntityContentReadService(repo, owner, "mine", cache);
    await foreign.find(id);
    await mine.find(id);
    repo.resolve.mockResolvedValue(identity());
    repo.find.mockResolvedValue(player());
    emit(owner, "public", "private");
    await expect(foreign.find(id)).rejects.toMatchObject({ statusCode: 404 });
    expect((await mine.find(id)).visibility).toBe("private");
    emit(owner, "private", "public");
    repo.resolve.mockResolvedValue({ ...identity(), visibility: "public" });
    repo.find.mockResolvedValue({
      ...player(),
      visibility: "public",
      display_name: "Published",
    });
    expect((await foreign.find(id)).display_name).toBe("Published");
    emit(owner, "public", "public");
    repo.find.mockResolvedValue(null);
    await expect(foreign.find(id)).rejects.toMatchObject({ statusCode: 404 });
  });
  it("deduplicates lanes, pages after merging, and keeps card payloads lean", async () => {
    const { repo, cache } = fixture(true),
      pub = { ...player(), visibility: "public" };
    repo.list.mockImplementation((l) =>
      Promise.resolve(
        l === "first_party"
          ? [source()]
          : l === "public"
            ? [pub]
            : [pub, { ...player(), content_key: "private", id: other }],
      ),
    );
    repo.firstPartyAliases.mockResolvedValue([
      {
        ...identity(),
        owner_kind: "first_party",
        owner_namespace: "first_party",
        owner_user_id: null,
      },
    ]);
    const rows = await new EntityContentReadService(
      repo,
      owner,
      "list",
      cache,
    ).list({ ...params, offset: 1, limit: 2, world_id: "world" });
    expect(rows.map((r) => r.id)).toEqual([id, other]);
    expect(rows[0]).not.toHaveProperty("raw_data");
    expect(repo.worldKey).toHaveBeenCalledWith("world");
  });
  it("isolates owner lists, retains root raw data, and rejects anonymous lists", async () => {
    const { repo, cache } = fixture();
    repo.list.mockImplementation((_l, _a, user) =>
      Promise.resolve([player(user ?? owner)]),
    );
    const a = await new EntityContentReadService(repo, owner, "a", cache).list(
      params,
      "rawOwned",
    );
    const b = await new EntityContentReadService(repo, other, "b", cache).list(
      params,
      "owned",
    );
    expect(a[0]).toMatchObject({
      owner_user_id: owner,
      raw_data: { base_state_json: { declared: 7 } },
    });
    expect(b[0]?.owner_user_id).toBe(other);
    expect(repo.list.mock.calls.map((c) => c[0])).toEqual(["owner", "owner"]);
    await expect(
      new EntityContentReadService(repo, null, "anon", cache).list(params),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
  it("invalidates every first-party listing page on unpublish", async () => {
    const { repo, cache, emit } = fixture();
    repo.list.mockImplementation((l) =>
      Promise.resolve(
        l === "first_party"
          ? [{ ...source(), release_state: "published" }]
          : [],
      ),
    );
    const reader = new EntityContentReadService(repo, owner, "list", cache);
    await reader.list(params);
    await reader.list({ ...params, offset: 1 });
    repo.list.mockResolvedValue([]);
    emit("first_party", "public", "private");
    expect(await reader.list(params)).toEqual([]);
    expect(await reader.list({ ...params, offset: 1 })).toEqual([]);
    expect(cache.stats().invalidations).toBe(4);
  });
  it("uses authored legacy names/types without fabricated defaults", async () => {
    const { repo, cache } = fixture();
    repo.resolve.mockResolvedValue(identity());
    repo.find.mockResolvedValue({
      ...player(),
      display_name: null,
      entity_type: null,
      raw_data: {
        name: "Legacy",
        type: "FACTION",
        images: [{ url: "/image" }],
      },
    });
    expect(
      await new EntityContentReadService(repo, owner, "legacy", cache).find(id),
    ).toMatchObject({
      display_name: "Legacy",
      entity_type: "FACTION",
      kind: "faction",
      images: [{ url: "/image" }],
      description_short: null,
    });
    const f = fixture();
    f.repo.find.mockResolvedValue({ ...source(), body: { raw_data: {} } });
    await expect(
      new EntityContentReadService(f.repo, owner, "missing", f.cache).find(
        "sample",
      ),
    ).rejects.toMatchObject({ statusCode: 503 });
  });
  it("fails closed on audience/body/cache errors with trace-only logs", async () => {
    const { repo, cache } = fixture();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    repo.isAdmin.mockRejectedValue(new Error("secret"));
    await expect(
      new EntityContentReadService(repo, owner, "trace", cache).list(params),
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(log.mock.calls.flat().join()).toContain("trace");
    expect(log.mock.calls.flat().join()).not.toContain("secret");
    expect(repo.list).not.toHaveBeenCalled();
    repo.isAdmin.mockResolvedValue(false);
    repo.find.mockRejectedValue(new Error("private body"));
    await expect(
      new EntityContentReadService(repo, owner, "trace", cache).find("sample"),
    ).rejects.toMatchObject({ statusCode: 503 });
    const unavailable = {
      read: vi.fn().mockRejectedValue(
        new ServiceError(503, {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: "Cache unavailable",
        }),
      ),
    };
    await expect(
      new EntityContentReadService(repo, owner, "trace", unavailable).find(
        "sample",
      ),
    ).rejects.toMatchObject({ statusCode: 503 });
  });
});
