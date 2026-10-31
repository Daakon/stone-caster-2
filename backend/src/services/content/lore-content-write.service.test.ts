import { afterEach, describe, expect, it, vi } from "vitest";
import { LoreContentWriteService } from "./lore-content-write.service.js";
import {
  LoreWriteRepositoryError,
  type LoreContentWriteRepository,
} from "../../db/repos/lore-content-write.repo.js";
import { ServiceError } from "../../utils/serviceError.js";
import { ApiErrorCode } from "../../../../shared/src/types/api.js";
import type {
  LoreCreate,
  LoreUpdate,
  LoreWriteAction,
  LoreWriteResult,
  LoreDeleteResult,
} from "../../../../shared/src/types/chimera-lore-write.js";
import {
  loreWriteFixture as row,
  loreWriteId as id,
  loreWriteOwner as owner,
  loreWriteWorld as world,
} from "../../__tests__/fixtures/lore-write.js";
function fixture(user: string | null = owner) {
  const write = vi
    .fn<
      [LoreWriteAction, string | null, LoreCreate | LoreUpdate],
      Promise<LoreWriteResult | LoreDeleteResult>
    >()
    .mockResolvedValue(row);
  return {
    write,
    service: new LoreContentWriteService(
      { write: write as LoreContentWriteRepository["write"] },
      user,
      "trace-write",
    ),
  };
}
afterEach(() => {
  vi.restoreAllMocks();
});
describe("lore authoring service", () => {
  it("normalizes/deduplicates tags once and sends only the authored patch", async () => {
    const f = fixture();
    expect(
      await f.service.create({
        world_id: world,
        display_name: "Name",
        entry_text: "Facts",
        keywords: [],
        tag_names: [" fire ", "FIRE", "first tag!", "earth"],
      }),
    ).toEqual(row);
    expect(f.write).toHaveBeenCalledWith("create", null, {
      world_id: world,
      display_name: "Name",
      entry_text: "Facts",
      keywords: [],
      tag_names: ["EARTH", "FIRE", "FIRST_TAG"],
    });
    await f.service.update(id, { keywords: ["fact"] });
    expect(f.write).toHaveBeenLastCalledWith("update", id, {
      keywords: ["fact"],
    });
    f.write.mockResolvedValue({ id, deleted: true });
    expect(await f.service.delete(id)).toEqual({ id, deleted: true });
  });
  it("rejects missing authentication and empty normalized tag names before mutation", async () => {
    const f = fixture(null);
    await expect(f.service.delete(id)).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(f.write).not.toHaveBeenCalled();
    const valid = fixture();
    await expect(
      valid.service.update(id, { tag_names: ["!!!"] }),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(valid.write).not.toHaveBeenCalled();
    await valid.service.update(id, { tag_names: [] });
    expect(valid.write).toHaveBeenCalledWith("update", id, { tag_names: [] });
  });
  it.each([
    ["P0002", null, 404],
    ["42501", null, 403],
    ["P0001", "STORY_READ_ONLY_TIER_LIMIT", 403],
    ["22023", null, 422],
    ["22P02", null, 422],
    ["23514", null, 422],
    ["23505", null, 409],
    ["40001", null, 409],
    ["40P01", null, 409],
  ] as const)("maps %s to safe status %s", async (code, reason, statusCode) => {
    const f = fixture();
    f.write.mockRejectedValue(new LoreWriteRepositoryError(code, reason));
    await expect(
      f.service.update(id, { entry_text: "Changed" }),
    ).rejects.toMatchObject({ statusCode });
  });
  it("preserves typed errors and masks unexpected failures with safe trace logs", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined),
      f = fixture();
    const typed = new ServiceError(403, {
      code: ApiErrorCode.FORBIDDEN,
      message: "Forbidden",
    });
    f.write.mockRejectedValueOnce(typed);
    await expect(f.service.delete(id)).rejects.toBe(typed);
    for (const error of [
      new Error("secret body"),
      new LoreWriteRepositoryError("P0001", "ENTITLEMENT_NOT_CONFIGURED"),
    ]) {
      f.write.mockRejectedValue(error);
      await expect(f.service.delete(id)).rejects.toMatchObject({
        statusCode: 503,
        error: { message: "Lore changes are temporarily unavailable." },
      });
    }
    expect(log.mock.calls.flat().join()).not.toContain("secret");
    expect(log).toHaveBeenCalledWith(
      JSON.stringify({
        level: "error",
        event: "lore_content_write_failed",
        traceId: "trace-write",
      }),
    );
  });
});
