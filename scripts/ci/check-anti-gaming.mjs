import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { root, isStrict, isNew } from "./ratchet.mjs";
import { currentFiles as enumerateFiles } from "./strict-policy.mjs";
import ts from "typescript";

const base =
  spawnSync("git", ["rev-parse", "--verify", "refs/remotes/origin/main"], {
    cwd: root,
  }).status === 0
    ? "origin/main"
    : "main";
function git(...args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0 && !(args[0] === "grep" && result.status === 1))
    throw new Error(result.stderr || "Git inspection failed");
  return result.stdout;
}
const previousFiles = git("ls-tree", "-r", "--name-only", base)
  .trim()
  .split(/\r?\n/);
const currentFiles = enumerateFiles();
const source = (path) =>
  /\.(?:tsx?|[cm]?js)$/.test(path) && !path.includes("node_modules/");
const testFile = (path) => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path);
const directive =
  /^\s*(?:\/\/|\/\*|\*)\s*(eslint-disable|@ts-expect-error)\b(.*)$/gm;
const loadBase = (path) => git("show", `${base}:${path}`);
const loadCurrent = (path) =>
  existsSync(resolve(root, path))
    ? readFileSync(resolve(root, path), "utf8")
    : "";
const occurrences = (text) => [...text.matchAll(directive)];
const before = git(
  "grep",
  "-n",
  "-I",
  "-E",
  "^[[:space:]]*(//|/\\*|\\*)[[:space:]]*(eslint-disable|@ts-expect-error)",
  base,
  "--",
  "frontend",
  "backend",
  "shared",
  "scripts",
)
  .trim()
  .split(/\r?\n/)
  .filter(Boolean).length;
const after = currentFiles
  .filter(
    (path) => source(path) && /^(frontend|backend|shared|scripts)\//.test(path),
  )
  .reduce((n, path) => n + occurrences(loadCurrent(path)).length, 0);
