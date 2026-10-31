import { afterEach, describe, expect, it, vi } from "vitest";
import { LoreContentReadService } from "./lore-content-read.service.js";
import { ContentCacheService } from "./content-cache.service.js";
import { mapEntityContentRow } from "./entity-content-read.service.js";
import { ServiceError } from "../../utils/serviceError.js";
import { ApiErrorCode } from "../../../../shared/src/types/api.js";
import {
  LoreReadQuerySchema,
  LoreContextQuerySchema,
} from "../../../../shared/src/types/chimera-lore-read.js";
import type {
  LoreContentRow,
  LoreIdentity,
} from "../../db/repos/lore-content-read.repo.js";
import type {
  ContentChange,
  ContentOwnerCursor,
} from "../../../../shared/src/types/chimera-content-changes.js";
import {
  storyFixture,
  storyWorldFixture as worldFixture,
  storyOwner as owner,
  storyOther as other,
  storyWorldId as worldId,
  storyId,
} from "../../__tests__/fixtures/story-read.js";
const id = "00000000-0000-4000-8000-000000000005";
const row = (user = owner): LoreContentRow => ({
  id,
  content_key: "lore-key",
  owner_kind: "player",
  owner_namespace: user,
  owner_user_id: user,
  visibility: "private",
  release_state: "internal",
  fragment: { display_name: "Authored lore", entry_text: "Authored facts" },
  keywords: ["fact"],
  world_id: worldId,
  entity_id: null,
  story_id: null,
  created_at: "now",
  updated_at: "now",
});
const identity = (user = owner): LoreIdentity => ({
  id,
  content_key: "lore-key",
  owner_kind: "player",
  owner_namespace: user,
  owner_user_id: user,
  visibility: "private",
});
const source = (): LoreContentRow => ({
  content_key: "canonical",
  owner_namespace: "first_party",
  release_state: "internal",
  body: {
    world_key: "mystika",
    fragment: { entry_text: "Canonical facts" },
    keywords: ["canonical"],
  },
  created_at: "now",
  updated_at: "now",
});
function fixture() {
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
    isAdmin: vi.fn<[], Promise<boolean>>().mockResolvedValue(false),
    resolve: vi
      .fn<[string], Promise<LoreIdentity | null>>()
      .mockResolvedValue(identity()),
    firstPartyAliases: vi
      .fn<[string[]], Promise<LoreIdentity[]>>()
      .mockResolvedValue([]),
    list: vi
      .fn<
        [unknown, unknown, unknown, unknown, unknown],
        Promise<LoreContentRow[]>
      >()
      .mockResolvedValue([row()]),
    find: vi
      .fn<[string, string, boolean, string], Promise<LoreContentRow | null>>()
      .mockResolvedValue(row()),
    tags: vi
      .fn<
        [string[]],
        Promise<{ asset_id: string; tag: { id: string; tag_name: string } }[]>
      >()
      .mockResolvedValue([]),
  };
  const parents = {
    world: {
      find: vi
        .fn<[string], Promise<ReturnType<typeof worldFixture>>>()
        .mockResolvedValue(worldFixture()),
    },
    entity: {
      find: vi
        .fn<[string], Promise<ReturnType<typeof mapEntityContentRow>>>()
        .mockResolvedValue(
          mapEntityContentRow({
            ...row(),
            key: "entity-key",
            slug: "entity",
            entity_type: "NPC",
            raw_data: {},
          }),
        ),
    },
    story: {
      find: vi
        .fn<
          [string],
          Promise<ReturnType<typeof storyFixture> & { world: null }>
        >()
        .mockResolvedValue({ ...storyFixture(), world: null }),
    },
  };
  const emit = (namespace = owner, privateOnly = true) => {
    const events = privateOnly ? (privateEvents.get(namespace) ?? []) : shared;
    events.push({
      seq: String(events.length + 1),
      generation: String(events.length + 1),
      kind: "lore",
      namespace,
      key: "lore-key",
      old_facets: { visibility: "private" },
      new_facets: { visibility: "public" },
    });
    if (privateOnly) privateEvents.set(namespace, events);
  };
  const reader = (user: string | null = owner, selectedCache = cache) =>
    new LoreContentReadService(repo, parents, user, "trace", selectedCache);
  return { repo, parents, cache, emit, reader, page };
}
afterEach(() => {
  vi.restoreAllMocks();
});
describe("lore ownership, context and durable cache boundaries", () => {
  it("uses an existing canonical UUID alias and authored legacy content/inline tags", async () => {
    const f = fixture();
    f.repo.resolve.mockResolvedValue({
      ...identity(),
      content_key: "canonical",
      owner_kind: "first_party",
      owner_namespace: "first_party",
      owner_user_id: null,
    });
    f.repo.find.mockResolvedValue({
      ...source(),
      release_state: "published",
      body: {
        world_key: "mystika",
        fragment: { content: "Authored content", tags: ["authored"] },
      },
    });
    expect(await f.reader().find(id)).toMatchObject({
      id,
      content_key: "canonical",
      entry_text: "Authored content",
      content_chunk: "Authored content",
      tags: ["authored"],
      visibility: "public",
    });
    expect(f.repo.find).toHaveBeenCalledWith(
      "first_party",
      "canonical",
      false,
      owner,
    );
  });
  it("renders actual fragment values, owner and visibility without invented version/system flags", async () => {
    const f = fixture(),
      value = await f.reader().find(id);
    expect(value).toMatchObject({
      owner_user_id: owner,
      visibility: "private",
      display_name: "Authored lore",
      entry_text: "Authored facts",
      content_chunk: "Authored facts",
      keywords: ["fact"],
      type: null,
      embedding: null,
    });
    expect(value).not.toHaveProperty("version");
    expect(value).not.toHaveProperty("is_system_asset");
    expect(f.parents.world.find).not.toHaveBeenCalled();
  });
  it("denies foreign private identity before any body or parent read", async () => {
    const f = fixture();
    await expect(f.reader(other).find(id)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(f.repo.find).not.toHaveBeenCalled();
    expect(f.parents.world.find).not.toHaveBeenCalled();
    await expect(f.reader(null).find(id)).rejects.toMatchObject({
      statusCode: 401,
    });
  });
  it("separates admin internal canonical data from published readers and checks fresh roles", async () => {
    const f = fixture();
    f.repo.resolve.mockResolvedValue(null);
    f.repo.find.mockResolvedValue(source());
    f.repo.isAdmin.mockResolvedValue(true);
    expect(await f.reader().find("canonical")).toMatchObject({
      id: "canonical",
      world_id: "mystika",
      display_name: null,
      type: null,
      entry_text: "Canonical facts",
      is_official: true,
    });
    f.repo.isAdmin.mockResolvedValue(false);
    f.repo.find.mockResolvedValue(null);
    await expect(f.reader(other).find("canonical")).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(f.repo.isAdmin).toHaveBeenCalledTimes(2);
    expect(f.repo.find).toHaveBeenCalledTimes(2);
  });
  it("reads directly owned rows and ignores foreign private bodies even on an owned world", async () => {
    const f = fixture();
    f.repo.list.mockResolvedValue([row(), row(other)]);
    expect(
      (await f.reader().list(LoreReadQuerySchema.parse({}))).map(
        (v) => v.owner_user_id,
      ),
    ).toEqual([owner]);
    expect(f.repo.list).toHaveBeenCalledWith(
      "owner",
      false,
      owner,
      { limit: 50, offset: 0 },
      null,
    );
  });
  it("checks entity then story then world context before each cached listing", async () => {
    const f = fixture(),
      reader = f.reader(),
      q = LoreContextQuerySchema.parse({
        world_id: worldId,
        entity_id: id,
        story_id: storyId,
      });
    await reader.listContext(q);
    await reader.listContext(q);
    expect(f.parents.entity.find).toHaveBeenCalledTimes(2);
    expect(f.parents.story.find).not.toHaveBeenCalled();
    expect(f.parents.world.find).not.toHaveBeenCalled();
    expect(f.repo.list).toHaveBeenCalledWith(
      "owner",
      false,
      owner,
      q,
      expect.objectContaining({ kind: "entity", id, key: "lore-key" }),
    );
    f.parents.entity.find.mockRejectedValue(
      new ServiceError(404, {
        code: ApiErrorCode.NOT_FOUND,
        message: "Entity not found.",
      }),
    );
    const calls = f.repo.list.mock.calls.length;
    await expect(reader.listContext(q)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(f.repo.list.mock.calls.length).toBe(calls);
    await reader.listContext(
      LoreContextQuerySchema.parse({ story_id: storyId, world_id: worldId }),
    );
    expect(f.parents.story.find).toHaveBeenCalledWith(storyId);
    await reader.listContext(
      LoreContextQuerySchema.parse({ world_id: worldId }),
    );
    expect(f.parents.world.find).toHaveBeenCalledWith(worldId);
  });
  it("deduplicates public/owned rows before paginating context lanes", async () => {
    const f = fixture();
    f.repo.list.mockResolvedValue([{ ...row(), visibility: "public" }]);
    expect(
      (
        await f
          .reader()
          .listContext(LoreContextQuerySchema.parse({ world_id: worldId }))
      ).length,
    ).toBe(1);
    expect(
      await f
        .reader()
        .listContext(
          LoreContextQuerySchema.parse({ world_id: worldId, offset: 1 }),
        ),
    ).toEqual([]);
  });
  it("refreshes private sources on two instances without cross-owner shared invalidation", async () => {
    const f = fixture(),
      one = f.reader(),
      two = f.reader(owner, new ContentCacheService({ page: f.page }));
    await one.find(id);
    await two.find(id);
    await one.find(id);
    expect(f.repo.find).toHaveBeenCalledTimes(2);
    f.emit(other);
    await one.find(id);
    expect(f.repo.find).toHaveBeenCalledTimes(2);
    f.repo.find.mockResolvedValue({
      ...row(),
      fragment: { entry_text: "Updated" },
    });
    f.emit();
    expect((await one.find(id)).entry_text).toBe("Updated");
    expect((await two.find(id)).entry_text).toBe("Updated");
    expect(f.cache.stats().sharedCursor).toBe("0");
  });
  it("fetches fresh RLS tags on source/list hits and refuses relation failures", async () => {
    const f = fixture(),
      reader = f.reader(),
      tag = { id, tag_name: "BEFORE" };
    f.repo.tags.mockResolvedValue([{ asset_id: id, tag }]);
    expect((await reader.find(id)).tags).toEqual([tag]);
    f.repo.tags.mockResolvedValue([
      { asset_id: id, tag: { ...tag, tag_name: "AFTER" } },
    ]);
    expect((await reader.find(id)).tags).toEqual([
      { ...tag, tag_name: "AFTER" },
    ]);
    expect(f.repo.find).toHaveBeenCalledTimes(1);
    await reader.list(LoreReadQuerySchema.parse({}));
    f.repo.tags.mockResolvedValue([]);
    expect((await reader.list(LoreReadQuerySchema.parse({})))[0]?.tags).toEqual(
      [],
    );
    expect(f.repo.list).toHaveBeenCalledTimes(1);
    f.repo.tags.mockRejectedValue(new Error("secret"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(reader.find(id)).rejects.toMatchObject({ statusCode: 503 });
  });
  it("invalidates public pages/sources on visibility change and deletion", async () => {
    const f = fixture();
    f.repo.resolve.mockResolvedValue({ ...identity(), visibility: "public" });
    f.repo.find.mockResolvedValue({ ...row(), visibility: "public" });
    const reader = f.reader(other);
    await reader.find(id);
    f.repo.find.mockResolvedValue(null);
    f.emit(owner, false);
    await expect(reader.find(id)).rejects.toMatchObject({ statusCode: 404 });
  });
  it("masks malformed bodies/probe errors with safe typed 503", async () => {
    const f = fixture(),
      log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    f.repo.find.mockResolvedValue({ ...row(), fragment: "invalid" });
    await expect(f.reader().find(id)).rejects.toMatchObject({
      statusCode: 503,
    });
    const cache = new ContentCacheService({
      page: () => Promise.reject(new Error("secret")),
    });
    await expect(
      f.reader(owner, cache).list(LoreReadQuerySchema.parse({})),
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(log.mock.calls.flat().join()).not.toContain("secret");
  });
});
