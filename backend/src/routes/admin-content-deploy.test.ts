import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import router from "./admin-content-deploy.js";
import { authService } from "../services/auth/auth.service.js";
import { ContentDeployHistoryService } from "../services/content/content-deploy-history.service.js";

describe("deployment history HTTP authorization", () => {
  const app = express();
  app.use("/api/admin", router);
  const repo = { page: vi.fn() };
  const factory = vi.fn();
  beforeEach(() => {
    vi.spyOn(authService, "validateToken").mockResolvedValue({ valid: false });
    vi.spyOn(authService, "isAdmin").mockResolvedValue(false);
    vi.spyOn(authService, "bootstrapProfile").mockResolvedValue(undefined);
    repo.page.mockResolvedValue({ items: [], next_before_generation: null });
    factory.mockReset().mockReturnValue(new ContentDeployHistoryService(repo));
    vi.spyOn(ContentDeployHistoryService, "forRequest").mockImplementation(
      factory,
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  function admin() {
    vi.spyOn(authService, "validateToken").mockResolvedValue({
      valid: true,
      user: {
        id: "00000000-0000-4000-8000-00000000a001",
        isGuest: false,
        roles: ["admin"],
      },
    });
    vi.spyOn(authService, "isAdmin").mockResolvedValue(true);
  }
  it("denies missing/service credentials before constructing the service", async () => {
    expect(
      (await request(app).get("/api/admin/content/deploy-log")).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .get("/api/admin/content/deploy-log")
          .set("Authorization", "Bearer service-role-fixture")
      ).status,
    ).toBe(401);
    expect(factory).not.toHaveBeenCalled();
  });
  it("denies an authenticated player", async () => {
    vi.spyOn(authService, "validateToken").mockResolvedValue({
      valid: true,
      user: {
        id: "00000000-0000-4000-8000-00000000b001",
        isGuest: false,
        roles: ["player"],
      },
    });
    expect(
      (
        await request(app)
          .get("/api/admin/content/deploy-log")
          .set("Authorization", "Bearer player-fixture")
      ).status,
    ).toBe(403);
    expect(factory).not.toHaveBeenCalled();
  });
  it("returns a noncached standard envelope to a verified admin", async () => {
    admin();
    const result = await request(app)
      .get("/api/admin/content/deploy-log?limit=2&before_generation=5")
      .set("Authorization", "Bearer admin-fixture");
    expect(result.status).toBe(200);
    expect(result.body as unknown).toMatchObject({
      ok: true,
      data: { items: [], next_before_generation: null },
    });
    expect(result.headers["cache-control"] as unknown).toBe("no-store");
    expect(repo.page).toHaveBeenCalledWith({
      limit: 2,
      before_generation: "5",
    });
  });
  it("rejects invalid paging without invoking the repository", async () => {
    admin();
    expect(
      (
        await request(app)
          .get("/api/admin/content/deploy-log?limit=0")
          .set("Authorization", "Bearer admin-fixture")
      ).status,
    ).toBe(422);
    expect(repo.page).not.toHaveBeenCalled();
  });
  it("sanitizes a repository failure as typed unavailable", async () => {
    admin();
    repo.page.mockRejectedValueOnce(new Error("private database detail"));
    const result = await request(app)
      .get("/api/admin/content/deploy-log")
      .set("Authorization", "Bearer admin-fixture");
    expect(result.status).toBe(503);
    expect(result.body as unknown).toMatchObject({
      ok: false,
      error: { message: "Content deployment history is unavailable." },
    });
  });
  it("maps an unexpected service construction error without leaking it", async () => {
    admin();
    vi.spyOn(ContentDeployHistoryService, "forRequest").mockImplementationOnce(
      () => {
        throw new Error("private");
      },
    );
    const result = await request(app)
      .get("/api/admin/content/deploy-log")
      .set("Authorization", "Bearer admin-fixture");
    expect(result.status).toBe(500);
    expect(result.body as unknown).toMatchObject({
      ok: false,
      error: { message: "Unable to read content deployment history" },
    });
  });
});
