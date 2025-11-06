/**
 * ESLint rule to prevent bare string React Query keys for list data
 * List queries must include an object param in the key
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent bare string query keys for list data',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noBareListKey: 'List query keys must include an object param. Use ["{{key}}", { params }] instead of ["{{key}}"].',
    },
  },

  create(context) {
    const listKeys = ['characters', 'worlds', 'stories', 'npcs', 'rulesets', 'games', 'adventures'];
    
    function isBareListKey(node) {
      if (node.type !== 'ArrayExpression') return false;
      
      const [first, second] = node.elements;
      
      // Check if first element is a string matching list keys
      if (first && first.type === 'Literal' && typeof first.value === 'string') {
        const key = first.value;
        if (listKeys.includes(key)) {
          // Check if second element exists and is an object
          if (!second || second.type !== 'ObjectExpression') {
            return { key, isBare: true };
          }
        }
      }
      
      return null;
    }

    return {
      Property(node) {
        if (node.key.type === 'Identifier' && node.key.name === 'queryKey') {
          const result = isBareListKey(node.value);
          if (result && result.isBare) {
            context.report({
              node: node.value,
              messageId: 'noBareListKey',
              data: { key: result.key },
            });
          }
        }
      },
    };
  },
};