let failed = false;
if (after > before) {
  console.error(`Suppression directives rose from ${before} to ${after}.`);
  failed = true;
}
const diff = git(
  "diff",
  "--unified=0",
  base,
  "--",
  "frontend",
  "backend",
  "shared",
  "scripts",
);
for (const line of diff.split(/\r?\n/)) {
  if (!line.startsWith("+") || line.startsWith("+++")) continue;
  const match = line
    .slice(1)
    .match(/^\s*(?:\/\/|\/\*|\*)\s*(eslint-disable|@ts-expect-error)\b(.*)$/);
  if (!match) continue;
  const described =
    match[1] === "eslint-disable"
      ? /--\s*\S/.test(match[2])
      : /:\s*\S/.test(match[2]);
  if (!described) {
    console.error(`New directive needs a description: ${line}`);
    failed = true;
  }
}
for (const path of currentFiles.filter(testFile)) {
  const tree = ts.createSourceFile(
    path,
    loadCurrent(path),
    ts.ScriptTarget.Latest,
    true,
  );
  let focusedOrSkipped = 0;
  const inspect = (node) => {
    const property = ts.isPropertyAccessExpression(node)
      ? node.name.text
      : ts.isElementAccessExpression(node) &&
          ts.isStringLiteral(node.argumentExpression)
        ? node.argumentExpression.text
        : "";
    if (
      ["only", "skip"].includes(property) &&
      /^(?:test|it|describe)\b/.test(node.expression.getText(tree))
    )
      focusedOrSkipped++;
    ts.forEachChild(node, inspect);
  };
  inspect(tree);
  if (focusedOrSkipped) {
    console.error(`${path}: ${focusedOrSkipped} focused or skipped tests`);
    failed = true;
  }
}
// Include untracked/new sources as well as tracked diffs in the description check.
const changedSources = new Set([
  ...git("diff", "--name-only", "--diff-filter=ACMR", base)
    .trim()
    .split(/\r?\n/),
  ...currentFiles.filter((path) => !previousFiles.includes(path)),
]);
for (const path of [...changedSources].filter(source)) {
  const previous = previousFiles.includes(path)
    ? occurrences(loadBase(path)).map((match) => match[0].trim())
    : [];
  for (const match of occurrences(loadCurrent(path))) {
    const index = previous.indexOf(match[0].trim());
    if (index >= 0) {
      previous.splice(index, 1);
      continue;
    }
    const described =
      match[1] === "eslint-disable"
        ? /--\s*\S/.test(match[2])
        : /:\s*\S/.test(match[2]);
    if (!described) {
      console.error(
        path + ": new directive needs a description: " + match[0].trim(),
      );
      failed = true;
    }
  }
}
for (const location of [
  "eslint-suppressions.json",
  "frontend/eslint-suppressions.json",
]) {
  const prefix = location.startsWith("frontend/") ? "frontend/" : "";
  const suppressions = JSON.parse(loadCurrent(location));
  for (const path of Object.keys(suppressions)) {
    if (isStrict(prefix + path) || isNew(prefix + path)) {
      console.error(
        location + ": strict or new file has lint suppressions: " + path,
      );
      failed = true;
    }
  }
}
let body = process.env.PR_DESCRIPTION ?? "";
if (
  process.env.GITHUB_EVENT_PATH &&
  existsSync(process.env.GITHUB_EVENT_PATH)
) {
  body =
    JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")).pull_request
      ?.body ?? body;
}
for (const row of git("diff", "--name-status", "-M", base)
  .trim()
  .split(/\r?\n/)) {
  const [status, oldPath, newPath] = row.split("\t");
  const path = status?.startsWith("R") ? newPath : oldPath;
  if (!path || !testFile(path) || !status || !/^(M|R|D)/.test(status)) continue;
  const old = loadBase(oldPath);
  const next = loadCurrent(path);
  const count = (text, pattern) => [...text.matchAll(pattern)].length;
  const oldTests = count(old, /\b(?:it|test)\s*\(/g);
  const nextTests = count(next, /\b(?:it|test)\s*\(/g);
  const oldAssertions = count(old, /\bexpect\s*\(/g);
  const nextAssertions = count(next, /\bexpect\s*\(/g);
  if (
    (nextTests < oldTests || nextAssertions < oldAssertions) &&
    !/TEST-REMOVAL:\s*\S/i.test(body)
  ) {
    console.error(
      `${path}: test or assertion count fell (${oldTests}/${oldAssertions} to ${nextTests}/${nextAssertions}); PR needs TEST-REMOVAL: with a reason.`,
    );
    failed = true;
  }
}
const baselineFiles = currentFiles.filter((path) =>
  /(?:^|\/)(?:baselines\/.*\.json|eslint-suppressions\.json|design-tokens-baseline\.json|\.dependency-cruiser-known-violations\.json)$/.test(
    path,
  ),
);
for (const path of baselineFiles) {
  if (!previousFiles.includes(path)) continue; // Initial baseline creation on this branch.
  const prior = loadBase(path);
  const now = loadCurrent(path);
  if (!prior || !now) continue;
  const flatten = (value, prefix = "") => {
    if (Array.isArray(value))
      return Object.fromEntries(
        value.map((item) => [prefix + "/" + JSON.stringify(item), 1]),
      );
    if (value && typeof value === "object")
      return Object.assign(
        {},
        ...Object.entries(value).map(([key, child]) =>
          flatten(child, `${prefix}/${key}`),
        ),
      );
    return { [prefix]: value };
  };
  const old = flatten(JSON.parse(prior));
  const current = flatten(JSON.parse(now));
  for (const [key, value] of Object.entries(current)) {
    if (
      !(key in old) ||
      (typeof value === "number" && value > old[key]) ||
      (typeof value !== "number" && value !== old[key])
    ) {
      console.error(`${path}: baseline entry added or increased: ${key}`);
      failed = true;
    }
  }
}
console.log(
  `Anti-gaming: ${before} baseline directives, ${after} current directives, ${failed ? "failed" : "passed"}.`,
);
if (failed) process.exitCode = 1;
