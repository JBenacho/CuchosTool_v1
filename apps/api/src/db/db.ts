import { drizzle } from 'drizzle-orm/node-postgres';
import { pool } from './client';
import * as schema from './schema';

// Instancia Drizzle sobre el pool compartido (esquema completo).
export const db = drizzle(pool, { schema });
