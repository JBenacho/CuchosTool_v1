// Configuracion de Vitest: pruebas en espanol (*.prueba.ts).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.prueba.ts'],
  },
});
