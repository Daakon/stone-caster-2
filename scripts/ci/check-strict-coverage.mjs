import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { run } from "./ratchet.mjs";
import { strictFiles } from "./strict-policy.mjs";

const directory = mkdtempSync(join(tmpdir(), "stonecaster-coverage-"));
let failed = false;
try {
  for (const workspace of ["frontend", "backend"]) {
    const reportDirectory = resolve(directory, workspace);
    const includes =
      workspace === "frontend"
        ? ["src/features/play/**", "src/stores/useActiveGameStore.ts"]
        : ["src/services/play/**"];
    includes.push(
      ...strictFiles(workspace + "/").filter(
        (path) =>
          path.startsWith("src/") &&
          /\.[cm]?[jt]sx?$/.test(path) &&
          !/\.(test|spec)\./.test(path),
      ),
    );
    // allowExternal makes Vitest match absolute paths, including shared source.
    const absoluteIncludes = includes.map(
      (pattern) => `**/${workspace}/${pattern}`,
    );
    if (workspace === "backend")
      absoluteIncludes.push("**/shared/src/types/chimera-play-view.ts");
    const { output } = run([
      "exec",
      `--workspace=${workspace}`,
      "--",
      "vitest",
      "run",
      "--coverage",
      "--coverage.all",
      "--coverage.allowExternal",
      ...absoluteIncludes.map((pattern) => `--coverage.include=${pattern}`),
      "--coverage.reporter=json-summary",
      `--coverage.reportsDirectory=${reportDirectory}`,
      "--coverage.reportOnFailure",
    ]);
    let summary;
    try {
      summary = JSON.parse(
        readFileSync(join(reportDirectory, "coverage-summary.json"), "utf8"),
      ).total;
    } catch {
      console.error(
        `${workspace}: coverage report missing. ${output.slice(-2000)}`,
      );
      failed = true;
      continue;
    }
    const lines = summary.lines?.pct ?? 0;
    const branches = summary.branches?.pct ?? 0;
    console.log(
      `${workspace} strict-zone coverage: ${lines}% lines, ${branches}% branches (minimum 80% each).`,
    );
    if (
      !Number.isFinite(lines) ||
      !Number.isFinite(branches) ||
      lines < 80 ||
      branches < 80 ||
      !summary.lines?.total
    )
      failed = true;
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
if (failed) process.exitCode = 1;
