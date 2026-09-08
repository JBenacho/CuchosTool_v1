// Pruebas unitarias del modulo Inventario del ERP (CU-INV-001..005, F5).
// Cubre validaciones puras (sin BD): movimientos y bodegas.
import { describe, it, expect } from 'vitest';
import {
  generarConsecutivoMovimiento,
  normalizarDatosBodega,
  validarMovimiento,
} from '../src/modulos/inventario/inventario.servicio';

describe('validarMovimiento (CU-INV-001/002/003)', function () {
  it('acepta un movimiento valido', function () {
    expect(
      validarMovimiento({ bodegaId: 1, productoId: 2, cantidad: 5, motivo: 'Compra OC-001' }),
    ).toEqual({});
  });

  it('rechaza cantidad cero o negativa (cantidad_invalida)', function () {
    expect(validarMovimiento({ bodegaId: 1, productoId: 2, cantidad: 0, motivo: 'x' })).toEqual({
      error: 'cantidad_invalida',
    });
    expect(validarMovimiento({ bodegaId: 1, productoId: 2, cantidad: -3, motivo: 'x' })).toEqual({
      error: 'cantidad_invalida',
    });
  });

  it('rechaza bodega o producto no numericos (bodega_invalida/producto_invalido)', function () {
    expect(validarMovimiento({ bodegaId: 0, productoId: 2, cantidad: 1, motivo: 'x' })).toEqual({
      error: 'bodega_invalida',
    });
    expect(validarMovimiento({ bodegaId: 1, productoId: -1, cantidad: 1, motivo: 'x' })).toEqual({
      error: 'producto_invalido',
    });
  });

  it('exige motivo (motivo_obligatorio)', function () {
    expect(validarMovimiento({ bodegaId: 1, productoId: 2, cantidad: 1, motivo: '   ' })).toEqual({
      error: 'motivo_obligatorio',
    });
  });
});

describe('normalizarDatosBodega (CU-INV-005)', function () {
  it('acepta nombre y recorta espacios', function () {
    const resultado = normalizarDatosBodega({ nombre: '  Bodega Norte  ', ubicacion: ' Cra 30 ' });
    expect(resultado.error).toBeUndefined();
    expect(resultado.datos).toEqual({ nombre: 'Bodega Norte', ubicacion: 'Cra 30' });
  });

  it('rechaza nombre vacio (nombre_obligatorio)', function () {
    expect(normalizarDatosBodega({ nombre: '  ' })).toEqual({ error: 'nombre_obligatorio' });
  });
});

describe('generarConsecutivoMovimiento (CU-INV-006)', function () {
  it('formatea el consecutivo oficial por anio', function () {
    expect(generarConsecutivoMovimiento(1, 2026)).toBe('INV-2026-000001');
    expect(generarConsecutivoMovimiento(123, 2026)).toBe('INV-2026-000123');
  });
});
