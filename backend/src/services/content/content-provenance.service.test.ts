import { describe, it, expect, vi } from "vitest";
import { ContentProvenanceService } from "./content-provenance.service.js";

describe("committed content provenance", () => {
  it("resolves only a full commit and reads immutable Git bytes at that commit", () => {
    const repo = {
      head: vi.fn().mockReturnValue("a".repeat(40)),
      read: vi.fn().mockReturnValue('{"committed":true}'),
    };
    const service = new ContentProvenanceService(repo);
    const metadata = service.resolve();
    expect(metadata).toEqual({ commit_sha: "a".repeat(40) });
    expect(service.read(metadata, "worlds.json")).toBe('{"committed":true}');
    expect(repo.read).toHaveBeenCalledWith("a".repeat(40), "worlds.json");
  });
  it.each(["short", "", "z".repeat(40)])(
    "rejects invalid Git HEAD %s",
    (head) => {
      expect(() =>
        new ContentProvenanceService({
          head: vi.fn().mockReturnValue(head),
          read: vi.fn(),
        }).resolve(),
      ).toThrow("clean content/first-party");
    },
  );
  it("refuses dirty or unavailable Git without exposing subprocess output", () => {
    const repo = {
      head: vi.fn(() => {
        throw new Error("private subprocess output");
      }),
      read: vi.fn(),
    };
    expect(() => new ContentProvenanceService(repo).resolve()).toThrow(
      "Commit content changes",
    );
  });
  it.each(["../secrets.json", "x/y.json", "--help", "worlds.txt"])(
    "refuses non-content paths %s",
    (file) => {
      const repo = { head: vi.fn(), read: vi.fn() };
      expect(() =>
        new ContentProvenanceService(repo).read(
          { commit_sha: "a".repeat(40) },
          file,
        ),
      ).toThrow("Unable to read committed");
      expect(repo.read).not.toHaveBeenCalled();
    },
  );
  it("sanitizes Git object read failures", () => {
    expect(() =>
      new ContentProvenanceService({
        head: vi.fn(),
        read: vi.fn(() => {
          throw new Error("secret");
        }),
      }).read({ commit_sha: "a".repeat(40) }, "worlds.json"),
    ).toThrow("Unable to read committed");
  });
});
