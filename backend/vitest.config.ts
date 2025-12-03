import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    setupFiles: ['./src/test-setup.ts'],
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../shared/src'),
      '@shared/*': resolve(__dirname, '../shared/src/*'),
    },
  },
});


