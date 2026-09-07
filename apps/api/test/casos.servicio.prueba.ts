// Pruebas unitarias de las transiciones de estado de casos (CU-SGC-009).
import { describe, it, expect } from 'vitest';
import { esTransicionCasoValida } from '../src/modulos/casos/casos.servicio';

describe('esTransicionCasoValida', function () {
  it('permite abierto -> en_proceso y abierto -> cancelado', function () {
    expect(esTransicionCasoValida('abierto', 'en_proceso')).toBe(true);
    expect(esTransicionCasoValida('abierto', 'cancelado')).toBe(true);
  });

  it('rechaza saltos ilegales (abierto -> cerrado) y transiciones desde estados finales', function () {
    expect(esTransicionCasoValida('abierto', 'cerrado')).toBe(false);
    expect(esTransicionCasoValida('cerrado', 'abierto')).toBe(false);
    expect(esTransicionCasoValida('cancelado', 'en_proceso')).toBe(false);
  });

  it('permite en_proceso -> cerrado y en_proceso -> abierto', function () {
    expect(esTransicionCasoValida('en_proceso', 'cerrado')).toBe(true);
    expect(esTransicionCasoValida('en_proceso', 'abierto')).toBe(true);
  });
});
