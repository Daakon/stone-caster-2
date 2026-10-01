import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier";
import { strictFiles } from "./scripts/ci/strict-policy.mjs";

// Root eslint config based on frontend config, with one rule disabled to avoid
// an environment/plugin mismatch when linting non-frontend packages.
export default defineConfig([
  globalIgnores(["dist", "backend/src/routes/turn-engine-e2e.test.ts"]),
  {
    files: ["**/*.{ts,tsx,js}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // disable this rule repository-wide to avoid a runtime error in some
      // package-specific eslint plugin versions during CI/local runs.
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
  {
    files: [
      "backend/src/services/play/**/*.{ts,tsx}",
      "shared/src/types/chimera-play-view.ts",
      ...strictFiles("backend/").map((path) => "backend/" + path),
      ...strictFiles("shared/").map((path) => "shared/" + path),
    ],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        project: "./backend/tsconfig.strict.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": true, "ts-expect-error": "allow-with-description" },
      ],
    },
  },
  prettier,
]);
