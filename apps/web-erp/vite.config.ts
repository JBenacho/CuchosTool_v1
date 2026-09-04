import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Sitio ERP: dev en :5174 (dominio independiente del E-Commerce en produccion).
export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5174 },
  build: { outDir: 'dist', sourcemap: false }
});
