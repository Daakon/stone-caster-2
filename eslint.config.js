import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Root eslint config based on frontend config, with one rule disabled to avoid
// an environment/plugin mismatch when linting non-frontend packages.
export default defineConfig([
	globalIgnores(['dist']),
	{
		files: ['**/*.{ts,tsx,js}'],
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
		rules: {
			// disable this rule repository-wide to avoid a runtime error in some
			// package-specific eslint plugin versions during CI/local runs.
			'@typescript-eslint/no-unused-expressions': 'off',
		},
	},
])
