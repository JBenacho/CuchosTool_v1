// Configuracion de Drizzle Kit: genera migraciones SQL versionadas desde el esquema.
// Convencion: esquema y migraciones en espanol (capa de datos en espanol).
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/bd/esquema.ts',
  out: './bd/migraciones',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://cuchos:cuchos_dev_pass@localhost:5433/cuchostool_dev'
  },
  verbose: true,
  strict: true
});
