import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Sitio ERP: dev en :5174 (dominio independiente del E-Commerce en produccion).
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    // Evita caidas del watcher en Windows (EBUSY) por archivos temporales del editor.
    watch: {
      ignored: function (ruta: string) {
        return ruta.includes('.tmpdir') || ruta.endsWith('.tmp');
      },
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: function (p) {
          return p.replace(/^\/api/, '');
        },
      },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
});
