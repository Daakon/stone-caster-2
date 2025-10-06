import { defineConfig } from 'tsup'
import path from 'path'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2022',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  dts: false, // We'll use tsc for type checking
  esbuildOptions(options) {
    options.alias = {
      '@shared': path.resolve(__dirname, '../shared/src'),
    }
  },
})
