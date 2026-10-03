import express from "express";
import request from "supertest";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import router from "../routes/health.js";
import { ContentFormatService } from "../services/content/content-format.service.js";
import { ContentFormatRepository } from "../db/repos/content-format.repo.js";
import { ApiErrorResponseSchema } from "../../../shared/src/types/api.js";
const metadata = {
  catalog_generation: "15",
  source_min: 1,
  source_max: 1,
  blob_min: 1,
  blob_max: 1,
};
const actualFactory =
  ContentFormatService.forRequest.bind(ContentFormatService);
describe("content readiness HTTP contract", () => {
  const app = express();
  app.use("/api/health", router);
  const repo = { inventory: vi.fn() };
  beforeEach(() => {
    repo.inventory.mockReset().mockResolvedValue(metadata);
    vi.spyOn(ContentFormatService, "forRequest").mockReturnValue(
      new ContentFormatService(repo),
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("returns an anonymous, uncached success envelope without content metadata", async () => {
    const result = await request(app).get("/api/health/ready");
    expect(result.status).toBe(200);
    expect(result.headers["cache-control"] as unknown).toBe("no-store");
    expect(result.body as unknown).toMatchObject({
      ok: true,
      data: { status: "ready", checks: { db: true, contentFormats: true } },
    });
    expect(result.text).not.toContain("catalog_generation");
    expect(result.text).not.toContain("source_min");
  });
  it("rejects unsupported frozen content with safe checks in the error envelope", async () => {
    repo.inventory.mockResolvedValueOnce({ ...metadata, blob_max: 2 });
    const result = await request(app).get("/api/health/ready");
    expect(result.status).toBe(503);
    expect(result.headers["cache-control"] as unknown).toBe("no-store");
    expect(result.body as unknown).toMatchObject({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        details: {
          status: "not_ready",
          checks: { db: true, contentFormats: false },
        },
      },
    });
  });
  it("rejects a missing database contract without exposing the cause", async () => {
    repo.inventory.mockRejectedValueOnce(
      new Error("private connection detail"),
    );
    const result = await request(app).get("/api/health/ready");
    expect(result.status).toBe(503);
    expect(result.body as unknown).toMatchObject({
      ok: false,
      error: { details: { checks: { db: false, contentFormats: false } } },
    });
    expect(result.text).not.toContain("private");
  });
  it("returns a sanitized 503 if construction fails", async () => {
    vi.spyOn(ContentFormatService, "forRequest").mockImplementationOnce(() => {
      throw new Error("private");
    });
    const result = await request(app).get("/api/health/ready");
    expect(result.status).toBe(503);
    expect(result.text).not.toContain("private");
  });
  it("keeps process liveness independent of content availability", async () => {
    const result = await request(app).get("/api/health/live");
    expect(result.status).toBe(200);
    expect(result.body as unknown).toMatchObject({ ok: true, status: "alive" });
    expect(repo.inventory).not.toHaveBeenCalled();
  });
  it("correlates the real service error log with the response trace", async () => {
    vi.spyOn(ContentFormatService, "forRequest").mockImplementationOnce(
      actualFactory,
    );
    const probe = vi
      .spyOn(ContentFormatRepository.prototype, "inventory")
      .mockRejectedValue(new Error("private"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await request(app)
      .get("/api/health/ready")
      .set("X-Trace-Id", "invalid");
    const body = ApiErrorResponseSchema.parse(result.body as unknown);
    expect(result.status).toBe(503);
    expect(probe).toHaveBeenCalledOnce();
    expect(result.headers["x-trace-id"] as unknown).toBe(body.meta.traceId);
    expect(log).toHaveBeenCalledWith(
      JSON.stringify({
        level: "error",
        event: "content_readiness_unavailable",
        traceId: body.meta.traceId,
      }),
    );
  });
});
