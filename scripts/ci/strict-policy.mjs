import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
export const strictGlobs = [
  "frontend/src/features/play/**",
  "frontend/src/stores/useActiveGameStore.ts",
  "shared/src/types/chimera-play-view.ts",
  "backend/src/services/play/**",
];
// Freeze the introduction inventory: files added in later PRs stay strict after merging.
const originalFiles = new Set(
  JSON.parse(
    readFileSync(resolve(root, "scripts/ci/baselines/main-files.json"), "utf8"),
  ),
);
export function isNew(path) {
  return !originalFiles.has(path.replaceAll("\\", "/"));
}
export function currentFiles() {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  if (result.status !== 0)
    throw new Error(result.stderr || "Cannot enumerate repository files");
  return [...new Set(result.stdout.trim().split(/\r?\n/).filter(Boolean))];
}
export function strictFiles(prefix) {
  return currentFiles()
    .filter(
      (path) =>
        path.startsWith(prefix) && isNew(path) && /\.[cm]?[jt]sx?$/.test(path),
    )
    .map((path) => path.slice(prefix.length));
}
