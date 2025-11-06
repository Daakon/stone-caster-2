/**
 * ESLint rule to prevent direct network calls in React components
 * Forbids fetch, axios, supabase imports in **/*.{tsx,jsx} files
 * Allowed only in src/lib/api.ts and src/lib/queries/**
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent direct network calls in React components',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noDirectNetwork: 'Direct network calls ({{name}}) are forbidden in components. Use React Query hooks from @/lib/queries instead.',
    },
  },

  create(context) {
    const networkImports = ['fetch', 'axios', 'supabase'];
    const allowedPaths = ['src/lib/api', 'src/lib/queries', '@/lib/api', '@/lib/queries'];
    const isComponentFile = /\.(tsx|jsx)$/.test(context.getFilename());

    return {
      ImportDeclaration(node) {
        if (!isComponentFile) return;

        const source = node.source.value;
        const isAllowedPath = allowedPaths.some(path => 
          context.getFilename().includes(path.replace('@/', 'src/'))
        );

        if (isAllowedPath) return;

        node.specifiers.forEach(specifier => {
          const importedName = specifier.imported?.name || specifier.local?.name;
          if (networkImports.includes(importedName)) {
            context.report({
              node: specifier,
              messageId: 'noDirectNetwork',
              data: { name: importedName },
            });
          }
        });

        // Check for supabase import
        if (source.includes('supabase') && !isAllowedPath) {
          context.report({
            node: node.source,
            messageId: 'noDirectNetwork',
            data: { name: 'supabase' },
          });
        }
      },

      CallExpression(node) {
        if (!isComponentFile) return;

        const isAllowedPath = allowedPaths.some(path => 
          context.getFilename().includes(path.replace('@/', 'src/'))
        );

        if (isAllowedPath) return;

        // Check for fetch() calls
        if (node.callee.type === 'Identifier' && node.callee.name === 'fetch') {
          context.report({
            node: node.callee,
            messageId: 'noDirectNetwork',
            data: { name: 'fetch' },
          });
        }

        // Check for axios calls
        if (node.callee.type === 'MemberExpression' && 
            node.callee.object.type === 'Identifier' && 
            node.callee.object.name === 'axios') {
          context.report({
            node: node.callee,
            messageId: 'noDirectNetwork',
            data: { name: 'axios' },
          });
        }
      },
    };
  },
};

