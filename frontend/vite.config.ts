import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')
  
  const workerUrl = env.VITE_WORKER_URL || 'http://localhost:8787'
  
  return {
    plugins: [
      react(),
      {
        name: 'copy-cloudflare-files',
        closeBundle() {
          // Copy _headers to dist
          const src = resolve(__dirname, 'public', '_headers')
          const dest = resolve(__dirname, 'dist', '_headers')
          require('fs').copyFileSync(src, dest)
        }
      }
    ],
    base: '/', // Use root path for custom domain
    server: {
      proxy: {
        '/api': {
          target: workerUrl,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, '')
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
  }
})
