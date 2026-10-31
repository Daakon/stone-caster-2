import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ownerRoutes from "./chimera-entitlements.js";
import adminRoutes from "./admin-tier-limits.js";
import { authService } from "../services/auth/auth.service.js";
import { EntitlementsService } from "../services/content/entitlements.service.js";

describe("entitlement HTTP authorization", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/me/entitlements", ownerRoutes);
  app.use("/api/admin", adminRoutes);
  const repo = {
    active: vi.fn().mockResolvedValue({ state: "configuration_pending" }),
    choose: vi.fn(),
    assertGameWritable: vi.fn(),
    policies: vi.fn().mockResolvedValue({ tiers: [], default_tier_key: null }),
    setTier: vi.fn(),
    assign: vi.fn(),
    createStory: vi.fn(),
  };
  beforeEach(() => {
    repo.active.mockResolvedValue({ state: "configuration_pending" });
    repo.policies.mockResolvedValue({ tiers: [], default_tier_key: null });
    vi.spyOn(authService, "validateToken").mockResolvedValue({ valid: false });
    vi.spyOn(authService, "isAdmin").mockResolvedValue(false);
    vi.spyOn(authService, "bootstrapProfile").mockResolvedValue(undefined);
    vi.spyOn(EntitlementsService, "forRequest").mockReturnValue(
      new EntitlementsService(repo),
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("denies unauthenticated active reads and writes before service construction", async () => {
    expect((await request(app).get("/api/me/entitlements/active")).status).toBe(
      401,
    );
    expect(
      (
        await request(app)
          .put("/api/me/entitlements/active")
          .send({ story_ids: [], game_ids: [] })
      ).status,
    ).toBe(401);
    expect(EntitlementsService.forRequest).not.toHaveBeenCalled();
  });
  it("denies service credentials at the admin HTTP boundary", async () => {
    expect(
      (
        await request(app)
          .get("/api/admin/tier-limits")
          .set("Authorization", "Bearer service-role-fixture")
      ).status,
    ).toBe(401);
    expect(EntitlementsService.forRequest).not.toHaveBeenCalled();
  });
  it("denies authenticated players on every administrative operation", async () => {
    vi.spyOn(authService, "validateToken").mockResolvedValue({
      valid: true,
      user: {
        id: "00000000-0000-4000-8000-00000000b001",
        isGuest: false,
        roles: ["player"],
      },
    });
    for (const [method, path] of [
      ["get", "/api/admin/tier-limits"],
      ["patch", "/api/admin/tier-limits"],
      ["post", "/api/admin/users/00000000-0000-4000-8000-00000000b001/tier"],
    ] as const) {
      expect(
        (
          await request(app)
            [method](path)
            .set("Authorization", "Bearer player-fixture")
            .send({})
        ).status,
      ).toBe(403);
    }
    expect(EntitlementsService.forRequest).not.toHaveBeenCalled();
  });
  it("lets an authenticated owner load pending configuration without invented limits", async () => {
    vi.spyOn(authService, "validateToken").mockResolvedValue({
      valid: true,
      user: {
        id: "00000000-0000-4000-8000-00000000b001",
        isGuest: false,
        roles: ["player"],
      },
    });
    const result = await request(app)
      .get("/api/me/entitlements/active")
      .set("Authorization", "Bearer player-fixture");
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    const body: unknown = result.body as unknown;
    expect(body).toMatchObject({
      ok: true,
      data: { state: "configuration_pending" },
    });
  });
  it("lets a verified admin read policies and rejects invalid caps", async () => {
    vi.spyOn(authService, "validateToken").mockResolvedValue({
      valid: true,
      user: {
        id: "00000000-0000-4000-8000-00000000a001",
        isGuest: false,
        roles: ["admin"],
      },
    });
    vi.spyOn(authService, "isAdmin").mockResolvedValue(true);
    const result = await request(app)
      .get("/api/admin/tier-limits")
      .set("Authorization", "Bearer admin-fixture");
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(
      (
        await request(app)
          .patch("/api/admin/tier-limits")
          .set("Authorization", "Bearer admin-fixture")
          .send({
            tier_key: "fixture",
            max_owned_stories: -1,
            max_saved_games: 1,
            make_default: false,
          })
      ).status,
    ).toBe(422);
    expect(repo.setTier).not.toHaveBeenCalled();
  });
});
