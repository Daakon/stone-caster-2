import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import noEntryAlias from './tools/eslint-rules/no-entry-alias.js'
import noRuntimeMockImports from './tools/eslint-rules/no-runtime-mock-imports.js'
import noDirectNetworkCalls from './tools/eslint-rules/no-direct-network-calls.js'
import noUseEffectAsyncNetwork from './tools/eslint-rules/no-useeffect-async-network.js'
import noBareListQueryKeys from './tools/eslint-rules/no-bare-list-query-keys.js'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'stone': {
        rules: {
          'no-entry-alias': noEntryAlias,
          'no-runtime-mock-imports': noRuntimeMockImports,
          'no-direct-network-calls': noDirectNetworkCalls,
          'no-useeffect-async-network': noUseEffectAsyncNetwork,
          'no-bare-list-query-keys': noBareListQueryKeys,
        },
      },
    },
    rules: {
      'stone/no-entry-alias': 'error',
      'stone/no-runtime-mock-imports': 'error',
      'stone/no-direct-network-calls': 'error',
      'stone/no-useeffect-async-network': 'error',
      'stone/no-bare-list-query-keys': 'error',
    },
  },
  {
    files: ['scripts/seed/**', 'test/**', 'tests/**', '**/*.test.*'],
    rules: {
      'stone/no-runtime-mock-imports': 'off',
    },
  },
])
