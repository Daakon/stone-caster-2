/**
 * Dependency Cruiser Configuration
 * Enforces import rules to prevent legacy code usage
 */

export default {
  forbidden: [
    {
      name: "no-circular-imports",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-frontend-to-backend",
      severity: "error",
      from: { path: "^frontend/src/" },
      to: { path: "^backend/" },
    },
    {
      name: "routes-use-services",
      severity: "error",
      from: { path: "^backend/src/routes/" },
      to: { path: "^backend/src/(db|dal)/" },
    },
    {
      name: "services-do-not-import-routes",
      severity: "error",
      from: { path: "^backend/src/services/" },
      to: { path: "^backend/src/routes/" },
    },
    {
      name: "services-use-repositories-for-db-access",
      severity: "error",
      from: { path: "^backend/src/services/" },
      to: { path: "^backend/src/db/(?!repos/)" },
    },
    {
      name: "repositories-do-not-import-services-or-routes",
      severity: "error",
      from: { path: "^backend/src/db/repos/" },
      to: { path: "^backend/src/(services|routes)/" },
    },
    {
      name: "no-legacy-imports",
      severity: "error",
      comment: "Prevents importing from legacy directories into source code",
      from: {
        path: "^(backend/src|frontend/src)",
      },
      to: {
        path: "^(backend|frontend)/.*legacy.*",
        pathNot: ".*test.*|.*spec.*", // Allow in test files
      },
    },
    {
      name: "no-legacy-prompts",
      severity: "error",
      comment: "Prevents importing legacy prompt modules",
      from: {},
      to: {
        path: ".*prompt_segments.*",
        pathNot: ".*test.*|.*spec.*|.*legacy.*", // Allow in test/legacy fixtures
      },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.paths.json",
    },
  },
};
