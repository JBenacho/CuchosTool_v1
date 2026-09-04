// Pruebas de humo de la API (sin base de datos): salud y metadatos.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { construirAplicacion } from '../src/app';

describe('API base', function () {
  let aplicacion: FastifyInstance;

  beforeAll(async function () {
    aplicacion = await construirAplicacion({ logger: false });
    await aplicacion.ready();
  });
  afterAll(async function () {
    await aplicacion.close();
  });

  it('GET /salud/estado responde 200 ok', async function () {
    const respuesta = await aplicacion.inject({ method: 'GET', url: '/salud/estado' });
    expect(respuesta.statusCode).toBe(200);
    const cuerpo = respuesta.json();
    expect(cuerpo.estado).toBe('ok');
    expect(cuerpo.servicio).toBe('cuchostool-api');
  });

  it('GET / responde metadata y docs', async function () {
    const respuesta = await aplicacion.inject({ method: 'GET', url: '/' });
    expect(respuesta.statusCode).toBe(200);
    const cuerpo = respuesta.json();
    expect(cuerpo.nombre).toBe('CuchosTool API');
    expect(cuerpo.docs).toBe('/docs');
  });
});
