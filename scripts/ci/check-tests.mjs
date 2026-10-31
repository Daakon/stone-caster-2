import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { root, run, repoPath, tally, compare } from "./ratchet.mjs";

const dir = mkdtempSync(join(tmpdir(), "stonecaster-vitest-"));
const failures = [];
let reporterFailed = false;
try {
  for (const workspace of ["frontend", "backend"]) {
    const file = join(dir, `${workspace}.json`);
    const { status, output } = run([
      "run",
      "test",
      `--workspace=${workspace}`,
      "--",
      "--reporter=json",
      `--outputFile=${file}`,
    ]);
    let report;
    try {
      report = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      console.error(
        `${workspace}: Vitest JSON reporter failed (exit ${status}).\n${output.slice(-3000)}`,
      );
      reporterFailed = true;
      continue;
    }
    for (const suite of report.testResults ?? []) {
      const path = repoPath(suite.name);
      if (suite.status === "failed" && !suite.assertionResults?.length) {
        failures.push(`${path}|<suite-load>`);
      }
      for (const assertion of suite.assertionResults ?? []) {
        if (assertion.status === "failed")
          failures.push(`${path}|${assertion.fullName}`);
      }
    }
    if (status && !(report.numFailedTests || report.numFailedTestSuites)) {
      console.error(
        `${workspace}: Vitest failed outside an identified test.\n${output.slice(-3000)}`,
      );
      reporterFailed = true;
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
compare(
  "Vitest",
  resolve(root, "scripts/ci/baselines/tests.json"),
  tally(failures),
  (key) => key.split("|", 1)[0],
);
if (reporterFailed) process.exitCode = 1;
