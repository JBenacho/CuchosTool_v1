// Pruebas unitarias del adaptador Wompi (firma, integridad y estados).
import { createHash, createHmac } from 'crypto';
import { describe, it, expect } from 'vitest';
import {
  calcularFirmaIntegridadWompi,
  mapearEstadoWompi,
  verificarFirmaWompi,
} from '../src/proveedores/wompi';

describe('adaptador Wompi', function () {
  it('mapea los estados del proveedor a estados internos', function () {
    expect(mapearEstadoWompi('APPROVED')).toBe('aprobado');
    expect(mapearEstadoWompi('DECLINED')).toBe('rechazado');
    expect(mapearEstadoWompi('VOIDED')).toBe('rechazado');
    expect(mapearEstadoWompi('PENDING')).toBe('pendiente');
    expect(mapearEstadoWompi('DESCONOCIDO')).toBe('pendiente');
  });

  it('calcula la firma de integridad como sha256 de referencia+monto+moneda+clave', function () {
    const esperada = createHash('sha256')
      .update('REF123' + 14500000 + 'COP' + 'clave-secreta')
      .digest('hex');
    expect(calcularFirmaIntegridadWompi('REF123', 14500000, 'COP', 'clave-secreta')).toBe(esperada);
  });

  it('verifica la firma del webhook solo con la clave correcta y cuerpo intacto', function () {
    const cuerpo = '{"event":"transaction.updated"}';
    const firma = createHmac('sha256', 'clave-eventos').update(cuerpo).digest('hex');
    expect(verificarFirmaWompi(cuerpo, firma, 'clave-eventos')).toBe(true);
    expect(verificarFirmaWompi(cuerpo, firma, 'otra-clave')).toBe(false);
    expect(verificarFirmaWompi(cuerpo + ' ', firma, 'clave-eventos')).toBe(false);
    expect(verificarFirmaWompi(cuerpo, '', 'clave-eventos')).toBe(false);
  });
});
