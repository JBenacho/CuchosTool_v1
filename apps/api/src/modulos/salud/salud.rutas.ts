// Rutas de salud de la API (CU-GCP-009 / CU-DEV-006: smoke y health checks).
import type { FastifyInstance } from 'fastify';
import { verificarBaseDisponible } from '../../bd/cliente';

export async function rutasSalud(aplicacion: FastifyInstance): Promise<void> {
  // /salud/estado: responde si el proceso esta vivo (sin tocar la base).
  aplicacion.get('/salud/estado', async function () {
    return { estado: 'ok', servicio: 'cuchostool-api', hora: new Date().toISOString() };
  });

  // /salud/listo: ademas verifica conectividad con PostgreSQL (503 si no responde).
  aplicacion.get('/salud/listo', async function (_solicitud, respuesta) {
    const baseDisponible = await verificarBaseDisponible();
    if (!baseDisponible) {
      return respuesta.code(503).send({ estado: 'no_listo', base: 'inaccesible' });
    }
    return { estado: 'listo', base: 'ok' };
  });
}
