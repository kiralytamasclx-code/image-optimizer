import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  optimizeDeps: {
    // These load their own WASM at runtime; letting esbuild pre-bundle them
    // breaks the wasm path resolution, so exclude them from dep optimization.
    // (@jsquash/avif = AVIF encoder, mupdf = text-safe PDF compressor,
    //  @jspawn/ghostscript-wasm = opt-in "maximum compression" PDF path.)
    exclude: ['@jsquash/avif', 'mupdf', '@jspawn/ghostscript-wasm'],
  },
  // @jsquash's AVIF encoder ships a Web Worker; the ES worker format is required
  // for it to bundle under Vite's code-splitting production build.
  worker: {
    format: 'es',
  },
  // MuPDF's wasm glue (loaded in the PDF worker) uses top-level await, which
  // requires an es2022 target — the Vite default ("modules" ~ es2020) rejects it
  // at build time. es2022 is supported by all evergreen browsers (Chrome 89+,
  // Safari 15+, Firefox 89+, Edge 89+), matching this app's browser-support baseline.
  build: {
    target: 'es2022',
  },
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
