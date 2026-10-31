import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import catalog from "../routes/catalog.js";
import worlds from "../routes/chimera-worlds.js";
import { WorldContentReadService } from "../services/content/world-content-read.service.js";
import * as clients from "../db/supabase-client.js";
import { authService } from "../services/auth/auth.service.js";
import { ServiceError } from "../utils/serviceError.js";
import {
  ApiErrorCode,
  ApiErrorResponseSchema,
  ApiSuccessResponseSchema,
} from "../../../shared/src/types/api.js";
const owner = "00000000-0000-4000-8000-000000000001";
const app = express();
app.use("/api/catalog", catalog);
app.use("/api/v2/chimera/worlds", worlds);
beforeEach(() => {
  vi.spyOn(authService, "validateToken").mockResolvedValue({
    valid: true,
    user: { id: owner, isGuest: false, roles: ["admin"] },
  });
  vi.spyOn(authService, "bootstrapProfile").mockResolvedValue(undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});
describe("world HTTP read boundary", () => {
  it("keeps public catalog requests anonymous even when carrying an admin bearer token", async () => {
    const validateToken = vi.mocked(vi.spyOn(authService, "validateToken"));
    const client = vi.spyOn(clients, "getChimeraSupabaseClient");
    const list = vi
      .spyOn(WorldContentReadService.prototype, "catalogList")
      .mockResolvedValue([]);
    const result = await request(app)
      .get("/api/catalog/worlds?search=forest&limit=5&offset=2")
      .set("Authorization", "Bearer admin-fixture");
    expect(result.status).toBe(200);
    expect(result.body as unknown).toMatchObject({
      ok: true,
      data: [],
    });
    expect(
      ApiSuccessResponseSchema.safeParse(result.body as unknown).success,
    ).toBe(true);
    expect(client.mock.calls).toEqual([[undefined]]);
    expect(list).toHaveBeenCalledWith({
      search: "forest",
      limit: 5,
      offset: 2,
    });
    expect(validateToken).not.toHaveBeenCalled();
  });
  it("passes only middleware-authenticated request context to protected owner reads", async () => {
    const client = vi.spyOn(clients, "getChimeraSupabaseClient");
    const list = vi
      .spyOn(WorldContentReadService.prototype, "list")
      .mockResolvedValue([]);
    const result = await request(app)
      .get(`/api/v2/chimera/worlds/my-creations?owner_user_id=foreign`)
      .set("Authorization", "Bearer owner-fixture");
    expect(result.status).toBe(200);
    expect(list).toHaveBeenCalledWith({ limit: 50, offset: 0 }, true);
    expect(client.mock.calls[0]?.[0]?.user?.id).toBe(owner);
    expect(
      (await request(app).get("/api/v2/chimera/worlds/selectable")).status,
    ).toBe(401);
  });
  it("routes public detail and protected detail/ruleset projections through their services", async () => {
    const publicFind = vi
      .spyOn(WorldContentReadService.prototype, "catalogFind")
      .mockResolvedValue({
        id: "sample",
        name: "World",
        slug: "sample",
        tagline: "",
        short_desc: "",
        hero_quote: "",
        status: "active",
        cover_media: null,
        created_at: "now",
        updated_at: "now",
      });
    expect((await request(app).get("/api/catalog/worlds/sample")).status).toBe(
      200,
    );
    expect(publicFind).toHaveBeenCalledWith("sample");
    const rulesets = vi
      .spyOn(WorldContentReadService.prototype, "rulesets")
      .mockResolvedValue([]);
    expect(
      (
        await request(app)
          .get(`/api/v2/chimera/worlds/${owner}/rulesets`)
          .set("Authorization", "Bearer fixture")
      ).status,
    ).toBe(200);
    expect(rulesets).toHaveBeenCalledWith(owner);
    vi.spyOn(WorldContentReadService.prototype, "find").mockRejectedValue(
      new ServiceError(404, {
        code: ApiErrorCode.NOT_FOUND,
        message: "World not found.",
      }),
    );
    expect(
      (
        await request(app)
          .get(`/api/v2/chimera/worlds/${owner}`)
          .set("Authorization", "Bearer fixture")
      ).status,
    ).toBe(404);
  });
  it.each(["/api/catalog/worlds", "/api/v2/chimera/worlds/selectable"])(
    "preserves typed unavailable responses at %s",
    async (path) => {
      vi.spyOn(
        WorldContentReadService.prototype,
        "catalogList",
      ).mockRejectedValue(
        new ServiceError(503, {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: "World content is temporarily unavailable.",
        }),
      );
      vi.spyOn(WorldContentReadService.prototype, "list").mockRejectedValue(
        new ServiceError(503, {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: "World content is temporarily unavailable.",
        }),
      );
      const result = await request(app)
        .get(path)
        .set("Authorization", "Bearer fixture");
      expect(result.status).toBe(503);
      expect(
        ApiErrorResponseSchema.safeParse(result.body as unknown).success,
      ).toBe(true);
      expect(result.text).not.toContain("stack");
    },
  );
  it.each([
    "/api/catalog/worlds?limit=51",
    "/api/v2/chimera/worlds/selectable?tag[]=bad",
    "/api/catalog/worlds/id,visibility.eq.private",
    "/api/v2/chimera/worlds/id,visibility.eq.private",
  ])("rejects malformed read input at %s", async (path) => {
    const result = await request(app)
      .get(path)
      .set("Authorization", "Bearer fixture");
    expect(result.status).toBe(422);
  });
  it.each(["/api/catalog/worlds", "/api/v2/chimera/worlds/selectable"])(
    "contains unexpected route errors at %s",
    async (path) => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(
        WorldContentReadService.prototype,
        "catalogList",
      ).mockRejectedValue(new Error("database secret"));
      vi.spyOn(WorldContentReadService.prototype, "list").mockRejectedValue(
        new Error("database secret"),
      );
      const result = await request(app)
        .get(path)
        .set("Authorization", "Bearer fixture");
      expect(result.status).toBe(503);
      expect(result.text).not.toContain("database secret");
    },
  );
});
