import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://cuchos:cuchos_dev_pass@localhost:5433/cuchostool_dev'
  },
  verbose: true,
  strict: true
});
