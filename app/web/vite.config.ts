import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Production build goes straight into the approuter's static `resources/` dir,
// so xs-app.json / mta.yaml stay unchanged.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: '../router/resources', emptyOutDir: true },
  server: {
    port: 5173,
    // `npm run dev`: same /agent/* contract as the approuter, straight to CAP
    proxy: { '/agent': { target: 'http://localhost:4004', rewrite: p => p.replace(/^\/agent/, '') } }
  },
  test: { environment: 'node' }
})
