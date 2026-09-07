// Pruebas unitarias del umbral de alertas de calidad (CU-SGC-021).
import { describe, it, expect } from 'vitest';
import { debeGenerarAlerta } from '../src/modulos/calidad/calidad.servicio';

describe('debeGenerarAlerta', function () {
  it('genera alerta cuando los casos abiertos alcanzan el umbral', function () {
    expect(debeGenerarAlerta(10, 10)).toBe(true);
    expect(debeGenerarAlerta(11, 10)).toBe(true);
  });

  it('no genera alerta por debajo del umbral ni con umbral desactivado', function () {
    expect(debeGenerarAlerta(9, 10)).toBe(false);
    expect(debeGenerarAlerta(50, 0)).toBe(false);
  });
});
