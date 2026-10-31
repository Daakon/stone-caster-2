import { writeFileSync } from "node:fs";
import { z } from "zod";

const command = process.argv[2];
if (command !== "validate" && command !== "spec") {
  console.error("Usage: api-docs-ci.ts validate | spec [output.json]");
  process.exit(1);
}

// Import the same document served at /swagger.json, without starting the API.
const { swaggerSpec } = await import("../config/swagger.js");
const document = z
  .object({
    openapi: z.string().regex(/^3\./),
    info: z.object({ title: z.string().min(1), version: z.string().min(1) }),
    paths: z
      .record(z.unknown())
      .refine((paths) => Object.keys(paths).length > 0),
  })
  .passthrough()
  .parse(swaggerSpec);

console.log(
  `API documentation: ${String(Object.keys(document.paths).length)} documented paths generated.`,
);
if (command === "spec") {
  const output = process.argv[3] ?? "api-spec.json";
  writeFileSync(output, `${JSON.stringify(swaggerSpec, null, 2)}\n`);
  console.log(`OpenAPI specification written to ${output}`);
}
