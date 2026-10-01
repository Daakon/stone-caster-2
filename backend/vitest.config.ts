import { configDefaults, defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    setupFiles: ["./src/test-setup.ts"],
    environment: "node",
    globals: true,
    exclude: [
      ...configDefaults.exclude,
      "tests/chimera/content-deployer-role.integration.test.ts",
      "tests/chimera/frozen-play-slice.integration.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "../shared/src"),
      "@shared/*": resolve(__dirname, "../shared/src/*"),
    },
  },
});
