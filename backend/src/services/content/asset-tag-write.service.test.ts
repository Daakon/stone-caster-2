import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetTagWriteService } from "./asset-tag-write.service.js";
import { AssetTagWriteRepositoryError } from "../../db/repos/asset-tag-write.repo.js";
import type {
  AssetTagResult,
  AssetTagType,
} from "../../../../shared/src/types/chimera-asset-tags.js";
import {
  AssetTagNamesSchema,
  AssetTagResultSchema,
} from "../../../../shared/src/types/chimera-asset-tags.js";
const id = "00000000-0000-4000-8000-000000000010";
function fixture(owner: string | null = id) {
  const replace = vi
    .fn<[AssetTagType, string, string[]], Promise<AssetTagResult>>()
    .mockResolvedValue([]);
  return {
    replace,
    service: new AssetTagWriteService({ replace }, owner, "trace-tags"),
  };
}
afterEach(() => {
  vi.restoreAllMocks();
});
describe("owned asset tag service", () => {
  it("normalizes, deduplicates and sorts names, with an explicit empty array clearing links", async () => {
    const f = fixture();
    await f.service.replace("world", id, [
      " fire ",
      "FIRE",
      "first tag!",
      "earth",
    ]);
    expect(f.replace).toHaveBeenCalledWith("world", id, [
      "EARTH",
      "FIRE",
      "FIRST_TAG",
    ]);
    await f.service.replace("entity_template", id, []);
    expect(f.replace).toHaveBeenLastCalledWith("entity_template", id, []);
  });
  it("rejects malformed/oversized names before any mutation", async () => {
    const f = fixture();
    for (const names of [
      ["!!!"],
      [" "],
      ["A".repeat(161)],
      Array.from({ length: 101 }, () => "A"),
    ]) {
      expect(AssetTagNamesSchema.safeParse(names).success).toBe(false);
      await expect(f.service.replace("world", id, names)).rejects.toMatchObject(
        { statusCode: 422 },
      );
    }
    await expect(
      f.service.replace("world", "not-a-uuid", []),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(f.replace).not.toHaveBeenCalled();
  });
  it("requires authentication independently of caller-supplied asset identity", async () => {
    const f = fixture(null);
    await expect(f.service.replace("world", id, [])).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(f.replace).not.toHaveBeenCalled();
  });
  it.each([
    ["P0002", 404],
    ["42501", 403],
    ["22023", 422],
    ["22P02", 422],
    ["23514", 422],
    ["23505", 409],
    ["40001", 409],
    ["40P01", 409],
  ] as const)("maps %s to safe status %s", async (code, statusCode) => {
    const f = fixture();
    f.replace.mockRejectedValue(new AssetTagWriteRepositoryError(code));
    await expect(f.service.replace("world", id, [])).rejects.toMatchObject({
      statusCode,
    });
  });
  it("masks unexpected failures with trace-only logs", async () => {
    const f = fixture(),
      log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    f.replace.mockRejectedValue(new Error("secret body"));
    await expect(f.service.replace("world", id, [])).rejects.toMatchObject({
      statusCode: 503,
      error: { message: "Tag changes are temporarily unavailable." },
    });
    expect(log).toHaveBeenCalledWith(
      JSON.stringify({
        level: "error",
        event: "asset_tag_write_failed",
        traceId: "trace-tags",
      }),
    );
  });
  it("maps a malformed RPC reply to a safe availability failure", async () => {
    const f = fixture(),
      log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const parsed = AssetTagResultSchema.safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Malformed fixture was accepted");
    f.replace.mockRejectedValue(parsed.error);
    await expect(f.service.replace("world", id, [])).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(log).toHaveBeenCalledWith(
      JSON.stringify({
        level: "error",
        event: "asset_tag_write_failed",
        traceId: "trace-tags",
      }),
    );
  });
});
