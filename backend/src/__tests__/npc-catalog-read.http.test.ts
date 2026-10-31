import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import catalog from "../routes/catalog.js";
import { NpcCatalogReadService } from "../services/content/npc-catalog-read.service.js";
import * as clients from "../db/supabase-client.js";
import { ServiceError } from "../utils/serviceError.js";
import {
  ApiErrorCode,
  ApiErrorResponseSchema,
  ApiSuccessResponseSchema,
} from "../../../shared/src/types/api.js";
const app = express();
app.use("/api/catalog", catalog);
afterEach(() => {
  vi.restoreAllMocks();
});
describe("public NPC HTTP boundary", () => {
  it("returns detail through the normal success envelope", async () => {
    vi.spyOn(NpcCatalogReadService.prototype, "find").mockResolvedValue({
      id: "guard",
      name: "Authored guard",
      slug: "guard",
      description: null,
      worldId: null,
      status: null,
      visibility: "public",
      archetype: null,
      roleTags: [],
      portraitUrl: null,
      cover_media: null,
      doc: {},
      createdAt: "now",
      updatedAt: "now",
    });
    const result = await request(app).get("/api/catalog/npcs/guard");
    expect(result.status).toBe(200);
    expect(
      ApiSuccessResponseSchema.safeParse(result.body as unknown).success,
    ).toBe(true);
  });
  it("keeps an admin bearer token outside the published catalog audience", async () => {
    const client = vi.spyOn(clients, "getChimeraSupabaseClient"),
      list = vi
        .spyOn(NpcCatalogReadService.prototype, "list")
        .mockResolvedValue({ items: [], total: 0, limit: 2, offset: 1 });
    const result = await request(app)
      .get(
        "/api/catalog/npcs?q=guard&world=mystika&activeOnly=1&limit=2&offset=1",
      )
      .set("Authorization", "Bearer admin-fixture");
    expect(result.status).toBe(200);
    expect(
      ApiSuccessResponseSchema.safeParse(result.body as unknown).success,
    ).toBe(true);
    expect(list).toHaveBeenCalledWith({
      q: "guard",
      world: "mystika",
      activeOnly: true,
      limit: 2,
      offset: 1,
    });
    expect(client.mock.calls.length).toBeGreaterThan(0);
    expect(client.mock.calls.every((c) => c[0] === undefined)).toBe(true);
  });
  it.each([
    "?limit=0",
    "?offset=-1",
    "?world=a,b",
    "?q=" + "x".repeat(101),
    "?activeOnly=yes",
    "/bad,id",
  ])("rejects unsafe requests %s", async (suffix) => {
    const list = vi.spyOn(NpcCatalogReadService.prototype, "list"),
      find = vi.spyOn(NpcCatalogReadService.prototype, "find");
    const result = await request(app).get("/api/catalog/npcs" + suffix);
    expect(result.status).toBe(422);
    expect(
      ApiErrorResponseSchema.safeParse(result.body as unknown).success,
    ).toBe(true);
    expect(list).not.toHaveBeenCalled();
    expect(find).not.toHaveBeenCalled();
  });
  it("passes stable-key/UUID details and preserves safe missing errors", async () => {
    const find = vi
      .spyOn(NpcCatalogReadService.prototype, "find")
      .mockRejectedValue(
        new ServiceError(404, {
          code: ApiErrorCode.NOT_FOUND,
          message: "NPC not found.",
        }),
      );
    for (const id of ["guard", "00000000-0000-4000-8000-000000000001"]) {
      expect((await request(app).get("/api/catalog/npcs/" + id)).status).toBe(
        404,
      );
      expect(find).toHaveBeenCalledWith(id);
    }
  });
  it("returns typed 503 and masks unexpected errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(NpcCatalogReadService.prototype, "list").mockRejectedValue(
      new Error("secret"),
    );
    vi.spyOn(NpcCatalogReadService.prototype, "find").mockRejectedValue(
      new ServiceError(503, {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: "NPC content is temporarily unavailable.",
      }),
    );
    for (const path of ["/api/catalog/npcs", "/api/catalog/npcs/guard"]) {
      const result = await request(app).get(path);
      expect(result.status).toBe(503);
      expect(JSON.stringify(result.body)).not.toContain("secret");
      expect(
        ApiErrorResponseSchema.safeParse(result.body as unknown).success,
      ).toBe(true);
    }
    expect(log.mock.calls.flat().join()).not.toContain("secret");
  });
});
