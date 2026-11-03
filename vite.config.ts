import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build` → normal multi-file static site (GitHub Pages / Cloudflare Pages).
// `npm run build:single` → one self-contained HTML file, used for quick previews.
export default defineConfig(({ mode }) => ({
  base: './',
  // Sample CSVs are served as static files next to the app and fetched on demand.
  publicDir: 'data',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096,
    chunkSizeWarningLimit: 4000,
  },
  worker: { format: 'es' },
  test: { include: ['test/**/*.test.ts'] },
}))
