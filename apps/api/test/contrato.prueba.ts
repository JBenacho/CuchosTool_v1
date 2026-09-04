// Prueba de integridad del contrato OpenAPI (BL-015 / CU-INT-010).
import { describe, it, expect } from 'vitest';
import { construirAplicacion } from '../src/app';

describe('Contrato OpenAPI', function () {
  it('GET /docs/json expone las rutas del MVP', async function () {
    const aplicacion = await construirAplicacion({ logger: false });
    await aplicacion.ready();
    const respuesta = await aplicacion.inject({ method: 'GET', url: '/docs/json' });
    expect(respuesta.statusCode).toBe(200);
    const especificacion = respuesta.json();
    expect(especificacion.openapi).toBeTruthy();
    for (const ruta of ['/catalogo/productos', '/pedidos', '/carrito', '/autenticacion/registro', '/autenticacion/ingreso']) {
      expect(Object.keys(especificacion.paths || {})).toContain(ruta);
    }
    await aplicacion.close();
  });
});
