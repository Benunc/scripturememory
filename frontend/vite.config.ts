import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
