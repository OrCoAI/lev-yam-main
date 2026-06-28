import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The platform is served under levyam.com/app — every asset URL must be /app/-prefixed.
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 5173,
  },
})
