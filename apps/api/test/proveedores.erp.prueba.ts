// Pruebas unitarias del modulo ERP de proveedores (CU-ERP-001, F5).
// Cubre la normalizacion/validacion pura (sin BD) de los datos de un proveedor.
import { describe, it, expect } from 'vitest';
import {
  normalizarDatosProveedor,
  normalizarTarifaIva,
} from '../src/modulos/erp/proveedores.servicio';

describe('normalizarDatosProveedor (CU-ERP-001)', function () {
  it('acepta un proveedor valido y recorta espacios', function () {
    const resultado = normalizarDatosProveedor({
      nit: '  900123456  ',
      nombre: '  Distrilibros SA  ',
    });
    expect(resultado.error).toBeUndefined();
    expect(resultado.datos).toEqual({
      nit: '900123456',
      nombre: 'Distrilibros SA',
      contacto: null,
      telefono: null,
      correo: null,
      direccion: null,
      sitioWeb: null,
      tarifaIvaBps: 1900,
    });
  });

  it('normaliza contacto, telefono, correo, direccion y sitio web opcionales', function () {
    const resultado = normalizarDatosProveedor({
      nit: '1',
      nombre: 'X',
      contacto: 'Ana',
      telefono: ' 3115550101 ',
      correo: '  ana@distrilibros.co ',
      direccion: ' Cra 15 # 90-20 ',
      sitioWeb: ' https://distrilibros.co ',
    });
    expect(resultado.datos).toMatchObject({
      contacto: 'Ana',
      telefono: '3115550101',
      correo: 'ana@distrilibros.co',
      direccion: 'Cra 15 # 90-20',
      sitioWeb: 'https://distrilibros.co',
    });
  });

  it('rechaza correo mal formado (correo_invalido)', function () {
    const resultado = normalizarDatosProveedor({
      nit: '900123456',
      nombre: 'X',
      correo: 'correo-sin-arroba',
    });
    expect(resultado).toEqual({ error: 'correo_invalido' });
  });

  it('acepta correo vacio como opcional', function () {
    const resultado = normalizarDatosProveedor({ nit: '1', nombre: 'X', correo: '   ' });
    expect(resultado.datos).toMatchObject({ correo: null });
  });

  it('rechaza nit vacio (datos_incompletos)', function () {
    expect(normalizarDatosProveedor({ nit: '   ', nombre: 'X' })).toEqual({
      error: 'datos_incompletos',
    });
  });

  it('rechaza nombre vacio (datos_incompletos)', function () {
    expect(normalizarDatosProveedor({ nit: '900123456', nombre: '' })).toEqual({
      error: 'datos_incompletos',
    });
  });

  it('acepta la tarifa de IVA pactada con el proveedor (CU-ERP-003)', function () {
    const resultado = normalizarDatosProveedor({
      nit: '900123456',
      nombre: 'X',
      tarifaIvaBps: 500,
    });
    expect(resultado.datos).toMatchObject({ tarifaIvaBps: 500 });
  });

  it('rechaza tarifas de IVA fuera de rango (tarifa_iva_invalida)', function () {
    expect(normalizarDatosProveedor({ nit: '1', nombre: 'X', tarifaIvaBps: 10001 })).toEqual({
      error: 'tarifa_iva_invalida',
    });
    expect(normalizarDatosProveedor({ nit: '1', nombre: 'X', tarifaIvaBps: -1 })).toEqual({
      error: 'tarifa_iva_invalida',
    });
  });
});

describe('normalizarTarifaIva (CU-ERP-003)', function () {
  it('usa 19,00% cuando no se informa la tarifa', function () {
    expect(normalizarTarifaIva(undefined)).toEqual({ tarifa: 1900 });
    expect(normalizarTarifaIva('')).toEqual({ tarifa: 1900 });
  });

  it('acepta tarifas enteras entre 0 y 10000 puntos basicos', function () {
    expect(normalizarTarifaIva(0)).toEqual({ tarifa: 0 });
    expect(normalizarTarifaIva(1900)).toEqual({ tarifa: 1900 });
    expect(normalizarTarifaIva(10000)).toEqual({ tarifa: 10000 });
  });

  it('rechaza tarifas no enteras o fuera de rango', function () {
    expect(normalizarTarifaIva(19.5)).toEqual({ error: 'tarifa_iva_invalida' });
    expect(normalizarTarifaIva(20000)).toEqual({ error: 'tarifa_iva_invalida' });
  });
});
