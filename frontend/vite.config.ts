import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared/src"),
    },
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