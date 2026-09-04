// Instancia de Drizzle sobre el pool compartido (capa de acceso a datos).
import { drizzle } from 'drizzle-orm/node-postgres';
import { pool } from './cliente';
import * as esquema from './esquema';

export const base = drizzle(pool, { schema: esquema });
