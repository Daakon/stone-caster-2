import { resolve } from "node:path";
import { root, run, repoPath, isStrict, isNew } from "./ratchet.mjs";

const errors = [];
for (const workspace of ["frontend", "backend"]) {
  const { output, status } = run([
    "exec",
    `--workspace=${workspace}`,
    "--",
    "tsc",
    "--project",
    "tsconfig.strict.json",
    "--noEmit",
    "--pretty",
    "false",
  ]);
  let parsed = 0;
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^(.+?)\(\d+,\d+\): error TS(\d+): (.*)$/);
    if (!match) continue;
    parsed++;
    const path = repoPath(resolve(root, workspace, match[1]));
    if (isStrict(path) || isNew(path))
      errors.push(`${path}|TS${match[2]}|${match[3]}`);
  }
  if (status !== 0 && !parsed) {
    console.error(
      workspace +
        ": strict TypeScript failed without diagnostics.\n" +
        output.slice(-3000),
    );
    process.exitCode = 1;
  }
}
console.log(
  `Strict TypeScript: ${errors.length} diagnostics in strict or new files.`,
);
errors.slice(0, 50).forEach((error) => console.error(error));
if (errors.length) process.exitCode = 1;
