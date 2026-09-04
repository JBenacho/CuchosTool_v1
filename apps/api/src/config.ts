// Configuracion por ambiente (Backlog v6: CU-DEV-007 / RNF-MAN) - sin secretos en codigo.
const intEnv = function (name: string, def: number): number {
  const v = process.env[name];
  if (!v) return def;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? def : n;
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '0.0.0.0',
  port: intEnv('PORT', 3001),
  logLevel: process.env.LOG_LEVEL || 'info',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion',
  databaseUrl: process.env.DATABASE_URL || 'postgres://cuchos:cuchos_dev_pass@localhost:5433/cuchostool_dev',
};

export type AppConfig = typeof config;
