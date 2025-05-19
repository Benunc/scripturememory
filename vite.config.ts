import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Root path for custom domain
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: undefined,
        // Ensure proper MIME types
        assetFileNames: (assetInfo) => {
          if (!assetInfo.name) return 'assets/[name].[hash].[ext]';
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/\.(js|mjs)$/.test(assetInfo.name)) {
            return `assets/[name].[hash].js`;
          }
          return `assets/[name].[hash].[ext]`;
        },
        // Ensure proper MIME types for JavaScript modules
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
      },
    },
  },
  server: {
    headers: {
      'Content-Type': 'text/javascript',
      'X-Content-Type-Options': 'nosniff'
    }
  }
})
