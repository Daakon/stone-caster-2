import { defineConfig } from "vitest/config";

if (process.env.RUN_LOCAL_DB_INTEGRATION !== "1")
  throw new Error(
    "Local integration tests require RUN_LOCAL_DB_INTEGRATION=1 and the isolated local stack.",
  );

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/chimera/content-deployer-role.integration.test.ts",
      "tests/chimera/frozen-play-slice.integration.test.ts",
    ],
    setupFiles: [],
  },
});
