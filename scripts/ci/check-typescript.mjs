import { resolve } from "node:path";
import { root, run, repoPath, tally, compare } from "./ratchet.mjs";

const errors = [];
for (const workspace of ["frontend", "backend"]) {
  const { output, status } = run([
    "run",
    "type-check",
    `--workspace=${workspace}`,
    "--",
    "--pretty",
    "false",
  ]);
  const initialCount = errors.length;
  let last = null;
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^(.+?)\(\d+,\d+\): error TS(\d+): (.*)$/);
    if (match) {
      const raw = match[1].replaceAll("\\", "/");
      const path = repoPath(resolve(root, workspace, raw));
      last = { path, code: match[2], message: match[3] };
      errors.push(last);
    } else if (last && /^\s+\S/.test(line)) {
      last.message += ` ${line.trim()}`;
    } else last = null;
  }
  if (status !== 0 && errors.length === initialCount) {
    console.error(
      workspace +
        ": TypeScript failed without parseable diagnostics.\n" +
        output.slice(-3000),
    );
    process.exitCode = 1;
  }
}
compare(
  "TypeScript",
  resolve(root, "scripts/ci/baselines/typescript.json"),
  tally(
    errors.map(
      ({ path, code, message }) =>
        `${path}|TS${code}|${message.replaceAll(root.replaceAll("\\", "/"), "<repo>").replaceAll(root, "<repo>").replace(/\s+/g, " ").trim()}`,
    ),
  ),
  (key) => key.split("|", 1)[0],
);
