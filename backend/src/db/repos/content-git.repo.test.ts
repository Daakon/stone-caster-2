import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContentGitRepository } from "./content-git.repo.js";
const git = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFileSync: git }));
beforeEach(() => {
  vi.resetAllMocks();
});
describe("Git content input boundary", () => {
  it("checks tracked and untracked content before resolving HEAD", () => {
    git.mockReturnValueOnce("").mockReturnValueOnce("a".repeat(40) + "\n");
    expect(new ContentGitRepository().head()).toBe("a".repeat(40));
    expect(git).toHaveBeenNthCalledWith(
      1,
      "git",
      [
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "--",
        "content/first-party",
      ],
      expect.objectContaining({ encoding: "utf8" }),
    );
  });
  it("refuses dirty content before reading a commit", () => {
    git.mockReturnValueOnce(" M content/first-party/worlds.json");
    expect(() => new ContentGitRepository().head()).toThrow(
      "Commit content/first-party",
    );
    expect(git).toHaveBeenCalledOnce();
  });
  it("reads a pinned blob with argv, retaining UTF-8 content", () => {
    git.mockReturnValue("Mystika — café");
    expect(new ContentGitRepository().read("a".repeat(40), "worlds.json")).toBe(
      "Mystika — café",
    );
    expect(git).toHaveBeenCalledWith(
      "git",
      ["show", `${"a".repeat(40)}:content/first-party/worlds.json`],
      expect.objectContaining({
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      }),
    );
  });
});
