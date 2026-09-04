import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';

// Smoke test del API (sin DB): salud y metadatos.
describe('API base', function () {
  let app: FastifyInstance;

  beforeAll(async function () {
    app = await buildApp({ logger: false });
    await app.ready();
  });
  afterAll(async function () { await app.close(); });

  it('GET /healthz responde 200 ok', async function () {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('cuchostool-api');
  });

  it('GET / responde metadata y docs', async function () {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe('CuchosTool API');
    expect(body.docs).toBe('/docs');
  });
});
