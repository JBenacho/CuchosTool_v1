// Pruebas unitarias de SLA y prioridades de casos (CU-SGC-008/011).
import { describe, it, expect } from 'vitest';
import { calcularVencimientoSla, esPrioridadValida } from '../src/modulos/casos/casos.servicio';

describe('SLA y prioridades de caso', function () {
  it('calcula el vencimiento sumando las horas configuradas', function () {
    const ahora = new Date('2026-09-05T12:00:00.000Z');
    const vencimiento = calcularVencimientoSla(ahora, 24);
    expect(vencimiento.getTime() - ahora.getTime()).toBe(24 * 3600 * 1000);
  });

  it('valida solo prioridades permitidas', function () {
    expect(esPrioridadValida('baja')).toBe(true);
    expect(esPrioridadValida('media')).toBe(true);
    expect(esPrioridadValida('alta')).toBe(true);
    expect(esPrioridadValida('urgente')).toBe(true);
    expect(esPrioridadValida('critica')).toBe(false);
  });
});
