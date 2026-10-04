import { afterEach, describe, expect, it, vi } from "vitest";
import { TagContentReadService } from "./tag-content-read.service.js";
import { ServiceError } from "../../utils/serviceError.js";
import { ApiErrorCode } from "../../../../shared/src/types/api.js";
import {
  TagReadQuerySchema,
  type TagRead,
  type TagReadQuery,
} from "../../../../shared/src/types/chimera-tag-read.js";
const owner = "00000000-0000-4000-8000-000000000001";
const params = TagReadQuerySchema.parse({});
afterEach(() => {
  vi.restoreAllMocks();
});
describe("fresh tag selector service", () => {
  it("checks the repository on every page request, including empty pages", async () => {
    const list = vi
      .fn<[TagReadQuery], Promise<TagRead[]>>()
      .mockResolvedValueOnce([
        { id: "canonical", tag_name: "NAME", is_approved: true },
      ])
      .mockResolvedValue([]);
    const service = new TagContentReadService({ list }, owner, "trace");
    expect(await service.list(params)).toHaveLength(1);
    expect(await service.list(params)).toEqual([]);
    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenCalledWith(params);
  });
  it("rejects a missing authenticated identity before reading any tags", async () => {
    const list = vi.fn<[TagReadQuery], Promise<TagRead[]>>();
    await expect(
      new TagContentReadService({ list }, null, "trace").list(params),
    ).rejects.toMatchObject({
      statusCode: 401,
      error: { code: ApiErrorCode.UNAUTHORIZED },
    });
    expect(list).not.toHaveBeenCalled();
  });
  it("validates middleware-owned IDs", () => {
    expect(
      () => new TagContentReadService({ list: vi.fn() }, "foreign", "trace"),
    ).toThrow();
  });
  it("preserves typed errors", async () => {
    const error = new ServiceError(503, {
      code: ApiErrorCode.INTERNAL_ERROR,
      message: "Unavailable",
    });
    const list = vi
      .fn<[TagReadQuery], Promise<TagRead[]>>()
      .mockRejectedValue(error);
    await expect(
      new TagContentReadService({ list }, owner, "trace").list(params),
    ).rejects.toBe(error);
  });
  it("masks unexpected failures and logs only safe trace information", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const list = vi
      .fn<[TagReadQuery], Promise<TagRead[]>>()
      .mockRejectedValue(new Error("secret tag body"));
    await expect(
      new TagContentReadService({ list }, owner, "trace-tag").list(params),
    ).rejects.toMatchObject({
      statusCode: 503,
      error: { message: "Tags are temporarily unavailable." },
    });
    expect(log).toHaveBeenCalledWith(
      JSON.stringify({
        level: "error",
        event: "tag_content_read_failed",
        traceId: "trace-tag",
      }),
    );
    expect(log.mock.calls.flat().join()).not.toContain("secret");
  });
});
