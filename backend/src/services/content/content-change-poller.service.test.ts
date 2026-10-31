import { describe, it, expect, vi } from "vitest";
import { ContentChangePollerService } from "./content-change-poller.service.js";
const empty = {
  generation: "0",
  head_seq: "0",
  retained_after_seq: "0",
  changes: [],
};
const owner = "00000000-0000-4000-8000-000000000001";
describe("validated active-owner content probes", () => {
  it("preserves bigint cursors without lossy numeric conversion", async () => {
    const response = {
      shared: {
        ...empty,
        generation: "9007199254740993",
        head_seq: "9007199254740994",
      },
      owners: [{ ...empty, user_id: owner }],
    };
    const repo = { page: vi.fn().mockResolvedValue(response) };
    expect(
      await new ContentChangePollerService(repo).page(
        null,
        [{ user_id: owner, after_seq: null }],
        "trace",
      ),
    ).toEqual(response);
    expect(repo.page).toHaveBeenCalledWith(null, [
      { user_id: owner, after_seq: null },
    ]);
  });
  it.each([
    { shared: empty, owners: [] },
    {
      shared: empty,
      owners: [
        { ...empty, user_id: owner },
        { ...empty, user_id: owner },
      ],
    },
    {
      shared: empty,
      owners: [{ ...empty, user_id: "00000000-0000-4000-8000-000000000002" }],
    },
    {
      shared: { ...empty, head_seq: "9223372036854775808" },
      owners: [{ ...empty, user_id: owner }],
    },
    null,
  ])(
    "refuses malformed, missing, duplicated or foreign owner pages",
    async (response) => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        await expect(
          new ContentChangePollerService({
            page: vi.fn().mockResolvedValue(response),
          }).page("0", [{ user_id: owner, after_seq: "0" }], "trace-id"),
        ).rejects.toMatchObject({ statusCode: 503 });
        expect(log).toHaveBeenCalledWith(
          JSON.stringify({
            level: "error",
            event: "content_change_probe_failed",
            traceId: "trace-id",
          }),
        );
      } finally {
        log.mockRestore();
      }
    },
  );
  it("maps disconnected database probes to a safe unavailable error", async () => {
    await expect(
      new ContentChangePollerService({
        page: vi
          .fn()
          .mockRejectedValue(new Error("postgresql://private:secret@db")),
      }).page(null, [], "trace"),
    ).rejects.toThrow("temporarily unavailable");
  });
});
