import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import prettier from "prettier";
import { root } from "./ratchet.mjs";

const write = process.argv.includes("--write");
function git(...args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status) throw new Error(result.stderr);
  return result.stdout.trim().split(/\r?\n/).filter(Boolean);
}
const base =
  spawnSync("git", ["rev-parse", "--verify", "refs/remotes/origin/main"], {
    cwd: root,
  }).status === 0
    ? "origin/main"
    : "main";
const changed = new Set([
  ...git("diff", "--name-only", "--diff-filter=ACMR", base),
  ...git("ls-files", "--others", "--exclude-standard").filter(
    (path) => !path.startsWith(".claude/"),
  ),
]);
let failed = 0;
for (const path of changed) {
  if (!/\.(?:[cm]?js|tsx?|jsonc?|md|ya?ml|css)$/.test(path)) continue;
  const file = resolve(root, path);
  if (!existsSync(file)) continue;
  const info = await prettier.getFileInfo(file);
  if (info.ignored || !info.inferredParser) continue;
  const content = readFileSync(file, "utf8");
  const options = { ...(await prettier.resolveConfig(file)), filepath: file };
  if (await prettier.check(content, options)) continue;
  if (write) {
    writeFileSync(file, await prettier.format(content, options));
    console.log(`Formatted ${path}`);
  } else {
    failed++;
    console.error(`Needs Prettier: ${path}`);
  }
}
console.log(
  `Format: ${changed.size} changed files checked, ${failed} unformatted.`,
);
if (failed) process.exitCode = 1;
