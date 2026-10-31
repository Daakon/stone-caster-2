import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { z } from "zod";

function runDocs(...args: string[]) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/SUPABASE|OPENAI|DATABASE_URL/.test(key),
    ),
  );
  return spawnSync(
    process.execPath,
    [
      resolve("../node_modules/tsx/dist/cli.mjs"),
      "src/scripts/api-docs-ci.ts",
      ...args,
    ],
    { cwd: resolve("."), env, encoding: "utf8" },
  );
}

describe("API documentation CLI", () => {
  it("validates the declared Swagger document without service credentials", () => {
    const result = runDocs("validate");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("documented paths");
  });

  it("exports the existing Swagger source to the requested artifact", () => {
    const directory = mkdtempSync(join(tmpdir(), "stonecaster-api-docs-"));
    try {
      const output = join(directory, "api-spec.json");
      const result = runDocs("spec", output);
      expect(result.status, result.stderr).toBe(0);
      const spec = z
        .object({
          openapi: z.string(),
          info: z.object({ title: z.string() }),
          paths: z.record(
            z.object({
              get: z.object({ responses: z.record(z.unknown()) }).optional(),
            }),
          ),
        })
        .parse(JSON.parse(readFileSync(output, "utf8")) as unknown);
      expect(spec.openapi).toBe("3.0.0");
      expect(spec.info.title).toBe("StoneCaster API");
      expect(
        spec.paths["/api/catalog/worlds"]?.get?.responses["200"],
      ).toBeDefined();
      expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects unsupported commands instead of reporting success", () => {
    const result = runDocs("post-merge");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Usage:");
  });
});
