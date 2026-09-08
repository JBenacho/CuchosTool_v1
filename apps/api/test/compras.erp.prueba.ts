// Pruebas unitarias de Compras avanzado del ERP (CU-ERP-002..009, F5).
import { describe, it, expect } from 'vitest';
import { calcularFechaVencimiento } from '../src/modulos/compras/compras.servicio';

describe('calcularFechaVencimiento (CU-ERP-009)', function () {
  it('suma el plazo en dias a la fecha de recepcion', function () {
    const base = new Date('2026-09-08T12:00:00.000Z');
    const vencimiento = calcularFechaVencimiento(30, base);
    expect(vencimiento.getTime() - base.getTime()).toBe(30 * 24 * 3600 * 1000);
  });

  it('usa el plazo por defecto cuando no se indica', function () {
    const vencimiento = calcularFechaVencimiento(30);
    expect(vencimiento.getTime()).toBeGreaterThan(Date.now());
  });
});
