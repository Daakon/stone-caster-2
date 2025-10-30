import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'no-runtime-mocks',
      resolveId(id) {
        if (id.startsWith('/virtual/no-runtime-mocks/')) {
          throw new Error('Runtime import of src/mock/* is disallowed. Use /api/** or seed scripts.');
        }
        return null;
      },
    },
  ],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: '@shared', replacement: path.resolve(__dirname, '../shared/src') },
      ...(process.env.VITE_ALLOW_RUNTIME_MOCKS === '1'
        ? []
        : [{ find: /^src\/mock\//, replacement: '/virtual/no-runtime-mocks/' }]),
    ],
  },
  // Ensure shared changes are picked up immediately in dev
  server: {
    watch: {
      // Watch shared directory for changes
      ignored: ['!**/shared/**']
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  // Disable telemetry during development
  define: {
    'process.env.DISABLE_TELEMETRY': JSON.stringify('true')
  }
})
