import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import lore from "../routes/chimera-lore.js";
import { LoreContentReadService } from "../services/content/lore-content-read.service.js";
import { authService } from "../services/auth/auth.service.js";
import * as clients from "../db/supabase-client.js";
import { ServiceError } from "../utils/serviceError.js";
import {
  ApiErrorCode,
  ApiErrorResponseSchema,
  ApiSuccessResponseSchema,
} from "../../../shared/src/types/api.js";
const owner = "00000000-0000-4000-8000-000000000001";
const app = express();
app.use("/api/v2/chimera/lore", lore);
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
describe("lore HTTP read boundary", () => {
  it("uses middleware-owned identity and request RLS on the bounded owned list", async () => {
    const client = vi.spyOn(clients, "getChimeraSupabaseClient"),
      list = vi
        .spyOn(LoreContentReadService.prototype, "list")
        .mockResolvedValue([]);
    const response = await request(app)
      .get(
        "/api/v2/chimera/lore/my-creations?owner_user_id=foreign&limit=2&offset=1",
      )
      .set("Authorization", "Bearer fixture");
    expect(response.status).toBe(200);
    expect(
      ApiSuccessResponseSchema.safeParse(response.body as unknown).success,
    ).toBe(true);
    expect(list).toHaveBeenCalledWith({ limit: 2, offset: 1 });
    expect(client.mock.calls[0]?.[0]?.user?.id).toBe(owner);
  });
  it.each(["/my-creations", "/canonical", "?world_id=world"])(
    "requires authentication %s",
    async (path) => {
      const list = vi.spyOn(LoreContentReadService.prototype, "list"),
        find = vi.spyOn(LoreContentReadService.prototype, "find"),
        context = vi.spyOn(LoreContentReadService.prototype, "listContext");
      expect(
        (await request(app).get("/api/v2/chimera/lore" + path)).status,
      ).toBe(401);
      expect(list).not.toHaveBeenCalled();
      expect(find).not.toHaveBeenCalled();
      expect(context).not.toHaveBeenCalled();
    },
  );
  it("accepts canonical keys for world/entity context and preserves priority inputs", async () => {
    const context = vi
      .spyOn(LoreContentReadService.prototype, "listContext")
      .mockResolvedValue([]);
    expect(
      (
        await request(app)
          .get("/api/v2/chimera/lore?entity_id=entity&world_id=world")
          .set("Authorization", "Bearer fixture")
      ).status,
    ).toBe(200);
    expect(context).toHaveBeenCalledWith({
      entity_id: "entity",
      world_id: "world",
      limit: 50,
      offset: 0,
    });
  });
  it.each([
    "?limit=0",
    "?world_id=bad,id",
    "?story_id=key",
    "/bad,id",
    "/my-creations?offset=1001",
    "",
  ])("rejects unsafe or missing inputs %s", async (suffix) => {
    const methods = [
      vi.spyOn(LoreContentReadService.prototype, "list"),
      vi.spyOn(LoreContentReadService.prototype, "find"),
      vi.spyOn(LoreContentReadService.prototype, "listContext"),
    ];
    const response = await request(app)
      .get("/api/v2/chimera/lore" + suffix)
      .set("Authorization", "Bearer fixture");
    expect(response.status).toBe(422);
    expect(
      ApiErrorResponseSchema.safeParse(response.body as unknown).success,
    ).toBe(true);
    for (const m of methods) expect(m).not.toHaveBeenCalled();
  });
  it("passes stable keys and UUID details through a non-disclosing 404 envelope", async () => {
    const find = vi
      .spyOn(LoreContentReadService.prototype, "find")
      .mockRejectedValue(
        new ServiceError(404, {
          code: ApiErrorCode.NOT_FOUND,
          message: "Lore entry not found.",
        }),
      );
    for (const id of ["canonical", owner]) {
      const response = await request(app)
        .get("/api/v2/chimera/lore/" + id)
        .set("Authorization", "Bearer fixture");
      expect(response.status).toBe(404);
      expect(find).toHaveBeenCalledWith(id);
      expect(
        ApiErrorResponseSchema.safeParse(response.body as unknown).success,
      ).toBe(true);
    }
  });
  it("masks unexpected read failures and preserves typed unavailable errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(LoreContentReadService.prototype, "list").mockRejectedValue(
      new Error("secret"),
    );
    vi.spyOn(LoreContentReadService.prototype, "listContext").mockRejectedValue(
      new ServiceError(503, {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: "Lore content is temporarily unavailable.",
      }),
    );
    for (const path of ["/my-creations", "?world_id=world"]) {
      const response = await request(app)
        .get("/api/v2/chimera/lore" + path)
        .set("Authorization", "Bearer fixture");
      expect(response.status).toBe(503);
      expect(JSON.stringify(response.body)).not.toContain("secret");
    }
    expect(log.mock.calls.flat().join()).not.toContain("secret");
  });
});
