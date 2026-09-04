import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';

// Verifica integridad del contrato OpenAPI (BL-015 / CU-INT-010).
describe('Contrato OpenAPI', function () {
  it('GET /docs/json expone los paths del MVP', async function () {
    const app = await buildApp({ logger: false });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(res.statusCode).toBe(200);
    const spec = res.json();
    expect(spec.openapi).toBeTruthy();
    for (const p of ['/catalog/products', '/orders', '/cart', '/auth/register', '/auth/login']) {
      expect(Object.keys(spec.paths || {})).toContain(p);
    }
    await app.close();
  });
});
