// Conexion a PostgreSQL (capa de datos).
// El pool se crea de forma perezosa: solo se abren conexiones cuando un modulo las usa.
// Regla: los modulos no crean conexiones propias; siempre usan la base central.
import { Pool } from 'pg';
import { config } from '../config';

export const pool = new Pool({
  connectionString: config.urlBaseDatos,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

/**
 * Verifica que la base de datos responde (usada por /salud/listo).
 * @returns true si el SELECT 1 responde antes de 2 segundos; false en caso contrario.
 */
export async function verificarBaseDisponible(): Promise<boolean> {
  const temporizador = new Promise<boolean>(function (resolver) {
    setTimeout(function () {
      resolver(false);
    }, 2000);
  });
  const consulta = pool
    .query('SELECT 1')
    .then(function () {
      return true;
    })
    .catch(function () {
      return false;
    });
  return Promise.race([consulta, temporizador]);
}

/**
 * Cierra todas las conexiones del pool (apagado ordenado de la API).
 */
export async function cerrarPool(): Promise<void> {
  await pool.end();
}
