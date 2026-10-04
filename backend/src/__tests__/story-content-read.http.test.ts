import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import stories from "../routes/chimera-stories.js";
import catalog from "../routes/catalog.js";
import { StoryContentReadService } from "../services/content/story-content-read.service.js";
import * as clients from "../db/supabase-client.js";
import { authService } from "../services/auth/auth.service.js";
import { ServiceError } from "../utils/serviceError.js";
import {
  ApiErrorCode,
  ApiSuccessResponseSchema,
  ApiErrorResponseSchema,
} from "../../../shared/src/types/api.js";
import {
  storyFixture,
  storyOwner as owner,
  storyId as id,
} from "./fixtures/story-read.js";
const app = express();
app.use("/api/catalog", catalog);
app.use("/api/v2/chimera/stories", stories);
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
describe("story HTTP read boundaries", () => {
  it("keeps public catalog anonymous even with an admin bearer token", async () => {
    const client = vi.spyOn(clients, "getChimeraSupabaseClient"),
      validate = vi.spyOn(authService, "validateToken");
    const list = vi
      .spyOn(StoryContentReadService.prototype, "catalogList")
      .mockResolvedValue([]);
    const result = await request(app)
      .get("/api/catalog/stories?search=forest&limit=2&offset=1")
      .set("Authorization", "Bearer admin-fixture");
    expect(result.status).toBe(200);
    expect(
      ApiSuccessResponseSchema.safeParse(result.body as unknown).success,
    ).toBe(true);
    expect(list).toHaveBeenCalledWith({
      search: "forest",
      limit: 2,
      offset: 1,
    });
    expect(client.mock.calls.every((c) => c[0] === undefined)).toBe(true);
    expect(validate).not.toHaveBeenCalled();
  });
  it("uses only middleware-owned identity for the owned list", async () => {
    const client = vi.spyOn(clients, "getChimeraSupabaseClient"),
      list = vi
        .spyOn(StoryContentReadService.prototype, "list")
        .mockResolvedValue([]);
    expect(
      (
        await request(app)
          .get("/api/v2/chimera/stories/my-creations?owner_user_id=foreign")
          .set("Authorization", "Bearer fixture")
      ).status,
    ).toBe(200);
    expect(list).toHaveBeenCalledWith({ limit: 50, offset: 0 });
    expect(client.mock.calls[0]?.[0]?.user?.id).toBe(owner);
    expect(
      (await request(app).get("/api/v2/chimera/stories/my-creations")).status,
    ).toBe(401);
  });
  it("returns authorized detail through the normal envelope", async () => {
    const find = vi
      .spyOn(StoryContentReadService.prototype, "find")
      .mockResolvedValue({ ...storyFixture(), world: null });
    const result = await request(app)
      .get(`/api/v2/chimera/stories/${id}`)
      .set("Authorization", "Bearer fixture");
    expect(result.status).toBe(200);
    expect(
      ApiSuccessResponseSchema.safeParse(result.body as unknown).success,
    ).toBe(true);
    expect(find).toHaveBeenCalledWith(id);
    expect(
      (await request(app).get(`/api/v2/chimera/stories/${id}`)).status,
    ).toBe(401);
  });
  it("preserves non-disclosing 404 catalog/detail errors", async () => {
    const error = new ServiceError(404, {
      code: ApiErrorCode.NOT_FOUND,
      message: "Story not found.",
    });
    vi.spyOn(
      StoryContentReadService.prototype,
      "catalogFind",
    ).mockRejectedValue(error);
    vi.spyOn(StoryContentReadService.prototype, "find").mockRejectedValue(
      error,
    );
    for (const path of [
      `/api/catalog/stories/${id}`,
      `/api/v2/chimera/stories/${id}`,
    ]) {
      const result = await request(app)
        .get(path)
        .set("Authorization", "Bearer fixture");
      expect(result.status).toBe(404);
      expect(
        ApiErrorResponseSchema.safeParse(result.body as unknown).success,
      ).toBe(true);
    }
  });
  it.each([
    "/api/catalog/stories/not-a-uuid",
    "/api/catalog/stories?limit=51",
    "/api/v2/chimera/stories/my-creations?offset=1001",
    "/api/v2/chimera/stories/not-a-uuid",
  ])("rejects invalid read inputs: %s", async (path) => {
    const methods = [
      vi.spyOn(StoryContentReadService.prototype, "list"),
      vi.spyOn(StoryContentReadService.prototype, "find"),
      vi.spyOn(StoryContentReadService.prototype, "catalogList"),
      vi.spyOn(StoryContentReadService.prototype, "catalogFind"),
    ];
    expect(
      (await request(app).get(path).set("Authorization", "Bearer fixture"))
        .status,
    ).toBe(422);
    for (const method of methods) expect(method).not.toHaveBeenCalled();
  });
  it("returns typed 503 and masks unexpected errors on both boundaries", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(StoryContentReadService.prototype, "list").mockRejectedValue(
      new ServiceError(503, {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: "Story content is temporarily unavailable.",
      }),
    );
    vi.spyOn(
      StoryContentReadService.prototype,
      "catalogList",
    ).mockRejectedValue(new Error("secret"));
    for (const path of [
      "/api/catalog/stories",
      "/api/v2/chimera/stories/my-creations",
    ]) {
      const result = await request(app)
        .get(path)
        .set("Authorization", "Bearer fixture");
      expect(result.status).toBe(503);
      expect(
        ApiErrorResponseSchema.safeParse(result.body as unknown).success,
      ).toBe(true);
      expect(JSON.stringify(result.body)).not.toContain("secret");
    }
    expect(log.mock.calls.flat().join()).not.toContain("secret");
  });
});
