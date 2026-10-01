import { defineConfig } from "vitest/config";

// The unit-test configuration globally mocks Supabase; this opt-in job must use it live.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/template-lint.test.ts"],
    setupFiles: [],
  },
});
