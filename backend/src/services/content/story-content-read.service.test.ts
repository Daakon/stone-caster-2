import { afterEach, describe, expect, it, vi } from "vitest";
import { StoryContentReadService } from "./story-content-read.service.js";
import { ContentCacheService } from "./content-cache.service.js";
import { ServiceError } from "../../utils/serviceError.js";
import { ApiErrorCode } from "../../../../shared/src/types/api.js";
import {
  StoryReadQuerySchema,
  type StorySourceRead,
  type StoryReadQuery,
} from "../../../../shared/src/types/chimera-story-read.js";
import type { StoryIdentity } from "../../db/repos/story-content-read.repo.js";
import type { WorldRead } from "../../../../shared/src/types/chimera-world-read.js";
import type {
  ContentChange,
  ContentOwnerCursor,
} from "../../../../shared/src/types/chimera-content-changes.js";
import {
  storyFixture,
  storyWorldFixture,
  storyOwner as owner,
  storyOther as other,
  storyId as id,
  storyWorldId as worldId,
} from "../../__tests__/fixtures/story-read.js";
const params = StoryReadQuerySchema.parse({});
const identity = (): StoryIdentity => ({ ...storyFixture() });
const unavailable = (status = 404) =>
  new ServiceError(status, {
    code: status === 404 ? ApiErrorCode.NOT_FOUND : ApiErrorCode.INTERNAL_ERROR,
    message: "Unavailable",
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
    resolve: vi
      .fn<[string], Promise<StoryIdentity | null>>()
      .mockResolvedValue(identity()),
    find: vi
      .fn<[string, string, string | null], Promise<StorySourceRead | null>>()
      .mockResolvedValue(storyFixture()),
    list: vi
      .fn<[string | null, StoryReadQuery], Promise<StorySourceRead[]>>()
      .mockResolvedValue([storyFixture()]),
  };
  const worlds = {
    find: vi
      .fn<[string], Promise<WorldRead>>()
      .mockResolvedValue(storyWorldFixture()),
  };
  const emit = (
    privateOnly: boolean,
    oldVisibility = "private",
    newVisibility = "private",
  ) => {
    const events = privateOnly ? (privateEvents.get(owner) ?? []) : shared;
    events.push({
      seq: String(events.length + 1),
      generation: String(events.length + 1),
      kind: "story",
      namespace: owner,
      key: "story-key",
      old_facets: { visibility: oldVisibility },
      new_facets: { visibility: newVisibility },
    });
    if (privateOnly) privateEvents.set(owner, events);
  };
  return { repo, worlds, cache, page, emit };
}
afterEach(() => {
  vi.restoreAllMocks();
});
describe("story read authorization and world dependency boundaries", () => {
  it("denies foreign private IDs before reading bodies or worlds", async () => {
    const f = fixture();
    await expect(
      new StoryContentReadService(
        f.repo,
        f.worlds,
        other,
        "foreign",
        f.cache,
      ).find(id),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(f.repo.find).not.toHaveBeenCalled();
    expect(f.worlds.find).not.toHaveBeenCalled();
    f.repo.resolve.mockResolvedValue(null);
    await expect(
      new StoryContentReadService(
        f.repo,
        f.worlds,
        owner,
        "missing",
        f.cache,
      ).find(id),
    ).rejects.toMatchObject({ statusCode: 404 });
    f.repo.resolve.mockResolvedValue({
      ...identity(),
      owner_kind: "first_party",
      owner_namespace: "first_party",
      owner_user_id: null,
    });
    await expect(
      new StoryContentReadService(
        f.repo,
        f.worlds,
        owner,
        "first",
        f.cache,
      ).find(id),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
  it("rechecks world edits, visibility and deletion without reloading the story body", async () => {
    const f = fixture(),
      reader = new StoryContentReadService(
        f.repo,
        f.worlds,
        owner,
        "owner",
        f.cache,
      );
    expect((await reader.find(id)).world?.name).toBe("Authored world");
    expect(f.worlds.find).toHaveBeenCalledWith(worldId);
    f.worlds.find.mockResolvedValue({
      ...storyWorldFixture(),
      name: "Updated world",
    });
    expect((await reader.find(id)).world?.name).toBe("Updated world");
    f.worlds.find.mockRejectedValue(unavailable());
    expect((await reader.find(id)).world).toBeNull();
    expect(f.repo.find).toHaveBeenCalledOnce();
    f.worlds.find.mockRejectedValue(unavailable(503));
    await expect(reader.find(id)).rejects.toMatchObject({ statusCode: 503 });
  });
  it("replays private edits on two independent owner caches", async () => {
    const f = fixture(),
      second = new ContentCacheService({ page: f.page }),
      a = new StoryContentReadService(f.repo, f.worlds, owner, "a", f.cache),
      b = new StoryContentReadService(f.repo, f.worlds, owner, "b", second);
    await a.find(id);
    await b.find(id);
    f.repo.find.mockResolvedValue({
      ...storyFixture(),
      display_name: "Edited",
    });
    f.emit(true);
    expect((await a.find(id)).display_name).toBe("Edited");
    expect((await b.find(id)).display_name).toBe("Edited");
    expect(f.cache.stats().sharedCursor).toBe("0");
  });
  it("isolates owner listing pages, deduplicates world loads per response and allows read-only drafts", async () => {
    const f = fixture();
    f.repo.list.mockImplementation((user) =>
      Promise.resolve([
        { ...storyFixture(user ?? owner) },
        { ...storyFixture(user ?? owner), id: other },
      ]),
    );
    const a = new StoryContentReadService(
      f.repo,
      f.worlds,
      owner,
      "a",
      f.cache,
    );
    expect((await a.list(params)).map((s) => s.world?.name)).toEqual([
      "Authored world",
      "Authored world",
    ]);
    expect(f.worlds.find).toHaveBeenCalledOnce();
    expect(
      (
        await new StoryContentReadService(
          f.repo,
          f.worlds,
          other,
          "b",
          f.cache,
        ).list(params)
      )[0]?.owner_user_id,
    ).toBe(other);
    expect(f.repo.list).toHaveBeenCalledTimes(2);
    await expect(
      new StoryContentReadService(f.repo, f.worlds, null, "anon", f.cache).list(
        params,
      ),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
  it("omits absent/redacted worlds and never invents an Untitled World", async () => {
    const f = fixture();
    f.repo.list.mockResolvedValue([
      { ...storyFixture(), world_id: null },
      storyFixture(),
    ]);
    f.worlds.find.mockRejectedValue(unavailable());
    expect(
      (
        await new StoryContentReadService(
          f.repo,
          f.worlds,
          owner,
          "list",
          f.cache,
        ).list(params)
      ).map((s) => s.world),
    ).toEqual([null, null]);
  });
  it("refreshes listing pages after private edits", async () => {
    const f = fixture(),
      reader = new StoryContentReadService(
        f.repo,
        f.worlds,
        owner,
        "list",
        f.cache,
      );
    await reader.list(params);
    await reader.list({ ...params, offset: 1 });
    f.repo.list.mockResolvedValue([]);
    f.emit(true);
    expect(await reader.list(params)).toEqual([]);
    expect(await reader.list({ ...params, offset: 1 })).toEqual([]);
  });
  it("requires public visibility and committed compilation in catalog list/detail", async () => {
    const f = fixture(),
      pub = {
        ...storyFixture(),
        visibility: "public",
        status: "compiled",
        current_compiled_id: id,
      };
    f.repo.list.mockResolvedValue([
      storyFixture(),
      { ...pub, current_compiled_id: null },
      { ...pub, status: "draft" },
      pub,
    ]);
    f.repo.resolve.mockResolvedValue({ ...identity(), visibility: "public" });
    f.repo.find.mockResolvedValue(pub);
    f.worlds.find.mockRejectedValue(unavailable());
    const reader = new StoryContentReadService(
      f.repo,
      f.worlds,
      null,
      "catalog",
      f.cache,
    );
    const rows = await reader.catalogList(params);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "Authored story",
      description: null,
      is_playable: true,
      has_prompt: false,
      world_name: null,
      rulesets: ["declared-rules"],
    });
    expect(rows[0]).not.toHaveProperty("story_definition");
    expect((await reader.catalogFind(id)).world_name).toBeNull();
    const fresh = fixture();
    fresh.repo.find.mockResolvedValue({ ...pub, status: "draft" });
    fresh.repo.resolve.mockResolvedValue({
      ...identity(),
      visibility: "public",
    });
    await expect(
      new StoryContentReadService(
        fresh.repo,
        fresh.worlds,
        null,
        "draft",
        fresh.cache,
      ).catalogFind(id),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      new StoryContentReadService(
        f.repo,
        f.worlds,
        owner,
        "owner",
        f.cache,
      ).catalogFind(id),
    ).resolves.toHaveProperty("is_playable", true);
    const privateCase = fixture();
    await expect(
      new StoryContentReadService(
        privateCase.repo,
        privateCase.worlds,
        owner,
        "mine",
        privateCase.cache,
      ).catalogFind(id),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
  it("projects only actual public media, prompt and authorized world summaries", async () => {
    const f = fixture();
    f.repo.resolve.mockResolvedValue({ ...identity(), visibility: "public" });
    f.repo.find.mockResolvedValue({
      ...storyFixture(),
      visibility: "public",
      status: "bound",
      current_compiled_id: id,
      title: "Title",
      description: "Description",
      opening_text: "Authored opening",
      image_url: "/image",
      configuration: null,
    });
    expect(
      await new StoryContentReadService(
        f.repo,
        f.worlds,
        null,
        "catalog",
        f.cache,
      ).catalogFind(id),
    ).toMatchObject({
      title: "Title",
      description: "Description",
      has_prompt: true,
      cover_media: { url: "/image" },
      rulesets: [],
      world_name: "Authored world",
      world_slug: "world",
    });
  });
  it("handles public/private transitions and deleted sources across caches", async () => {
    const f = fixture();
    f.repo.resolve.mockResolvedValue({ ...identity(), visibility: "public" });
    f.repo.find.mockResolvedValue({ ...storyFixture(), visibility: "public" });
    const mine = new StoryContentReadService(
        f.repo,
        f.worlds,
        owner,
        "mine",
        f.cache,
      ),
      foreign = new StoryContentReadService(
        f.repo,
        f.worlds,
        other,
        "foreign",
        f.cache,
      );
    await mine.find(id);
    await foreign.find(id);
    f.repo.resolve.mockResolvedValue(identity());
    f.repo.find.mockResolvedValue(storyFixture());
    f.emit(false, "public", "private");
    await expect(foreign.find(id)).rejects.toMatchObject({ statusCode: 404 });
    expect((await mine.find(id)).visibility).toBe("private");
    f.repo.resolve.mockResolvedValue({ ...identity(), visibility: "public" });
    f.repo.find.mockResolvedValue({ ...storyFixture(), visibility: "public" });
    f.emit(false, "private", "public");
    await foreign.find(id);
    f.repo.find.mockResolvedValue(null);
    f.emit(false, "public", "public");
    await expect(foreign.find(id)).rejects.toMatchObject({ statusCode: 404 });
  });
  it("fails closed and logs trace-only failures for body, identity and world errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined),
      f = fixture();
    f.repo.resolve.mockRejectedValue(new Error("secret"));
    await expect(
      new StoryContentReadService(
        f.repo,
        f.worlds,
        owner,
        "trace",
        f.cache,
      ).find(id),
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(log.mock.calls.flat().join()).toContain("trace");
    expect(log.mock.calls.flat().join()).not.toContain("secret");
    f.repo.resolve.mockResolvedValue(identity());
    f.worlds.find.mockRejectedValue(new Error("private world"));
    await expect(
      new StoryContentReadService(
        f.repo,
        f.worlds,
        owner,
        "world",
        f.cache,
      ).find(id),
    ).rejects.toMatchObject({ statusCode: 503 });
    const broken = { read: vi.fn().mockRejectedValue(unavailable(503)) };
    await expect(
      new StoryContentReadService(
        f.repo,
        f.worlds,
        owner,
        "cache",
        broken,
      ).list(params),
    ).rejects.toMatchObject({ statusCode: 503 });
  });
});
