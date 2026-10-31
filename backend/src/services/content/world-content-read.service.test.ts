import { afterEach, describe, expect, it, vi } from "vitest";
import { WorldContentReadService } from "./world-content-read.service.js";
import { ContentCacheService } from "./content-cache.service.js";
import type {
  WorldContentRow,
  WorldIdentity,
} from "../../db/repos/world-content-read.repo.js";
import { WorldReadQuerySchema } from "../../../../shared/src/types/chimera-world-read.js";
import type {
  WorldReadLane,
  WorldReadQuery,
} from "../../../../shared/src/types/chimera-world-read.js";
import type {
  ContentChange,
  ContentOwnerCursor,
} from "../../../../shared/src/types/chimera-content-changes.js";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const id = "00000000-0000-4000-8000-000000000003";
const params = WorldReadQuerySchema.parse({});
const source = (): WorldContentRow => ({
  content_key: "sample",
  owner_namespace: "first_party",
  body: {
    name: "Current world",
    slug: "current",
    tags: ["fantasy"],
    definition: {
      summary: "Current summary",
      hero_quote: "Hello",
      images: [{ id: "cover", url: "/cover" }],
    },
  },
  release_state: "internal",
  created_at: "2026-10-01",
  updated_at: "2026-10-02",
});
const player = (user = owner): WorldContentRow => ({
  ...source(),
  id,
  owner_kind: "player",
  owner_namespace: user,
  owner_user_id: user,
  name: "Owner world",
  slug: "owned",
  definition: {},
  visibility: "private",
  tags: [],
  genre_tags: [],
  character_schema_contributions: {},
});
const identity = (user = owner): WorldIdentity => ({
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
      .fn<[string], Promise<WorldIdentity | null>>()
      .mockResolvedValue(null),
    find: vi
      .fn<
        [string, string, boolean, string | null],
        Promise<WorldContentRow | null>
      >()
      .mockResolvedValue(source()),
    list: vi
      .fn<
        [WorldReadLane, boolean, string | null, WorldReadQuery],
        Promise<WorldContentRow[]>
      >()
      .mockResolvedValue([]),
    firstPartyAliases: vi
      .fn<[string[]], Promise<WorldIdentity[]>>()
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
      kind: "world",
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
describe("world content authorization and durable reader integration", () => {
  it("uses current source bodies and retains a legacy first-party UUID alias", async () => {
    const { repo, cache } = fixture(true);
    repo.resolve.mockResolvedValue({
      ...identity(),
      owner_kind: "first_party",
      owner_namespace: "first_party",
      owner_user_id: null,
    });
    const first = new WorldContentReadService(repo, owner, "one", cache);
    expect(await first.find(id)).toMatchObject({
      id,
      name: "Current world",
      display_name: "Current world",
      release_state: "internal",
      visibility: "private",
      is_official: true,
      images: [{ id: "cover" }],
    });
    await new WorldContentReadService(repo, owner, "two", cache).find(id);
    expect(repo.find).toHaveBeenCalledOnce();
    expect(repo.isAdmin).toHaveBeenCalledTimes(2);
    expect(repo.resolve).toHaveBeenCalledTimes(2);
  });
  it("never serves an admin-warmed internal value to a public or non-admin reader", async () => {
    const { repo, cache } = fixture(true);
    await new WorldContentReadService(repo, owner, "admin", cache).find(
      "sample",
    );
    repo.find.mockResolvedValue(null);
    await expect(
      new WorldContentReadService(repo, null, "public", cache).find("sample"),
    ).rejects.toMatchObject({ statusCode: 404 });
    repo.isAdmin.mockResolvedValue(false);
    await expect(
      new WorldContentReadService(repo, other, "player", cache).find("sample"),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.find).toHaveBeenLastCalledWith(
      "first_party",
      "sample",
      false,
      null,
    );
    expect(repo.find).toHaveBeenCalledTimes(2);
    expect(repo.isAdmin).toHaveBeenCalledTimes(2);
  });
  it("uses owner-scoped detail entries and returns non-disclosing 404 to a foreign owner", async () => {
    const { repo, cache } = fixture();
    repo.resolve.mockResolvedValue(identity());
    repo.find.mockResolvedValue(player());
    const mine = new WorldContentReadService(repo, owner, "mine", cache);
    expect(await mine.find(id)).toMatchObject({
      owner_user_id: owner,
      name: "Owner world",
    });
    await expect(
      new WorldContentReadService(repo, other, "foreign", cache).find(id),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      new WorldContentReadService(repo, null, "guest", cache).rulesets(id),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.find).toHaveBeenCalledOnce();
    expect(await mine.rulesets(id)).toEqual([]);
  });
  it("replays private edits on two independent owner caches without touching shared state", async () => {
    const { repo, cache, page, emit } = fixture();
    repo.resolve.mockResolvedValue(identity());
    repo.find.mockResolvedValue(player());
    const secondCache = new ContentCacheService({ page });
    const first = new WorldContentReadService(repo, owner, "one", cache),
      second = new WorldContentReadService(repo, owner, "two", secondCache);
    await first.find(id);
    await second.find(id);
    repo.find.mockResolvedValue({ ...player(), name: "Private update" });
    emit(owner, "private", "private", true);
    expect(await first.find(id)).toMatchObject({ name: "Private update" });
    expect(await second.find(id)).toMatchObject({ name: "Private update" });
    expect(cache.stats().sharedCursor).toBe("0");
    expect(secondCache.stats().sharedCursor).toBe("0");
  });
  it("invalidates public and owner values across visibility transitions", async () => {
    const { repo, cache, emit } = fixture();
    repo.resolve.mockResolvedValue({ ...identity(), visibility: "public" });
    repo.find.mockResolvedValue({ ...player(), visibility: "public" });
    const publicReader = new WorldContentReadService(
        repo,
        null,
        "public",
        cache,
      ),
      ownReader = new WorldContentReadService(repo, owner, "owner", cache);
    await publicReader.find(id);
    await ownReader.find(id);
    emit(owner, "public", "private");
    repo.resolve.mockResolvedValue(identity());
    repo.find.mockResolvedValue(player());
    await expect(publicReader.find(id)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(await ownReader.find(id)).toMatchObject({ visibility: "private" });
    emit(owner, "private", "public");
    repo.resolve.mockResolvedValue({ ...identity(), visibility: "public" });
    repo.find.mockResolvedValue({
      ...player(),
      visibility: "public",
      name: "Published update",
    });
    expect(await publicReader.find(id)).toMatchObject({
      name: "Published update",
    });
  });
  it("merges bounded shared and owner windows, deduplicates public owner rows, and pages after merging", async () => {
    const { repo, cache } = fixture(true);
    const publicWorld = { ...player(), visibility: "public" };
    repo.list.mockImplementation((lane: string) =>
      Promise.resolve(
        lane === "first_party"
          ? [source()]
          : lane === "public"
            ? [publicWorld]
            : [publicWorld, { ...player(), content_key: "private" }],
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
    const result = await new WorldContentReadService(
      repo,
      owner,
      "page",
      cache,
    ).list(
      WorldReadQuerySchema.parse({
        offset: 1,
        limit: 2,
        tag: "fantasy",
        search: "world",
      }),
    );
    expect(result.map((w) => w.content_key)).toEqual(["sample", "private"]);
    expect(repo.list).toHaveBeenCalledTimes(3);
    expect(repo.firstPartyAliases).toHaveBeenCalledWith(["sample"]);
  });
  it("keeps owned lists isolated and rejects anonymous owned-list requests", async () => {
    const { repo, cache } = fixture();
    repo.list.mockImplementation(
      (_lane: string, _admin: boolean, user: string | null) =>
        Promise.resolve([player(user ?? owner)]),
    );
    const first = await new WorldContentReadService(
      repo,
      owner,
      "A",
      cache,
    ).list(params, true);
    const second = await new WorldContentReadService(
      repo,
      other,
      "B",
      cache,
    ).list(params, true);
    expect(first[0]?.owner_user_id).toBe(owner);
    expect(second[0]?.owner_user_id).toBe(other);
    expect(repo.list.mock.calls.map((call) => call[0])).toEqual([
      "owner",
      "owner",
    ]);
    await expect(
      new WorldContentReadService(repo, null, "anon", cache).list(params, true),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
  it("invalidates all cached first-party listing pages on unpublish", async () => {
    const { repo, cache, emit } = fixture();
    repo.list.mockImplementation((lane: string) =>
      Promise.resolve(
        lane === "first_party"
          ? [{ ...source(), release_state: "published" }]
          : [],
      ),
    );
    const reader = new WorldContentReadService(repo, null, "published", cache);
    await reader.list(params);
    await reader.list({ ...params, offset: 1 });
    repo.list.mockResolvedValue([]);
    emit("first_party", "public", "private");
    expect(await reader.list(params)).toEqual([]);
    expect(await reader.list({ ...params, offset: 1 })).toEqual([]);
    expect(cache.stats().invalidations).toBe(4);
  });
  it("projects the existing catalog envelope fields with canonical source data", async () => {
    const { repo, cache } = fixture();
    repo.list.mockImplementation((lane: string) =>
      Promise.resolve(
        lane === "first_party"
          ? [{ ...source(), release_state: "published" }]
          : [],
      ),
    );
    const reader = new WorldContentReadService(repo, null, "catalog", cache);
    repo.find.mockResolvedValue({ ...source(), release_state: "published" });
    expect(await reader.catalogList(params)).toEqual([
      expect.objectContaining({
        id: "sample",
        short_desc: "Current summary",
        hero_quote: "Hello",
        status: "active",
        cover_media: { id: "cover", provider_key: "/cover" },
      }),
    ]);
    expect(await reader.catalogFind("sample")).toMatchObject({
      name: "Current world",
    });
  });
  it("preserves supplied contribution/image/genre fields and leaves absent fields empty", async () => {
    const { repo, cache } = fixture();
    repo.resolve.mockResolvedValue(identity());
    repo.find.mockResolvedValue({
      ...player(),
      definition: {
        character_schema_contributions: { declared: true },
        genre: "cozy",
        setting: "forest",
      },
      tags: null,
      genre_tags: null,
      character_schema_contributions: null,
    });
    expect(
      await new WorldContentReadService(repo, owner, "dto", cache).catalogFind(
        id,
      ),
    ).toMatchObject({ cover_media: null, short_desc: "", hero_quote: "" });
    expect(
      await new WorldContentReadService(repo, owner, "dto", cache).find(id),
    ).toMatchObject({
      character_schema_contributions: { declared: true },
      genre: "cozy",
      setting: "forest",
      tags: [],
      genre_tags: [],
      images: [],
    });
  });
  it("fails closed on audience or body errors with safe trace logs", async () => {
    const { repo, cache } = fixture();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    repo.isAdmin.mockRejectedValue(new Error("secret database"));
    await expect(
      new WorldContentReadService(repo, owner, "trace", cache).list(params),
    ).rejects.toMatchObject({
      statusCode: 503,
      message: "World content is temporarily unavailable.",
    });
    expect(log).toHaveBeenCalledWith(
      JSON.stringify({
        level: "error",
        event: "world_content_read_failed",
        traceId: "trace",
      }),
    );
    expect(repo.list).not.toHaveBeenCalled();
    repo.find.mockRejectedValue(new Error("private body"));
    await expect(
      new WorldContentReadService(repo, null, "body", cache).find("sample"),
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(JSON.stringify(log.mock.calls)).not.toContain("private body");
  });
  it("rejects an untrusted owner identifier before accessing the cache", () => {
    const { repo, cache } = fixture();
    expect(
      () => new WorldContentReadService(repo, "spoofed", "bad", cache),
    ).toThrow();
  });
});
