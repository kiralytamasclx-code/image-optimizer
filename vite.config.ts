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
    // (@jsquash/avif = AVIF encoder, @jspawn/ghostscript-wasm = PDF compressor.)
    exclude: ['@jsquash/avif', '@jspawn/ghostscript-wasm'],
  },
  // @jsquash's AVIF encoder ships a Web Worker; the ES worker format is required
  // for it to bundle under Vite's code-splitting production build.
  worker: {
    format: 'es',
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
