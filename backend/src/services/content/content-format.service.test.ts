import { describe, it, expect, vi } from "vitest";
import { ContentFormatService } from "./content-format.service.js";
const inventory = {
  catalog_generation: "15",
  source_min: 1,
  source_max: 1,
  blob_min: 1,
  blob_max: 1,
};

describe("content format readiness", () => {
  it("accepts actual v1 metadata without legacy cache warming", async () => {
    const repo = { inventory: vi.fn().mockResolvedValue(inventory) };
    expect(await new ContentFormatService(repo).readiness()).toMatchObject({
      status: "ready",
      checks: { db: true, contentFormats: true },
    });
  });
  it("accepts an explicitly empty catalog with a real generation", async () => {
    expect(
      await new ContentFormatService({
        inventory: vi.fn().mockResolvedValue({
          catalog_generation: "0",
          source_min: null,
          source_max: null,
          blob_min: null,
          blob_max: null,
        }),
      }).readiness(),
    ).toMatchObject({ status: "ready" });
  });
  it.each(["source_max", "blob_max"])(
    "refuses unsupported %s, including retained frozen blobs",
    async (key) => {
      await expect(
        new ContentFormatService({
          inventory: vi.fn().mockResolvedValue({ ...inventory, [key]: 2 }),
        }).readiness(),
      ).rejects.toMatchObject({
        statusCode: 503,
        error: {
          details: {
            status: "not_ready",
            checks: { db: true, contentFormats: false },
          },
        },
      });
    },
  );
  it.each([
    null,
    { ...inventory, catalog_generation: null },
    { ...inventory, catalog_generation: "9223372036854775808" },
    { ...inventory, catalog_generation: "-1" },
    { ...inventory, source_max: null },
    { ...inventory, source_min: 2 },
    { ...inventory, blob_min: 0 },
    { ...inventory, body: { secret: true } },
  ])(
    "fails closed for an invalid or missing metadata contract",
    async (metadata) => {
      await expect(
        new ContentFormatService({
          inventory: vi.fn().mockResolvedValue(metadata),
        }).readiness(),
      ).rejects.toMatchObject({
        statusCode: 503,
        error: { details: { checks: { db: false, contentFormats: false } } },
      });
    },
  );
  it("does not reuse a previous success after content changes or a DB outage", async () => {
    const repo = {
      inventory: vi
        .fn()
        .mockResolvedValueOnce(inventory)
        .mockResolvedValueOnce({ ...inventory, blob_max: 2 })
        .mockRejectedValueOnce(new Error("postgres://user:secret@private")),
    };
    const service = new ContentFormatService(repo, "probe-trace");
    await service.readiness();
    await expect(service.readiness()).rejects.toMatchObject({
      statusCode: 503,
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(service.readiness()).rejects.toThrow(
        "Content readiness is unavailable.",
      );
      expect(log).toHaveBeenCalledWith(
        JSON.stringify({
          level: "error",
          event: "content_readiness_unavailable",
          traceId: "probe-trace",
        }),
      );
      expect(repo.inventory).toHaveBeenCalledTimes(3);
    } finally {
      log.mockRestore();
    }
  });
});
