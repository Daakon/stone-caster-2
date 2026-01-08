/**
 * Lenient ESLint config for development
 * Allows dev to continue working while fixing issues incrementally
 */
module.exports = {
  extends: ['./eslint.config.js'],
  rules: {
    // Downgrade to warnings instead of errors
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-unused-vars': 'warn',
  },
};
