import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { isNew, strictGlobs as defaultStrictGlobs } from "./strict-policy.mjs";
export { isNew } from "./strict-policy.mjs";

export const root = resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);
const updating = args.includes("--update-baseline");
const allowAdd = args.includes("--allow-add");
const strictAt = args.indexOf("--strict-globs");
const strictGlobs =
  strictAt < 0 ? defaultStrictGlobs : (args[strictAt + 1]?.split(",") ?? []);

export function run(command, options = {}) {
  const result = spawnSync(
    process.execPath,
    [process.env.npm_execpath, ...command],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      ...options,
    },
  );
  if (result.error) throw result.error;
  if (result.signal || result.status === null)
    throw new Error("Tool process did not finish normally");
  return {
    status: result.status,
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
  };
}

export function repoPath(path) {
  return relative(root, resolve(root, path)).replaceAll("\\", "/");
}

export function isStrict(path) {
  const normalized = path.replaceAll("\\", "/");
  return strictGlobs.some((glob) =>
    glob.endsWith("/**")
      ? normalized.startsWith(glob.slice(0, -3) + "/")
      : normalized === glob,
  );
}

export function tally(keys) {
  const result = {};
  for (const key of keys) result[key] = (result[key] ?? 0) + 1;
  return Object.fromEntries(
    Object.entries(result).sort(([a], [b]) => a.localeCompare(b)),
  );
}

export function compare(label, file, current, keyPath) {
  const previous = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : {};
  const additions = [];
  const forbidden = [];
  let fixed = 0;
  for (const [key, count] of Object.entries(current)) {
    const zeroTolerance = isStrict(keyPath(key)) || isNew(keyPath(key));
    const allowed = zeroTolerance ? 0 : (previous[key] ?? 0);
    if (count > allowed)
      additions.push(`${key} (${count}, allowed ${allowed})`);
    if (zeroTolerance && count) forbidden.push(key);
  }
  for (const [key, count] of Object.entries(previous))
    fixed += Math.max(0, count - (current[key] ?? 0));
  if (updating) {
    if (additions.length && !allowAdd) {
      console.error(
        `${label}: baseline update rejected ${additions.length} new failures. --allow-add is for explicitly approved baseline generation only.`,
      );
      additions.slice(0, 30).forEach((item) => console.error(item));
      process.exitCode = 1;
      return;
    }
    if (forbidden.length) {
      console.error(
        `${label}: ${forbidden.length} strict-zone or new-file failures cannot enter a baseline.`,
      );
      process.exitCode = 1;
    }
    const allowedCurrent = Object.fromEntries(
      Object.entries(current).filter(([key]) => !forbidden.includes(key)),
    );
    mkdirSync(resolve(file, ".."), { recursive: true });
    writeFileSync(file, JSON.stringify(allowedCurrent, null, 2) + "\n");
    console.log(
      `${label}: baseline updated; ${fixed} fixed, ${additions.length} added.`,
    );
    return;
  }
  console.log(
    `${label}: ${Object.values(current).reduce((a, b) => a + b, 0)} current, ${fixed} fixed, ${additions.length} new or strict-zone failures.`,
  );
  additions.slice(0, 50).forEach((item) => console.error(item));
  if (additions.length) process.exitCode = 1;
}
