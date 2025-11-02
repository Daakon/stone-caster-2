/**
 * Dependency Cruiser Configuration
 * Enforces import rules to prevent legacy code usage
 */

module.exports = {
  forbidden: [
    {
      name: 'no-legacy-imports',
      severity: 'error',
      comment: 'Prevents importing from legacy directories into source code',
      from: {
        path: '^(backend/src|frontend/src)',
      },
      to: {
        path: '.*legacy.*',
        pathNot: '.*test.*|.*spec.*', // Allow in test files
      },
    },
    {
      name: 'no-legacy-prompts',
      severity: 'error',
      comment: 'Prevents importing legacy prompt modules',
      from: {},
      to: {
        path: '.*prompt_segments.*',
        pathNot: '.*test.*|.*spec.*|.*legacy.*', // Allow in test/legacy fixtures
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'backend/tsconfig.json',
    },
  },
};

