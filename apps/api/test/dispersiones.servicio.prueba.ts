// Pruebas unitarias del calculo de comision de dispersion (CU-EM-018, BL-051).
import { describe, it, expect } from 'vitest';
import { calcularComision } from '../src/modulos/emprendedores/dispersiones.servicio';

describe('calcularComision', function () {
  it('sin tasa configurada la comision es cero', function () {
    expect(calcularComision(1000000, 0)).toBe(0);
  });

  it('aplica la tasa en puntos basicos con redondeo hacia abajo', function () {
    // 1000 bps = 10%.
    expect(calcularComision(1000000, 1000)).toBe(100000);
    // 250 bps = 2.5%: 1234567 * 250 / 10000 = 30864.175 -> 30864.
    expect(calcularComision(1234567, 250)).toBe(30864);
  });
});
