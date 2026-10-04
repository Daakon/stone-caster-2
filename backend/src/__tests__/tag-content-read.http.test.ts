import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import lore from "../routes/chimera-lore.js";
import { TagContentReadService } from "../services/content/tag-content-read.service.js";
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
describe("approved tag selector HTTP boundary", () => {
  it("uses request RLS and preserves the legacy array envelope with stable selector IDs", async () => {
    const client = vi.spyOn(clients, "getChimeraSupabaseClient");
    const tags = [
      { id: "canonical", tag_name: "AUTHORED", is_approved: true as const },
    ];
    const list = vi
      .spyOn(TagContentReadService.prototype, "list")
      .mockResolvedValue(tags);
    const response = await request(app)
      .get(
        "/api/v2/chimera/lore/tags?limit=2&offset=1&owner_user_id=foreign&admin=true",
      )
      .set("Authorization", "Bearer fixture");
    expect(response.status).toBe(200);
    expect(
      ApiSuccessResponseSchema.safeParse(response.body as unknown).success,
    ).toBe(true);
    expect(
      ApiSuccessResponseSchema.parse(response.body as unknown).data,
    ).toEqual(tags);
    expect(list).toHaveBeenCalledWith({ limit: 2, offset: 1 });
    expect(client.mock.calls[0]?.[0]?.user?.id).toBe(owner);
  });
  it("rejects unauthenticated access before reading", async () => {
    const list = vi.spyOn(TagContentReadService.prototype, "list");
    expect((await request(app).get("/api/v2/chimera/lore/tags")).status).toBe(
      401,
    );
    expect(list).not.toHaveBeenCalled();
  });
  it.each(["limit=0", "limit=51", "offset=1001", "offset=-1", "limit=bad"])(
    "rejects invalid bounds %s",
    async (query) => {
      const list = vi.spyOn(TagContentReadService.prototype, "list");
      const response = await request(app)
        .get("/api/v2/chimera/lore/tags?" + query)
        .set("Authorization", "Bearer fixture");
      expect(response.status).toBe(422);
      expect(
        ApiErrorResponseSchema.safeParse(response.body as unknown).success,
      ).toBe(true);
      expect(list).not.toHaveBeenCalled();
    },
  );
  it("returns a typed unavailable response and masks unexpected errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(TagContentReadService.prototype, "list")
      .mockRejectedValueOnce(
        new ServiceError(503, {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: "Tags are temporarily unavailable.",
        }),
      )
      .mockRejectedValueOnce(new Error("secret"));
    for (let i = 0; i < 2; i++) {
      const response = await request(app)
        .get("/api/v2/chimera/lore/tags")
        .set("Authorization", "Bearer fixture");
      expect(response.status).toBe(503);
      expect(
        ApiErrorResponseSchema.safeParse(response.body as unknown).success,
      ).toBe(true);
      expect(JSON.stringify(response.body)).not.toContain("secret");
    }
    expect(log.mock.calls.flat().join()).not.toContain("secret");
  });
});
