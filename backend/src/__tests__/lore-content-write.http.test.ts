import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import lore from "../routes/chimera-lore.js";
import { LoreContentWriteService } from "../services/content/lore-content-write.service.js";
import { authService } from "../services/auth/auth.service.js";
import * as clients from "../db/supabase-client.js";
import { ServiceError } from "../utils/serviceError.js";
import {
  ApiErrorCode,
  ApiSuccessResponseSchema,
  ApiErrorResponseSchema,
} from "../../../shared/src/types/api.js";
import {
  loreWriteFixture as row,
  loreWriteId as id,
  loreWriteOwner as owner,
  loreWriteWorld as world,
} from "./fixtures/lore-write.js";
const app = express();
app.use(express.json());
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
describe("lore write HTTP boundary", () => {
  it("passes validated fields to request-RLS services and preserves success DTOs", async () => {
    const client = vi.spyOn(clients, "getChimeraSupabaseClient"),
      admin = vi.spyOn(clients, "getChimeraSupabaseAdminClient");
    const create = vi
      .spyOn(LoreContentWriteService.prototype, "create")
      .mockResolvedValue(row);
    const update = vi
      .spyOn(LoreContentWriteService.prototype, "update")
      .mockResolvedValue(row);
    const remove = vi
      .spyOn(LoreContentWriteService.prototype, "delete")
      .mockResolvedValue({ id, deleted: true });
    const input = {
      world_id: world,
      display_name: "Name",
      entry_text: "Facts",
    };
    for (const response of [
      await request(app)
        .post("/api/v2/chimera/lore")
        .set("Authorization", "Bearer fixture")
        .send(input),
      await request(app)
        .put("/api/v2/chimera/lore/" + id)
        .set("Authorization", "Bearer fixture")
        .send({ entry_text: "Changed" }),
      await request(app)
        .delete("/api/v2/chimera/lore/" + id)
        .set("Authorization", "Bearer fixture"),
    ]) {
      expect(response.status).toBe(200);
      expect(
        ApiSuccessResponseSchema.safeParse(response.body as unknown).success,
      ).toBe(true);
    }
    expect(create).toHaveBeenCalledWith({ ...input, keywords: [] });
    expect(update).toHaveBeenCalledWith(id, { entry_text: "Changed" });
    expect(remove).toHaveBeenCalledWith(id);
    expect(client.mock.calls.every((c) => c[0]?.user?.id === owner)).toBe(true);
    expect(admin).not.toHaveBeenCalled();
  });
  it("requires authentication on all write verbs", async () => {
    const write = vi.spyOn(LoreContentWriteService, "forRequest");
    for (const response of [
      await request(app).post("/api/v2/chimera/lore").send({}),
      await request(app)
        .put("/api/v2/chimera/lore/" + id)
        .send({}),
      await request(app).delete("/api/v2/chimera/lore/" + id),
    ])
      expect(response.status).toBe(401);
    expect(write).not.toHaveBeenCalled();
  });
  it.each([
    { owner_kind: "first_party" },
    { owner_user_id: id },
    { visibility: "public" },
    { content_key: "spoof" },
    { embedding: [] },
    { fragment: {} },
  ])("rejects privileged/unsupported create fields %s", async (extra) => {
    const create = vi.spyOn(LoreContentWriteService.prototype, "create");
    const response = await request(app)
      .post("/api/v2/chimera/lore")
      .set("Authorization", "Bearer fixture")
      .send({
        world_id: world,
        display_name: "Name",
        entry_text: "Facts",
        ...extra,
      });
    expect(response.status).toBe(422);
    expect(
      ApiErrorResponseSchema.safeParse(response.body as unknown).success,
    ).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });
  it("rejects invalid write IDs, empty patches, reparenting and missing context", async () => {
    const update = vi.spyOn(LoreContentWriteService.prototype, "update"),
      remove = vi.spyOn(LoreContentWriteService.prototype, "delete"),
      create = vi.spyOn(LoreContentWriteService.prototype, "create");
    for (const response of [
      await request(app)
        .put("/api/v2/chimera/lore/canonical-key")
        .set("Authorization", "Bearer fixture")
        .send({ entry_text: "Facts" }),
      await request(app)
        .delete("/api/v2/chimera/lore/canonical-key")
        .set("Authorization", "Bearer fixture"),
      await request(app)
        .put("/api/v2/chimera/lore/" + id)
        .set("Authorization", "Bearer fixture")
        .send({}),
      await request(app)
        .put("/api/v2/chimera/lore/" + id)
        .set("Authorization", "Bearer fixture")
        .send({ world_id: world }),
      await request(app)
        .post("/api/v2/chimera/lore")
        .set("Authorization", "Bearer fixture")
        .send({ display_name: "Name", entry_text: "Facts" }),
    ])
      expect(response.status).toBe(422);
    for (const method of [update, remove, create])
      expect(method).not.toHaveBeenCalled();
  });
  it("preserves ownership/tier/conflict errors and hides unexpected diagnostics", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const update = vi.spyOn(LoreContentWriteService.prototype, "update");
    for (const [status, code] of [
      [404, ApiErrorCode.NOT_FOUND],
      [403, ApiErrorCode.FORBIDDEN],
      [409, ApiErrorCode.CONFLICT],
      [503, ApiErrorCode.INTERNAL_ERROR],
    ] as const) {
      update.mockRejectedValueOnce(
        new ServiceError(status, { code, message: "Safe error" }),
      );
      const response = await request(app)
        .put("/api/v2/chimera/lore/" + id)
        .set("Authorization", "Bearer fixture")
        .send({ entry_text: "Changed" });
      expect(response.status).toBe(status);
      expect(
        ApiErrorResponseSchema.safeParse(response.body as unknown).success,
      ).toBe(true);
    }
    update.mockRejectedValueOnce(new Error("secret SQL/body"));
    const response = await request(app)
      .put("/api/v2/chimera/lore/" + id)
      .set("Authorization", "Bearer fixture")
      .send({ entry_text: "Changed" });
    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain("secret");
    expect(log.mock.calls.flat().join()).not.toContain("secret");
  });
});
