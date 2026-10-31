import { describe, it, expect, vi } from "vitest";
import { CachedContentCatalogService } from "./cached-content-catalog.service.js";
import { ContentCacheService } from "./content-cache.service.js";
const ref = {
  kind: "world" as const,
  owner_namespace: "first_party",
  key: "sample-world",
};
describe("authorization before internal content cache hits", () => {
  it("shares authorized first-party bodies between requests while checking each request audience", async () => {
    const cache = new ContentCacheService({
      page: vi.fn().mockResolvedValue({
        shared: {
          generation: "0",
          head_seq: "0",
          retained_after_seq: "0",
          changes: [],
        },
        owners: [],
      }),
    });
    const repo = {
      getGeneration: vi.fn().mockResolvedValue(1),
      find: vi.fn().mockResolvedValue({ body: { secret: "internal" } }),
      cacheAudience: vi.fn().mockResolvedValue(true),
    };
    const first = new CachedContentCatalogService(repo, "one", () => cache);
    const second = new CachedContentCatalogService(repo, "two", () => cache);
    expect(await first.getGeneration()).toBe(1);
    expect(await first.find(ref)).toEqual({ body: { secret: "internal" } });
    expect(await first.find(ref)).toEqual({ body: { secret: "internal" } });
    expect(await second.find(ref)).toEqual({ body: { secret: "internal" } });
    expect(repo.find).toHaveBeenCalledOnce();
    expect(repo.cacheAudience).toHaveBeenCalledTimes(2);
  });
  it("never gives a player an internal cache hit and leaves its source lookup under RLS", async () => {
    const cache = vi.fn();
    const repo = {
      getGeneration: vi.fn(),
      find: vi.fn().mockResolvedValue(null),
      cacheAudience: vi.fn().mockResolvedValue(false),
    };
    expect(
      await new CachedContentCatalogService(repo, "player", cache).find(ref),
    ).toBeNull();
    expect(cache).not.toHaveBeenCalled();
    expect(repo.find).toHaveBeenCalledWith(ref);
  });
  it("keeps non-first-party refs on their authenticated repository", async () => {
    const cache = vi.fn();
    const repo = {
      getGeneration: vi.fn(),
      find: vi.fn().mockResolvedValue(null),
      cacheAudience: vi.fn().mockResolvedValue(true),
    };
    await new CachedContentCatalogService(repo, "owner", cache).find({
      ...ref,
      owner_namespace: "00000000-0000-4000-8000-000000000001",
    });
    expect(cache).not.toHaveBeenCalled();
    expect(repo.find).toHaveBeenCalledOnce();
  });
  it("fails closed without a verified audience instead of defaulting to admin", async () => {
    const cache = vi.fn();
    const repo = {
      getGeneration: vi.fn(),
      find: vi.fn(),
      cacheAudience: vi.fn().mockResolvedValue(undefined),
    };
    await expect(
      new CachedContentCatalogService(repo, "trace", cache).find(ref),
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(repo.find).not.toHaveBeenCalled();
    expect(cache).not.toHaveBeenCalled();
  });
});
