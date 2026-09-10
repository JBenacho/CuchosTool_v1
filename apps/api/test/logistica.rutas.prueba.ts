// Pruebas unitarias de la gestion de rutas del ERP (CU-LG-005).
// Cubre la validacion pura (sin BD) del codigo de ruta y de la secuencia de paradas.
import { describe, it, expect } from 'vitest';
import {
  normalizarCodigoRuta,
  normalizarParadas,
  rutaModificable,
} from '../src/modulos/logistica/logistica.servicio';

describe('normalizarCodigoRuta (RN-LG-01)', function () {
  it('genera el codigo cuando no se informa', function () {
    expect(normalizarCodigoRuta('')).toEqual({ codigo: null });
    expect(normalizarCodigoRuta(undefined)).toEqual({ codigo: null });
  });

  it('normaliza el codigo a mayusculas y recorta espacios', function () {
    expect(normalizarCodigoRuta('  rte-norte-01 ')).toEqual({ codigo: 'RTE-NORTE-01' });
  });

  it('rechaza codigos con formato invalido', function () {
    expect(normalizarCodigoRuta('ab')).toEqual({ error: 'codigo_ruta_invalido' });
    expect(normalizarCodigoRuta('RUTA NORTE')).toEqual({ error: 'codigo_ruta_invalido' });
  });
});

describe('normalizarParadas (RN-LG-02)', function () {
  it('numera las paradas en el orden recibido', function () {
    const resultado = normalizarParadas([
      { destino: 'Bodega Principal' },
      { destino: 'Cliente Norte', despachoId: 12 },
    ]);
    expect(resultado.datos).toEqual([
      { secuencia: 1, destino: 'Bodega Principal', despachoId: null },
      { secuencia: 2, destino: 'Cliente Norte', despachoId: 12 },
    ]);
  });

  it('exige al menos una parada', function () {
    expect(normalizarParadas([])).toEqual({ error: 'paradas_obligatorias' });
  });

  it('rechaza destinos repetidos sin importar mayusculas', function () {
    expect(normalizarParadas([{ destino: 'Norte' }, { destino: ' norte ' }])).toEqual({
      error: 'destino_duplicado',
    });
  });

  it('rechaza paradas sin destino', function () {
    expect(normalizarParadas([{ destino: '   ' }])).toEqual({ error: 'destino_obligatorio' });
  });
});

describe('rutaModificable (RN-LG-03)', function () {
  it('solo permite modificar rutas planificadas', function () {
    expect(rutaModificable('planificada')).toBe(true);
    expect(rutaModificable('en_progreso')).toBe(false);
    expect(rutaModificable('completada')).toBe(false);
    expect(rutaModificable('cancelada')).toBe(false);
  });
});
