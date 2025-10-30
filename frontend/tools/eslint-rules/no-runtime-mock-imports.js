/**
 * Disallow importing src/mock/* from runtime code.
 * Allowed only in scripts/seed/** and test/** (and *.test.* files).
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not import src/mock/* in runtime code. Use /api/** or move to seed/tests.',
    },
    schema: [],
    messages: {
      noRuntimeMockImports:
        'Do not import src/mock/* in runtime code. Use /api/** or move this code into scripts/seed/** or test/**.',
    },
  },
  create(context) {
    const filename = context.getFilename().replace(/\\/g, '/');
    const isAllowedFile =
      filename.includes('/scripts/seed/') ||
      filename.includes('/test/') ||
      filename.includes('/tests/') ||
      /\.test\.[jt]sx?$/.test(filename);

    return {
      ImportDeclaration(node) {
        // Only check disallowed contexts
        if (isAllowedFile) return;
        const importPath = node.source.value;
        if (
          typeof importPath === 'string' &&
          /(^|\/)mock\//.test(importPath.replace(/\\/g, '/'))
        ) {
          context.report({ node, messageId: 'noRuntimeMockImports' });
        }
      },
      CallExpression(node) {
        // Handle dynamic import("src/mock/...")
        if (isAllowedFile) return;
        if (
          node.callee.type === 'Import' &&
          node.arguments &&
          node.arguments[0] &&
          node.arguments[0].type === 'Literal' &&
          typeof node.arguments[0].value === 'string' &&
          /(^|\/)mock\//.test(node.arguments[0].value.replace(/\\/g, '/'))
        ) {
          context.report({ node, messageId: 'noRuntimeMockImports' });
        }
      },
    };
  },
};


