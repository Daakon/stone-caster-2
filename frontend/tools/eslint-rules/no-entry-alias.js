/**
 * ESLint rule to prevent usage of deprecated entry aliases
 * This rule blocks any imports or usage of listEntries, getEntry, Entry, EntryKind
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent usage of deprecated entry aliases',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noEntryAlias: 'Entry aliases ({{name}}) are deprecated. Use Story equivalents instead.',
    },
  },

  create(context) {
    const entryAliases = [
      'listEntries',
      'getEntry', 
      'Entry',
      'EntryKind',
      'EntryType',
      'useEntryQuery',
      'useEntry',
    ];

    return {
      // Check import declarations
      ImportDeclaration(node) {
        if (node.source.value.includes('@/types/aliases') || 
            node.source.value.includes('@/lib/api')) {
          node.specifiers.forEach(specifier => {
            if (specifier.type === 'ImportDefaultSpecifier' || 
                specifier.type === 'ImportSpecifier') {
              const importedName = specifier.imported?.name || specifier.local?.name;
              if (entryAliases.includes(importedName)) {
                context.report({
                  node: specifier,
                  messageId: 'noEntryAlias',
                  data: { name: importedName },
                });
              }
            }
          });
        }
      },

      // Check variable declarations
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && entryAliases.includes(node.id.name)) {
          context.report({
            node: node.id,
            messageId: 'noEntryAlias',
            data: { name: node.id.name },
          });
        }
      },

      // Check function calls
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && entryAliases.includes(node.callee.name)) {
          context.report({
            node: node.callee,
            messageId: 'noEntryAlias',
            data: { name: node.callee.name },
          });
        }
      },

      // Check member expressions
      MemberExpression(node) {
        if (node.property.type === 'Identifier' && entryAliases.includes(node.property.name)) {
          context.report({
            node: node.property,
            messageId: 'noEntryAlias',
            data: { name: node.property.name },
          });
        }
      },
    };
  },
};
