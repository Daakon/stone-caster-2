import { afterEach, describe, expect, it, vi } from "vitest";
import { NpcCatalogReadService } from "./npc-catalog-read.service.js";
import { mapEntityContentRow } from "./entity-content-read.service.js";
import { ContentCacheService } from "./content-cache.service.js";
import { NpcCatalogQuerySchema } from "../../../../shared/src/types/chimera-npc-catalog-read.js";
import type {
  EntityContentRow,
  EntityIdentity,
} from "../../db/repos/entity-content-read.repo.js";
import type { ContentChange } from "../../../../shared/src/types/chimera-content-changes.js";
const row = (): EntityContentRow => ({
  content_key: "guard",
  owner_namespace: "first_party",
  release_state: "published",
  created_at: "now",
  updated_at: "now",
  body: {
    entity_type: "NPC",
    world_key: "world",
    display_name: "Authored guard",
    raw_data: {
      description: "Authored description",
      role_tags: ["gate guard"],
      images: [{ id: "image", url: "/cover" }],
      portrait_url: "/portrait",
      archetype: "guide",
    },
  },
});
function fixture() {
  const events: ContentChange[] = [];
  const page = (after: string | null) =>
    Promise.resolve({
      shared: {
        generation: String(events.length),
        head_seq: String(events.length),
        retained_after_seq: "0",
        changes:
          after === null
            ? []
            : events.filter((e) => Number(e.seq) > Number(after)),
      },
      owners: [],
    });
  const cache = new ContentCacheService({ page });
  const repo = {
    list: vi
      .fn<
        [unknown, unknown],
        Promise<{ items: EntityContentRow[]; total: number }>
      >()
      .mockResolvedValue({ items: [row()], total: 1 }),
    worldKey: vi
      .fn<[string], Promise<string | null>>()
      .mockResolvedValue("world"),
    firstPartyAliases: vi
      .fn<[string[]], Promise<EntityIdentity[]>>()
      .mockResolvedValue([]),
  };
  const entities = {
    find: vi
      .fn<[string], Promise<ReturnType<typeof mapEntityContentRow>>>()
      .mockResolvedValue(mapEntityContentRow(row())),
  };
  const service = new NpcCatalogReadService(repo, entities, "trace", cache);
  const emit = (kind = "entity", namespace = "first_party", type = "NPC") =>
    events.push({
      seq: String(events.length + 1),
      generation: String(events.length + 1),
      kind,
      namespace,
      key: "guard",
      old_facets: { entity_type: type, world_key: "world" },
      new_facets: { entity_type: type, world_key: "other" },
    });
  return { repo, entities, service, cache, emit };
}
afterEach(() => {
  vi.restoreAllMocks();
});
describe("published NPC catalog/cache boundary", () => {
  it("projects authored fields without inventing name, status or character stats", async () => {
    const f = fixture(),
      query = NpcCatalogQuerySchema.parse({});
    const result = await f.service.list(query);
    expect(result).toMatchObject({
      total: 1,
      limit: 20,
      offset: 0,
      items: [
        {
          id: "guard",
          name: "Authored guard",
          worldId: "world",
          status: null,
          description: "Authored description",
          archetype: "guide",
          roleTags: ["gate guard"],
          portraitUrl: "/portrait",
          cover_media: { id: "image", provider_key: "/cover" },
        },
      ],
    });
    expect(result.items[0]?.doc).not.toHaveProperty("health");
    f.entities.find.mockResolvedValue(
      mapEntityContentRow({ ...row(), body: { entity_type: "NPC" } }),
    );
    expect(await f.service.find("empty")).toMatchObject({
      name: null,
      description: null,
      status: null,
      roleTags: [],
      cover_media: null,
    });
  });
  it("retains filtered total and page metadata even when the requested page is empty", async () => {
    const f = fixture();
    f.repo.list.mockResolvedValue({ items: [], total: 15 });
    expect(
      await f.service.list(NpcCatalogQuerySchema.parse({ offset: 20 })),
    ).toEqual({ items: [], total: 15, offset: 20, limit: 20 });
  });
  it("reuses hits, refreshes changed NPCs, and leaves unrelated entity types/kinds cached", async () => {
    const f = fixture(),
      q = NpcCatalogQuerySchema.parse({ world: "world" });
    await f.service.list(q);
    await f.service.list(q);
    expect(f.repo.list).toHaveBeenCalledTimes(1);
    f.emit("world");
    f.emit("entity", "first_party", "ITEM");
    await f.service.list(q);
    expect(f.repo.list).toHaveBeenCalledTimes(1);
    f.repo.list.mockResolvedValue({ items: [], total: 0 });
    f.emit();
    expect((await f.service.list(q)).items).toEqual([]);
    expect(f.repo.list).toHaveBeenCalledTimes(2);
  });
  it("keeps search, activity, page and resolved world variants separate", async () => {
    const f = fixture();
    for (const value of [
      {},
      { search: "guard" },
      { q: "gate" },
      { activeOnly: "1" },
      { offset: 2 },
      { world: "alias" },
    ])
      await f.service.list(NpcCatalogQuerySchema.parse(value));
    expect(f.repo.list).toHaveBeenCalledTimes(6);
    expect(f.repo.worldKey).toHaveBeenCalledWith("alias");
    f.repo.worldKey.mockResolvedValue("new-world");
    await f.service.list(NpcCatalogQuerySchema.parse({ world: "alias" }));
    expect(f.repo.list).toHaveBeenCalledTimes(7);
  });
  it("uses existing UUID aliases for canonical entries", async () => {
    const f = fixture();
    const id = "00000000-0000-4000-8000-000000000003";
    f.repo.firstPartyAliases.mockResolvedValue([
      {
        id,
        key: "guard",
        slug: "guard",
        content_key: "guard",
        owner_kind: "first_party",
        owner_namespace: "first_party",
        owner_user_id: null,
        visibility: "public",
      },
    ]);
    expect(
      (await f.service.list(NpcCatalogQuerySchema.parse({}))).items[0]?.id,
    ).toBe(id);
  });
  it("refuses non-NPC details and propagates authorized detail failures", async () => {
    const f = fixture();
    f.entities.find.mockResolvedValue(
      mapEntityContentRow({ ...row(), body: { entity_type: "ITEM" } }),
    );
    await expect(f.service.find("item")).rejects.toMatchObject({
      statusCode: 404,
    });
    f.entities.find.mockRejectedValue(new Error("secret"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(f.service.find("failure")).rejects.toMatchObject({
      statusCode: 503,
    });
  });
  it("fails closed and logs only safe metadata on source/cache errors", async () => {
    const f = fixture(),
      log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    f.repo.list.mockRejectedValue(new Error("secret"));
    await expect(
      f.service.list(NpcCatalogQuerySchema.parse({})),
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(log.mock.calls.flat().join()).not.toContain("secret");
    const unavailable = new ContentCacheService({
      page: () => Promise.reject(new Error("secret")),
    });
    await expect(
      new NpcCatalogReadService(f.repo, f.entities, "probe", unavailable).list(
        NpcCatalogQuerySchema.parse({}),
      ),
    ).rejects.toMatchObject({ statusCode: 503 });
  });
});
