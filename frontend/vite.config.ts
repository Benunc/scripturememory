import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-cloudflare-files',
      closeBundle() {
        // Copy _headers and _routes.json to dist
        const files = ['_headers', '_routes.json']
        files.forEach(file => {
          const src = resolve(__dirname, 'public', file)
          const dest = resolve(__dirname, 'dist', file)
          require('fs').copyFileSync(src, dest)
        })
      }
    }
  ],
  base: '/', // Use root path for custom domain
  server: {
    proxy: {
      '/auth/magic-link': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
      },
      '/auth/verify': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
      },
      '/verses': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: './index.html',
      output: {
        manualChunks: undefined,
        assetFileNames: 'assets/[name].[hash][extname]',
        chunkFileNames: 'assets/[name].[hash].js',
        entryFileNames: 'assets/[name].[hash].js',
      },
    },
    // Ensure public assets are copied
    copyPublicDir: true,
    // Use esbuild for everything
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
  },
  publicDir: 'public', // Explicitly set public directory
  assetsInclude: ['**/*.svg'], // Explicitly include SVG files
})
