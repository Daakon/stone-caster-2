import express from "express";
import request from "supertest";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import router from "../routes/chimera-compile.js";
import { FrozenContentCompileService } from "../services/compile/frozen-content-compile.service.js";
import { authService } from "../services/auth/auth.service.js";
import { ServiceError } from "../utils/serviceError.js";
import {
  ApiErrorCode,
  ApiErrorResponseSchema,
} from "../../../shared/src/types/api.js";
describe("compile cache HTTP failure boundary", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/chimera/compile", router);
  const selection = {
    world: { kind: "world", owner_namespace: "first_party", key: "sample" },
    rulesets: [],
    entities: [],
  };
  beforeEach(() => {
    vi.spyOn(authService, "validateToken").mockResolvedValue({
      valid: true,
      user: {
        id: "00000000-0000-4000-8000-00000000a001",
        isGuest: false,
        roles: ["admin"],
      },
    });
    vi.spyOn(authService, "bootstrapProfile").mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("maps an unavailable content cache to a safe standard 503 envelope", async () => {
    vi.spyOn(
      FrozenContentCompileService.prototype,
      "compile",
    ).mockRejectedValue(
      new ServiceError(503, {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: "Content cache is temporarily unavailable.",
      }),
    );
    const result = await request(app)
      .post("/api/chimera/compile")
      .set("Authorization", "Bearer admin-fixture")
      .send(selection);
    expect(result.status).toBe(503);
    expect(
      ApiErrorResponseSchema.safeParse(result.body as unknown).success,
    ).toBe(true);
    expect(result.text).not.toContain("source_manifest");
    expect(result.text).not.toContain("private database");
  });
  it("preserves the successful compile response", async () => {
    vi.spyOn(
      FrozenContentCompileService.prototype,
      "compile",
    ).mockResolvedValue("00000000-0000-4000-8000-000000000003");
    const result = await request(app)
      .post("/api/chimera/compile")
      .set("Authorization", "Bearer admin-fixture")
      .send(selection);
    expect(result.status).toBe(201);
    expect(result.body as unknown).toMatchObject({
      ok: true,
      data: { id: "00000000-0000-4000-8000-000000000003" },
    });
  });
});
