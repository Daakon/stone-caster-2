import { existsSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { root, run } from "./ratchet.mjs";

const cases = [
  [
    "types",
    "ci-gate-probe.ts",
    "export const ciProbe: number = 'deliberate type error';\n",
    "TypeScript:",
  ],
  [
    "lint",
    "ci-gate-probe.ts",
    "export const ciProbe: any = 1;\n",
    "no-explicit-any",
  ],
  [
    "tests",
    "ci-gate-probe.test.ts",
    "import { it, expect } from 'vitest';\nit('deliberate CI test failure', () => { expect(1).toBe(2); });\n",
    "deliberate CI test failure",
  ],
];
mkdirSync(resolve(root, "tmp"), { recursive: true });
for (const [label, name, content, expected] of cases) {
  const file = resolve(root, "frontend/src/features/play", name);
  if (existsSync(file)) throw new Error("Refusing to overwrite " + file);
  writeFileSync(file, content, { flag: "wx" });
  try {
    const started = performance.now();
    const { status, output } = run(["run", "ci:all"]);
    writeFileSync(resolve(root, "tmp", "ci-proof-" + label + ".log"), output);
    if (status === 0 || !output.includes(expected))
      throw new Error(
        label + " gate did not reject its regression for the expected reason",
      );
    console.log(
      label +
        ": ci:all rejected the probe (exit " +
        String(status) +
        ", " +
        ((performance.now() - started) / 1000).toFixed(1) +
        "s).",
    );
  } finally {
    unlinkSync(file);
  }
}
console.log("All three deliberate regressions rejected; every probe removed.");
