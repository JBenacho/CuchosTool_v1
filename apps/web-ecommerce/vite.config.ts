import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: UI en :5173 con proxy a la API local (:3001)
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '')
      }
    }
  },
  build: { outDir: 'dist', sourcemap: false }
});
