import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { legacyFrom } = vi.hoisted(() => ({ legacyFrom: vi.fn() }));
vi.mock("../services/supabase.js", () => ({
  supabaseAdmin: { from: legacyFrom },
}));
import worlds from "../routes/chimera-worlds.js";
import entities from "../routes/chimera-entities.js";
import { AssetTagWriteService } from "../services/content/asset-tag-write.service.js";
import { authService } from "../services/auth/auth.service.js";
import * as clients from "../db/supabase-client.js";
import { ServiceError } from "../utils/serviceError.js";
import {
  ApiErrorCode,
  ApiErrorResponseSchema,
} from "../../../shared/src/types/api.js";
const id = "00000000-0000-4000-8000-000000000010",
  owner = "00000000-0000-4000-8000-000000000011";
const app = express();
app.use(express.json());
app.use("/worlds", worlds);
app.use("/entities", entities);
beforeEach(() => {
  vi.spyOn(authService, "validateToken").mockResolvedValue({
    valid: true,
    user: { id: owner, isGuest: false, roles: [] },
  });
  vi.spyOn(authService, "bootstrapProfile").mockResolvedValue(undefined);
  legacyFrom.mockImplementation(() => {
    const result = {
      data: {
        id,
        owner_user_id: owner,
        visibility: "private",
        definition: {},
        raw_data: {},
        name: "Authored",
        entity_type: "NPC",
      },
      error: null,
    };
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      single: vi.fn().mockResolvedValue(result),
      then: Promise.resolve(result).then.bind(Promise.resolve(result)),
    };
    for (const method of [query.select, query.eq, query.insert, query.update])
      method.mockReturnValue(query);
    return query;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  legacyFrom.mockReset();
});
describe("player asset tag HTTP integration", () => {
  it.each(["worlds", "entities"])(
    "validates and wires %s create tags to request RLS without legacy tag queries",
    async (kind) => {
      const replace = vi
        .spyOn(AssetTagWriteService.prototype, "replace")
        .mockResolvedValue([]);
      const client = vi.spyOn(clients, "getChimeraSupabaseClient");
      const body =
        kind === "worlds"
          ? { display_name: "Authored", tag_names: ["first tag!", "FIRST_TAG"] }
          : {
              display_name: "Authored",
              entity_type: "NPC",
              tags: ["first tag!", "FIRST_TAG"],
            };
      const response = await request(app)
        .post("/" + kind)
        .set("Authorization", "Bearer fixture")
        .send(body);
      expect(response.status).toBe(200);
      expect(replace).toHaveBeenCalledWith(
        kind === "worlds" ? "world" : "entity_template",
        id,
        ["FIRST_TAG"],
      );
      expect(client).toHaveBeenCalledTimes(1);
      expect(client.mock.calls.every((c) => c[0]?.user?.id === owner)).toBe(
        true,
      );
      expect(legacyFrom.mock.calls.flat()).not.toContain("chimera_tags");
      expect(legacyFrom.mock.calls.flat()).not.toContain("chimera_asset_tags");
    },
  );
  it.each(["worlds", "entities"])(
    "preserves omitted %s update tags, and clears only when explicitly empty",
    async (kind) => {
      const replace = vi
        .spyOn(AssetTagWriteService.prototype, "replace")
        .mockResolvedValue([]);
      const route = "/" + kind + "/" + id;
      expect(
        (
          await request(app)
            .put(route)
            .set("Authorization", "Bearer fixture")
            .send({ display_name: "Changed" })
        ).status,
      ).toBe(200);
      expect(replace).not.toHaveBeenCalled();
      const body = kind === "worlds" ? { tag_names: [] } : { tags: [] };
      expect(
        (
          await request(app)
            .put(route)
            .set("Authorization", "Bearer fixture")
            .send(body)
        ).status,
      ).toBe(200);
      expect(replace).toHaveBeenCalledWith(
        kind === "worlds" ? "world" : "entity_template",
        id,
        [],
      );
    },
  );
  it.each(["worlds", "entities"])(
    "refuses bad %s names before any parent save",
    async (kind) => {
      const replace = vi.spyOn(AssetTagWriteService.prototype, "replace");
      const body =
        kind === "worlds"
          ? { display_name: "Authored", tag_names: ["!!!"] }
          : { display_name: "Authored", entity_type: "NPC", tags: ["!!!"] };
      const response = await request(app)
        .post("/" + kind)
        .set("Authorization", "Bearer fixture")
        .send(body);
      expect(response.status).toBe(422);
      expect(legacyFrom).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    },
  );
  it.each(["worlds", "entities"])(
    "returns a safe %s tag failure instead of successful partial tagging",
    async (kind) => {
      vi.spyOn(AssetTagWriteService.prototype, "replace").mockRejectedValue(
        new ServiceError(503, {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: "Tag changes are temporarily unavailable.",
        }),
      );
      const body =
        kind === "worlds" ? { tag_names: ["NAME"] } : { tags: ["NAME"] };
      const response = await request(app)
        .put("/" + kind + "/" + id)
        .set("Authorization", "Bearer fixture")
        .send(body);
      expect(response.status).toBe(503);
      expect(
        ApiErrorResponseSchema.safeParse(response.body as unknown).success,
      ).toBe(true);
      expect(JSON.stringify(response.body)).not.toContain("SQL");
    },
  );
  it("requires authentication before the parent or tag writers", async () => {
    const write = vi.spyOn(AssetTagWriteService, "forRequest");
    for (const kind of ["worlds", "entities"])
      expect(
        (
          await request(app)
            .post("/" + kind)
            .send({})
        ).status,
      ).toBe(401);
    expect(write).not.toHaveBeenCalled();
    expect(legacyFrom).not.toHaveBeenCalled();
  });
});
