// Pruebas unitarias de los reportes gerenciales del ERP (CU-GE).
// Cubre el calculo puro (sin BD) de periodos, series, montos y exportacion CSV.
import { describe, it, expect } from 'vitest';
import {
  BOM_CSV,
  aNumero,
  construirCsv,
  escaparCampoCsv,
  formatearMontoCsv,
  normalizarLimite,
  normalizarMeses,
  normalizarPeriodo,
  periodosSerie,
  rangoPeriodo,
  rangoSerie,
} from '../src/modulos/gerencia/gerencia.servicio';

describe('normalizarPeriodo (CU-GE)', function () {
  it('usa el periodo actual cuando no se informa', function () {
    expect(normalizarPeriodo('')).toBe(new Date().toISOString().slice(0, 7));
  });

  it('acepta periodos AAAA-MM y rechaza otros formatos', function () {
    expect(normalizarPeriodo('2026-09')).toBe('2026-09');
    expect(normalizarPeriodo('09-2026')).toBeNull();
    expect(normalizarPeriodo('2026-9')).toBeNull();
  });
});

describe('rangoPeriodo (CU-GE)', function () {
  it('cubre el mes completo en UTC', function () {
    const rango = rangoPeriodo('2026-09');
    expect(rango?.inicio.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(rango?.fin.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('rechaza meses inexistentes', function () {
    expect(rangoPeriodo('2026-13')).toBeNull();
    expect(rangoPeriodo('2026-00')).toBeNull();
  });
});

describe('periodosSerie (CU-GE)', function () {
  it('devuelve los meses en orden cronologico terminando en el mes de corte', function () {
    const periodos = periodosSerie(6, new Date('2026-09-15T12:00:00.000Z'));
    expect(periodos).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
  });

  it('cruza el cambio de anio hacia atras', function () {
    expect(periodosSerie(3, new Date('2026-01-31T12:00:00.000Z'))).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
    ]);
  });
});

describe('rangoSerie (CU-GE)', function () {
  it('abarca desde el primer dia del mes mas antiguo hasta el fin del mes de corte', function () {
    const rango = rangoSerie(3, new Date('2026-09-15T12:00:00.000Z'));
    expect(rango.inicio.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(rango.fin.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });
});

describe('normalizarMeses y normalizarLimite (CU-GE)', function () {
  it('aplica los valores por defecto ante entradas invalidas', function () {
    expect(normalizarMeses('')).toBe(6);
    expect(normalizarMeses('0')).toBe(6);
    expect(normalizarLimite('abc')).toBe(5);
  });

  it('limita los valores a los topes configurados', function () {
    expect(normalizarMeses('99')).toBe(24);
    expect(normalizarLimite('99')).toBe(20);
    expect(normalizarMeses('12')).toBe(12);
  });
});

describe('formatearMontoCsv y aNumero (CU-GE)', function () {
  it('expresa los centavos como importe con dos decimales y coma decimal', function () {
    expect(formatearMontoCsv(17255000)).toBe('172550,00');
    expect(formatearMontoCsv(999)).toBe('9,99');
  });

  it('convierte agregados de la base de datos a numero seguro', function () {
    expect(aNumero('17255000')).toBe(17255000);
    expect(aNumero(null)).toBe(0);
    expect(aNumero('no-numerico')).toBe(0);
  });
});

describe('construirCsv (CU-GE)', function () {
  it('construye el CSV con BOM, separador de columnas y CRLF', function () {
    const csv = construirCsv(['Periodo', 'Total (COP)'], [['2026-09', formatearMontoCsv(123456)]]);
    expect(csv.startsWith(BOM_CSV)).toBe(true);
    expect(csv).toBe(BOM_CSV + 'Periodo;Total (COP)\r\n2026-09;1234,56\r\n');
  });

  it('escapa campos con separador, comillas o saltos de linea', function () {
    expect(escaparCampoCsv('Norte;Sur')).toBe('"Norte;Sur"');
    expect(escaparCampoCsv('Cita "x"')).toBe('"Cita ""x"""');
    expect(escaparCampoCsv(null)).toBe('');
  });
});
