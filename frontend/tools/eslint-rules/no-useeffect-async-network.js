/**
 * ESLint rule to prevent useEffect(async => ...) patterns that perform network I/O
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent useEffect with async functions that perform network I/O',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noUseEffectAsyncNetwork: 'useEffect with async functions that perform network I/O is forbidden. Use React Query hooks instead.',
    },
  },

  create(context) {
    const networkKeywords = ['fetch', 'api', 'axios', 'supabase', 'get', 'post', 'put', 'patch', 'delete'];
    
    function hasNetworkCall(node) {
      if (!node) return false;
      
      // Check for fetch, api calls, etc.
      if (node.type === 'CallExpression') {
        const callee = node.callee;
        if (callee.type === 'Identifier') {
          if (networkKeywords.some(keyword => callee.name.toLowerCase().includes(keyword))) {
            return true;
          }
        }
        if (callee.type === 'MemberExpression') {
          const obj = callee.object;
          if (obj.type === 'Identifier' && networkKeywords.some(keyword => obj.name.toLowerCase().includes(keyword))) {
            return true;
          }
        }
      }
      
      // Recursively check children
      for (const key in node) {
        if (key !== 'parent' && typeof node[key] === 'object' && node[key] !== null) {
          if (Array.isArray(node[key])) {
            for (const child of node[key]) {
              if (hasNetworkCall(child)) return true;
            }
          } else if (hasNetworkCall(node[key])) {
            return true;
          }
        }
      }
      
      return false;
    }

    return {
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'useEffect') {
          const [effectFn] = node.arguments;
          
          if (effectFn && (
            effectFn.type === 'ArrowFunctionExpression' || 
            effectFn.type === 'FunctionExpression'
          )) {
            // Check if function is async
            const isAsync = effectFn.async === true;
            
            if (isAsync && hasNetworkCall(effectFn.body)) {
              context.report({
                node: effectFn,
                messageId: 'noUseEffectAsyncNetwork',
              });
            }
          }
        }
      },
    };
  },
};

