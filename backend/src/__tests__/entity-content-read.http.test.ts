import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import entities from "../routes/chimera-entities.js";
import { EntityContentReadService } from "../services/content/entity-content-read.service.js";
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
app.use("/api/v2/chimera/entities", entities);
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
describe("entity HTTP read boundary", () => {
  it.each([
    ["selectable", "library"],
    ["my-creations", "owned"],
    ["", "rawOwned"],
  ])(
    "routes %s with middleware-owned identity and bounded input",
    async (path, mode) => {
      const client = vi.spyOn(clients, "getChimeraSupabaseClient");
      const list = vi
        .spyOn(EntityContentReadService.prototype, "list")
        .mockResolvedValue([]);
      const result = await request(app)
        .get(
          `/api/v2/chimera/entities/${path}?owner_user_id=foreign&limit=2&offset=3&world_id=mystika`,
        )
        .set("Authorization", "Bearer fixture");
      expect(result.status).toBe(200);
      expect(
        ApiSuccessResponseSchema.safeParse(result.body as unknown).success,
      ).toBe(true);
      expect(list).toHaveBeenCalledWith(
        { limit: 2, offset: 3, world_id: "mystika" },
        ...(mode === "library" ? [] : [mode]),
      );
      expect(client.mock.calls[0]?.[0]?.user?.id).toBe(owner);
    },
  );
  it("requires auth for list/detail endpoints", async () => {
    expect(
      (await request(app).get("/api/v2/chimera/entities/selectable")).status,
    ).toBe(401);
    expect(
      (await request(app).get("/api/v2/chimera/entities/sample")).status,
    ).toBe(401);
  });
  it.each(["sample", owner])(
    "accepts canonical keys and UUIDs for detail: %s",
    async (id) => {
      const find = vi
        .spyOn(EntityContentReadService.prototype, "find")
        .mockRejectedValue(
          new ServiceError(404, {
            code: ApiErrorCode.NOT_FOUND,
            message: "Entity not found.",
          }),
        );
      const result = await request(app)
        .get(`/api/v2/chimera/entities/${id}`)
        .set("Authorization", "Bearer fixture");
      expect(result.status).toBe(404);
      expect(find).toHaveBeenCalledWith(id);
      expect(
        ApiErrorResponseSchema.safeParse(result.body as unknown).success,
      ).toBe(true);
    },
  );
  it.each([
    "selectable?limit=51",
    "my-creations?offset=1001",
    "selectable?world_id=bad,(id)",
    "bad,id",
  ])("rejects unsafe or unbounded input: %s", async (path) => {
    const list = vi.spyOn(EntityContentReadService.prototype, "list");
    const find = vi.spyOn(EntityContentReadService.prototype, "find");
    const result = await request(app)
      .get(`/api/v2/chimera/entities/${path}`)
      .set("Authorization", "Bearer fixture");
    expect(result.status).toBe(422);
    expect(list).not.toHaveBeenCalled();
    expect(find).not.toHaveBeenCalled();
  });
  it("preserves typed 503 envelopes and masks unexpected exceptions", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const list = vi
      .spyOn(EntityContentReadService.prototype, "list")
      .mockRejectedValue(
        new ServiceError(503, {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: "Entity content is temporarily unavailable.",
        }),
      );
    const result = await request(app)
      .get("/api/v2/chimera/entities/selectable")
      .set("Authorization", "Bearer fixture");
    expect(result.status).toBe(503);
    expect(
      ApiErrorResponseSchema.safeParse(result.body as unknown).success,
    ).toBe(true);
    list.mockRejectedValue(new Error("secret db error"));
    const unexpected = await request(app)
      .get("/api/v2/chimera/entities/selectable")
      .set("Authorization", "Bearer fixture");
    expect(unexpected.status).toBe(503);
    expect(JSON.stringify(unexpected.body)).not.toContain("secret");
    expect(log.mock.calls.flat().join()).not.toContain("secret");
  });
});
