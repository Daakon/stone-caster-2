import { resolve } from "node:path";
import { root, run, repoPath, tally, compare } from "./ratchet.mjs";

const { output } = run([
  "exec",
  "--",
  "knip",
  "--reporter",
  "json",
  "--include",
  "files,exports,types,dependencies,devDependencies",
  "--no-progress",
]);
let report;
try {
  report = JSON.parse(
    output
      .trim()
      .split(/\r?\n/)
      .find((line) => line.startsWith('{"issues"')),
  );
} catch {
  console.error(`Knip reporter failed:\n${output.slice(-3000)}`);
  process.exit(2);
}
const keys = [];
for (const file of report.files ?? [])
  keys.push(repoPath(file) + "|files|" + repoPath(file));
for (const issue of report.issues ?? []) {
  const file = repoPath(issue.file);
  for (const kind of [
    "files",
    "exports",
    "types",
    "dependencies",
    "devDependencies",
  ]) {
    for (const item of issue[kind] ?? [])
      keys.push(`${file}|${kind}|${item.name}`);
  }
}
compare(
  "Knip",
  resolve(root, "scripts/ci/baselines/knip.json"),
  tally(keys),
  (key) => key.split("|", 1)[0],
);
