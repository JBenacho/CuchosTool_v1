import { Pool } from 'pg';
import { config } from '../config';

// Pool compartido. Conexiones perezosas: se crean solo cuando un modulo las usa.
export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

export async function pingDatabase(): Promise<boolean> {
  const timer = new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(false), 2000);
  });
  const query = pool
    .query('SELECT 1')
    .then(() => true)
    .catch(() => false);
  return Promise.race([query, timer]);
}

export async function closePool(): Promise<void> {
  await pool.end();
}
