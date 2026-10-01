// Use ESLint's native suppression accounting; this only selects workspace paths.
import { run, root } from "./ratchet.mjs";
import { strictFiles, currentFiles } from "./strict-policy.mjs";
import { relative } from "node:path";

const workspace = process.argv[2];
if (workspace !== "frontend" && workspace !== "backend")
  throw new Error("Expected frontend or backend");
const cwd = workspace === "frontend" ? root + "/frontend" : root;
const paths =
  workspace === "frontend"
    ? ["."]
    : [
        "backend/src/**/*.{ts,tsx,js}",
        ...strictFiles("backend/").map((path) => "backend/" + path),
        ...currentFiles().filter(
          (path) => path === "shared/src/types/chimera-play-view.ts",
        ),
        ...strictFiles("shared/").map((path) => "shared/" + path),
      ];
const { status, output } = run(
  [
    "exec",
    "--",
    "eslint",
    ...new Set(paths),
    "--suppressions-location",
    "eslint-suppressions.json",
    "--pass-on-unpruned-suppressions",
    ...process.argv.slice(3),
  ],
  { cwd },
);
process.stdout.write(output);
console.log(
  "ESLint workspace: " + relative(root, cwd) + "; exit " + String(status),
);
process.exitCode = status;
